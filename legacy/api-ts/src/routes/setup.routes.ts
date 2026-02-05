/**
 * Setup Routes
 *
 * One-time setup endpoints for initial configuration
 */

import { Router, Request, Response } from 'express';
import { microsoftGraphClient } from '../services/microsoft-graph.service';
import { envManager } from '../services/env-manager.service';
import { Client } from '@opensearch-project/opensearch';
import { IngestService } from '../services/ingest.service';
import { INDICES } from '../config/opensearch';
import { promises as fs } from 'fs';
import { normalizeDevices } from '../normalizers/device-normalizer';
import { normalizeUsers } from '../normalizers/user-normalizer';
import { normalizeLicenses } from '../normalizers/license-normalizer';
import { PermissionVerificationService } from '../services/permission-verification.service';

export function createSetupRoutes(opensearchClient: Client): Router {
  const router = Router();
  const ingestService = new IngestService(opensearchClient);

  // Store redirect URI temporarily (in-memory, simple approach)
  const setupState = new Map<string, string>();

  /**
   * @swagger
   * /api/v2/setup/trigger-ingest:
   *   post:
   *     tags:
   *       - Setup
   *     summary: Manually trigger ingestion from disk
   *     description: Ingests data from /data/data.json, /data/users.json, and /data/licenses.json if available
   *     responses:
   *       200:
   *         description: Ingestion result
   */
  router.post('/trigger-ingest', async (req: Request, res: Response) => {
    try {
      console.log('[Setup] Triggered ingestion from disk');

      const paths = {
        devices: '/data/data.json',
        users: '/data/users.json',
        licenses: '/data/licenses.json',
        warranty: '/data/warranty.json',
        compliance: '/data/device-compliance.json',
        configurations: '/data/device-configurations.json',
        abm: '/data/abm_enrichment.json',
        crashes: '/data/app_crashes.json',
        uxa: '/data/uxa_insights.json'
      };

      const results: any = {
        devices: { status: 'skipped', count: 0 },
        users: { status: 'skipped', count: 0 },
        licenses: { status: 'skipped', count: 0 },
        duration: 0
      };

      const startTime = Date.now();

      // Helper to safe read JSON
      const readJson = async (path: string): Promise<any | null> => {
        try {
          await fs.access(path);
          const content = await fs.readFile(path, 'utf-8');
          return JSON.parse(content);
        } catch (e) {
          return null;
        }
      };

      // 1. Read all data sources in parallel
      const [deviceData, userData, licenseData, warrantyData, complianceData, configurationData, crashData] = await Promise.all([
        readJson(paths.devices),
        readJson(paths.users),
        readJson(paths.licenses),
        readJson(paths.warranty),
        readJson(paths.compliance),
        readJson(paths.configurations),
        readJson(paths.crashes)
      ]);

      if (!deviceData && !userData) {
        throw new Error('No data files found in /data');
      }

      // 2. Construct unified FetcherOutput for normalization
      // This is crucial: we merge all separate files into one object that the normalizer expects
      const fetcherOutput: any = {
        managedDevices: deviceData?.managedDevices || [],
        users: userData?.users || [],
        // Add enrichment data
        warranty: warrantyData?.items ? Object.values(warrantyData.items) : undefined, // Warranty items array (convert from dict if needed)

        // Map compliance field names: fetcher uses "deviceComplianceStates", normalizer expects "deviceComplianceStatus"
        deviceComplianceStatus: complianceData?.deviceComplianceStates, // Device-level compliance evaluations
        compliancePolicies: complianceData?.policies, // Compliance policy definitions

        // Map configuration field names: fetcher uses "deviceConfigurationStates", normalizer expects "deviceConfigurationStatus"
        deviceConfigurationStatus: configurationData?.deviceConfigurationStates, // Device-level configuration deployments
        configurationPolicies: configurationData?.configurations, // Configuration profile definitions (fetcher uses "configurations" not "profiles")

        crashes: crashData?.crashes || undefined
      };

      // Normalize warranty items structure if it came from our cache dict
      if (warrantyData && warrantyData.items && !Array.isArray(warrantyData.items)) {
         fetcherOutput.warranty = Object.values(warrantyData.items);
      }

      console.log(`[Setup] Loaded data: ${fetcherOutput.managedDevices.length} devices, ${fetcherOutput.users.length} users`);
      if (fetcherOutput.warranty) {
          console.log(`[Setup] Loaded ${fetcherOutput.warranty.length} warranty records`);
      }
      if (complianceData) {
          const deviceStateCount = complianceData.deviceComplianceStates ? Object.keys(complianceData.deviceComplianceStates).length : 0;
          console.log(`[Setup] Loaded compliance data: ${complianceData.policies?.length || 0} policies, ${deviceStateCount} devices with compliance states`);
      }
      if (configurationData) {
          const deviceStateCount = configurationData.deviceConfigurationStates ? Object.keys(configurationData.deviceConfigurationStates).length : 0;
          console.log(`[Setup] Loaded configuration data: ${configurationData.configurations?.length || 0} profiles, ${deviceStateCount} devices with configuration states`);
      }

      // 3. Normalize and Ingest Devices
      if (fetcherOutput.managedDevices.length > 0) {
        console.log(`[Setup] Normalizing devices with dual-write enabled...`);
        const normalizedDevices = await normalizeDevices(fetcherOutput, {
          enableDualWrite: true, // Always enable dual-write for both compliance and configuration
          opensearchClient
        });

        const deviceResult = await ingestService.ingestDevices(normalizedDevices, {
          refresh: true,
          batchSize: 500,
          mode: 'upsert',
          continueOnError: true
        });

        results.devices = {
          status: deviceResult.success ? 'success' : 'partial_failure',
          count: deviceResult.indexed,
          failed: deviceResult.failed,
          errors: deviceResult.errors?.slice(0, 5)
        };
      }

      // 4. Normalize and Ingest Users
      if (fetcherOutput.users.length > 0) {
        console.log(`[Setup] Normalizing users...`);

        // Re-normalize devices just for user correlation context (lightweight)
        // We reuse the fetcherOutput which already has everything
        const normalizedDevices = fetcherOutput.managedDevices.length > 0 ?
          await normalizeDevices(fetcherOutput) : undefined;

        const normalizedUsers = normalizeUsers(
          fetcherOutput,
          {}, // extra context
          normalizedDevices
        );

        const userResult = await ingestService.ingestUsers(normalizedUsers, {
          refresh: true,
          batchSize: 500,
          continueOnError: true
        });

        results.users = {
          status: userResult.success ? 'success' : 'partial_failure',
          count: userResult.indexed,
          failed: userResult.failed,
          errors: userResult.errors?.slice(0, 5)
        };
      }

      // 5. Ingest Licenses (Separate flow)
      if (licenseData?.subscribedSkus) {
        console.log(`[Setup] Ingesting licenses...`);
        const normalizedLicenses = normalizeLicenses(licenseData);

        const licenseResult = await ingestService.ingestLicenses(normalizedLicenses, {
          refresh: true,
          batchSize: 100,
          mode: 'upsert'
        });

        results.licenses = {
          status: licenseResult.success ? 'success' : 'partial_failure',
          count: licenseResult.indexed,
          failed: licenseResult.failed
        };
      }

      results.duration = Date.now() - startTime;
      console.log(`[Setup] Ingestion completed in ${results.duration}ms`);

      res.json({
        success: true,
        results
      });

    } catch (error: any) {
      console.error('Manual ingestion failed:', error);
      res.status(500).json({
        success: false,
        error: 'INGESTION_FAILED',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/v2/setup/status:
   *   get:
   *     tags:
   *       - Setup
   *     summary: Check system onboarding status
   *     description: Checks if the system has data (is onboarded)
   *     responses:
   *       200:
   *         description: System status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 is_onboarded:
   *                   type: boolean
   *                 device_count:
   *                   type: integer
   *                 user_count:
   *                   type: integer
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const checkPermissions = req.query.check_permissions === 'true' || req.query.check_permissions === '1';
      const permissionService = new PermissionVerificationService(null); // No redis for this lightweight check

      // Check if system is configured (has Azure credentials)
      const envCheck = await envManager.checkAzureConfig();
      const needs_setup = !envCheck.hasAzureConfig;

      // Check if indices exist first to avoid errors
      const [deviceCount, userCount, licenseCount, complianceCount, configCount, caPolicyCount, alertCount] = await Promise.all([
        ingestService.getDocumentCount(INDICES.DEVICES),
        ingestService.getDocumentCount(INDICES.USERS),
        ingestService.getDocumentCount(INDICES.LICENSES),
        ingestService.getDocumentCount(INDICES.COMPLIANCE_POLICIES),
        ingestService.getDocumentCount(INDICES.CONFIGURATION_PROFILES),
        ingestService.getDocumentCount(INDICES.CONDITIONAL_ACCESS_POLICIES),
        ingestService.getDocumentCount(INDICES.ALERTS)
      ]);

      // System is considered "onboarded" if we have successfully ingested devices
      const is_onboarded = deviceCount > 0;

      const response: any = {
        is_onboarded,
        needs_setup,
        device_count: deviceCount,
        user_count: userCount,
        license_count: licenseCount,
        compliance_count: complianceCount,
        config_count: configCount,
        ca_policy_count: caPolicyCount,
        alert_count: alertCount
      };

      // Optional permission verification (used by wizard)
      if (checkPermissions) {
        try {
          const report = await permissionService.verifyAllPermissions();
          response.permissions = {
            verified_at: report.verified_at,
            all_granted: report.failed === 0,
            granted_count: report.granted,
            total_count: report.total_permissions,
            failed_permissions: report.results
              .filter(r => r.status !== 'granted')
              .map(r => r.permission_name)
          };
        } catch (err) {
          console.warn('[Setup] Permission verification failed during status check:', err);
        }
      }

      res.json(response);
    } catch (error: any) {
      console.error('Error checking system status:', error);
      // If indices don't exist or other error, assume not onboarded
      res.json({
        is_onboarded: false,
        device_count: 0,
        user_count: 0,
        error: error.message
      });
    }
  });

  // POST endpoint to update onboarding progress
  router.post('/onboarding/progress', async (req: Request, res: Response) => {
    const { phase, progress, steps, error, counts } = req.body;

    if (!phase) {
      return res.status(400).json({ error: 'Missing phase in request body' });
    }

    try {
      const statusUpdate: any = { currentPhase: phase, progress: progress || 0 };
      if (steps) statusUpdate.steps = steps;
      if (error) statusUpdate.error = error;
      if (counts) statusUpdate.counts = counts;

      // Inline update logic to avoid global client issues
      let currentStatus: any = {
        key: 'onboarding_state',
        currentPhase: 'pending',
        progress: 0,
        steps: {},
        counts: {},
        lastUpdated: new Date().toISOString(),
        error: null
      };

      try {
        const existingDoc = await opensearchClient.get({
          index: INDICES.ONBOARDING_STATUS,
          id: 'onboarding_state'
        });
        currentStatus = existingDoc.body._source;
      } catch (e) {}

      const mergedStatus = {
        ...currentStatus,
        ...statusUpdate,
        steps: {
          ...currentStatus.steps,
          ...(statusUpdate.steps || {})
        },
        counts: {
          ...currentStatus.counts,
          ...(statusUpdate.counts || {})
        },
        lastUpdated: new Date().toISOString()
      };

      await opensearchClient.index({
        index: INDICES.ONBOARDING_STATUS,
        id: 'onboarding_state',
        body: mergedStatus,
        refresh: true
      });

      res.json({ success: true, message: 'Onboarding status updated' });
    } catch (updateError) {
      console.error('Error updating onboarding status via API:', updateError);
      res.status(500).json({ error: 'Failed to update onboarding status' });
    }
  });

  /**
   * @swagger
   * /api/v2/setup/onboarding/status:
   *   get:
   *     tags:
   *       - Setup
   *     summary: Get detailed onboarding progress
   *     description: Returns the real-time progress of the fetcher sync
   */
  router.get('/onboarding/status', async (req: Request, res: Response) => {
    try {
      const result = await opensearchClient.get({
        index: INDICES.ONBOARDING_STATUS,
        id: 'onboarding_state'
      });
      res.json(result.body._source);
    } catch (error: any) {
      if (error.meta && error.meta.statusCode === 404) {
        res.json({ currentPhase: 'never_run', progress: 0, steps: {}, lastUpdated: new Date().toISOString(), error: null });
      } else {
        console.error('Error fetching onboarding status:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding status' });
      }
    }
  });

  /**
     * @swagger
     * /api/v2/setup/oauth-helper/initiate:
     *   post:
     *     tags:
     *       - Setup
     *     summary: Initiate OAuth helper setup
     *     description: Initiates device code flow to create OAuth helper app
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - redirectUri
     *             properties:
     *               redirectUri:
     *                 type: string
     *                 description: The callback URI for the helper app
     *     responses:
     *       200:
     *         description: Setup initiated
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 data:
     *                   type: object
     *                   properties:
     *                     deviceCode:
     *                       type: string
     *                     userCode:
     *                       type: string
     *                     verificationUri:
     *                       type: string
     *                     expiresIn:
     *                       type: integer
     */
  router.post('/oauth-helper/initiate', async (req: Request, res: Response) => {
    try {
      const { redirectUri } = req.body;

      if (!redirectUri) {
        return res.status(400).json({
          error: 'MISSING_REDIRECT_URI',
          message: 'Redirect URI is required',
          details: {
            example: 'http://localhost/api/v2/settings/azure-app/callback'
          }
        });
      }

      console.log('[Setup] Initiating OAuth helper creation...');

      // Initiate device code flow for setup
      const deviceCodeResponse = await microsoftGraphClient.initiateDeviceCodeFlow([
        'Application.ReadWrite.All',  // Create app registrations
        'offline_access'
      ]);

      console.log('[Setup] Device code flow initiated:', {
        userCode: deviceCodeResponse.user_code,
        expiresIn: deviceCodeResponse.expires_in
      });

      // Store redirect URI in memory for later use (keyed by device code)
      setupState.set(deviceCodeResponse.device_code, redirectUri);

      res.json({
        success: true,
        data: {
          deviceCode: deviceCodeResponse.device_code,
          userCode: deviceCodeResponse.user_code,
          verificationUri: deviceCodeResponse.verification_uri,
          expiresIn: deviceCodeResponse.expires_in,
          interval: deviceCodeResponse.interval,
          message: deviceCodeResponse.message
        }
      });
    } catch (error: any) {
      console.error('[Setup] Error initiating OAuth helper setup:', error);
      res.status(500).json({
        error: 'SETUP_INITIATION_FAILED',
        message: 'Failed to initiate OAuth helper setup',
        details: error.message
      });
    }
  });

  /**
     * @swagger
     * /api/v2/setup/oauth-helper/poll:
     *   post:
     *     tags:
     *       - Setup
     *     summary: Poll for OAuth helper completion
     *     description: Polls for device code completion and creates OAuth helper app
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - deviceCode
     *             properties:
     *               deviceCode:
     *                 type: string
     *     responses:
     *       200:
     *         description: Polling status or completion result
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 status:
     *                   type: string
     *                   example: completed
     *                 data:
     *                   type: object
     *                   description: OAuth helper details
     */
  router.post('/oauth-helper/poll', async (req: Request, res: Response) => {
    try {
      const { deviceCode } = req.body;

      if (!deviceCode) {
        return res.status(400).json({
          error: 'MISSING_DEVICE_CODE',
          message: 'Device code is required'
        });
      }

      console.log('[Setup] Polling device code for token...');

      // Poll for token
      const tokenResponse = await microsoftGraphClient.pollDeviceCodeForToken(deviceCode);

      if (tokenResponse.status === 'pending') {
        return res.json({
          success: false,
          status: 'pending',
          message: 'Waiting for user authentication...'
        });
      }

      if (tokenResponse.status === 'error') {
        return res.status(400).json({
          error: 'DEVICE_CODE_ERROR',
          message: tokenResponse.error_description || tokenResponse.error,
          details: tokenResponse
        });
      }

      console.log('[Setup] Token received, creating OAuth helper app...');

      // Get redirect URI from memory
      const redirectUri = setupState.get(deviceCode) || 'http://localhost/api/v2/settings/azure-app/callback';

      // Extract tenant ID from token
      const tenantId = microsoftGraphClient.getTenantIdFromToken(tokenResponse.access_token!);

      // Create OAuth Helper app as PUBLIC CLIENT
      const appReg = await microsoftGraphClient.createPublicClientApp(
        tokenResponse.access_token!,
        'Device Inventory OAuth Helper',
        redirectUri
      );

      console.log('[Setup] OAuth helper app created:', {
        objectId: appReg.id,
        clientId: appReg.appId,
        displayName: appReg.displayName
      });

      // Update .env file with OAuth helper client ID
      const envUpdates = {
        OAUTH_HELPER_CLIENT_ID: appReg.appId
      };

      await envManager.updateEnv(envUpdates);

      console.log('[Setup] .env file updated with OAUTH_HELPER_CLIENT_ID');

      // Clean up stored redirect URI
      setupState.delete(deviceCode);

      res.json({
        success: true,
        status: 'completed',
        data: {
          clientId: appReg.appId,
          tenantId,
          redirectUri,
          message: 'OAuth helper app created successfully! Restart containers to use it.'
        }
      });

    } catch (error: any) {
      console.error('[Setup] Error in OAuth helper poll:', error);
      res.status(500).json({
        error: 'SETUP_FAILED',
        message: 'Failed to create OAuth helper app',
        details: error.message
      });
    }
  });

  return router;
}
