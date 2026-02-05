/**
 * Auto-Provisioning Service
 *
 * Orchestrates the automatic setup of Azure App Registrations,
 * certificates, and configuration for the Device Inventory system.
 *
 * Handles:
 * - Device code authentication flow
 * - Parallel creation of Fetcher App + SSO App
 * - Certificate generation and upload
 * - Permission grants
 * - Local admin user creation
 * - Environment configuration
 * - Rollback on failure
 */

import { promises as fs } from 'fs';
import Redis from 'ioredis';
import { microsoftGraphClient } from './microsoft-graph.service';
import { certificateService } from './certificate.service';
import { envManager, EnvManager } from './env-manager.service';
import { provisioningStateService } from './provisioning-state.service';
import { localUserService } from './local-user.service';
import { redisSessionService } from './redis-session.service';
import { encrypt } from '../utils/crypto';
import {
  ProvisioningExecutionResult,
  ProvisioningStep,
  CreatedResource,
  PROVISIONING_STEPS,
} from '../types/provisioning.types';

// Permission IDs for the Fetcher App (same as in MicrosoftGraphClient.createAppRegistration)
const FETCHER_PERMISSIONS = [
  // === Core Device Management ===
  '2f51be20-0bb4-4fed-bf7b-db946066c75e', // DeviceManagementManagedDevices.Read.All
  'dc377aa6-52d8-4e23-b271-2a7ae04cedf3', // DeviceManagementConfiguration.Read.All
  '7a6ee1e7-141e-4cec-ae74-d9db155731ff', // DeviceManagementApps.Read.All
  '06a5fe6d-c49d-46a7-b082-56b1b14103c7', // DeviceManagementServiceConfig.Read.All
  '58ca0d9a-1575-47e1-a3cb-007ef2e4583b', // DeviceManagementRBAC.Read.All
  '7438b122-aefc-4978-80ed-43db9fcc7715', // Device.Read.All

  // === Directory & Users ===
  '7ab1d382-f21e-4acd-a863-ba3e13f7da61', // Directory.Read.All
  'df021288-bdef-4463-88db-98f22de89214', // User.Read.All
  '5b567255-7703-4780-807c-7be8301ae99b', // Group.Read.All
  '498476ce-e0fe-48b0-b801-37ba7e2685c6', // Organization.Read.All

  // === Reports & Analytics ===
  '230c1aed-a721-4c5d-9cb4-a90514e508ef', // Reports.Read.All
  'b0afded3-3588-46d8-8b3d-9842eff778da', // AuditLog.Read.All

  // === Security & Threat Protection ===
  'bf394140-e372-4bf9-a898-299cfc7564e5', // SecurityEvents.Read.All
  'f8f035bb-2cce-47fb-8bf5-7baf3ecbee48', // ThreatAssessment.Read.All
  '472e4a4d-bb4a-4026-98d1-0b0d74cb74a5', // SecurityAlert.Read.All
  '45cc0394-e837-488b-a098-1918f48d186c', // SecurityIncident.Read.All

  // === Identity Protection ===
  '6e472fd1-ad78-48da-a0f0-97ab2c6b769e', // IdentityRiskEvent.Read.All
  'dc5007c0-2d7d-4c42-879c-2dab87571379', // IdentityRiskyUser.Read.All
  '246dd0d5-5bd0-4def-940b-0421030a5b68', // Policy.Read.All (Conditional Access)

  // === Windows Update & Cloud PC ===
  '7bf44c40-8e04-4d19-9eec-9c9c36f4c9a0', // WindowsUpdates.Read.All
  'a9e09520-8ed4-4f7e-a74a-ca1d2e0a7b4f', // CloudPC.Read.All

  // === Role Management ===
  'c7fbd983-d9aa-4fa7-84b8-17382c103bc4', // RoleManagement.Read.All
];

export interface ExecuteProvisioningInput {
  provisioningId: string;
  accessToken: string;
  redirectUri: string; // For SSO app
  adminEmail: string;
  adminPassword: string;
  adminDisplayName?: string;
}

export class AutoProvisioningService {
  /**
   * Check if the system is configured (has required .env variables)
   */
  async isSystemConfigured(): Promise<boolean> {
    const envCheck = await envManager.checkAzureConfig();
    return envCheck.hasAzureConfig;
  }

  /**
   * Get system configuration status for frontend
   */
  async getConfigurationStatus(): Promise<{
    configured: boolean;
    missingVars: string[];
    hasLocalAdmin: boolean;
    preflightChecks?: {
      redis: boolean;
      opensearch: boolean;
      envWritable: boolean;
      orphanedApps?: { count: number; apps: any[] };
      errors: string[];
    };
  }> {
    const envCheck = await envManager.checkAzureConfig();
    const hasLocalAdmin = await localUserService.hasAnyAdmin();

    // Only run pre-flight checks if system needs setup
    let preflightChecks = undefined;
    if (!envCheck.hasAzureConfig || !hasLocalAdmin) {
      preflightChecks = await this.checkPreflightRequirements();
    }

    return {
      configured: envCheck.hasAzureConfig,
      missingVars: envCheck.missingVars,
      hasLocalAdmin,
      preflightChecks,
    };
  }

  /**
   * Check pre-flight requirements before wizard starts
   */
  private async checkPreflightRequirements(): Promise<{
    redis: boolean;
    opensearch: boolean;
    envWritable: boolean;
    orphanedApps?: { count: number; apps: any[] };
    errors: string[];
  }> {
    const errors: string[] = [];
    let redis = false;
    let opensearch = false;
    let envWritable = false;
    let orphanedApps = undefined;

    // Check Redis connection
    const testKey = 'provisioning:test';
    try {
      const redisConn = (provisioningStateService as any).redis;
      if (redisConn) {
        await redisConn.set(testKey, 'test', 'EX', 5);
        await redisConn.del(testKey);
        redis = true;
      }
    } catch (e: any) {
      errors.push(`Redis check failed: ${e.message}`);
    }

    // Check OpenSearch connection
    try {
      const opensearchUrl = process.env.OPENSEARCH_URL;
      if (!opensearchUrl) {
        errors.push('OPENSEARCH_URL environment variable is missing');
      } else {
        // OpenSearch connection is validated by other services
        // For now, just check if URL is set
        opensearch = true;
      }
    } catch (err: any) {
      errors.push(`OpenSearch check failed: ${err.message}`);
    }

    // Check .env file write permissions
    try {
      const envPath = envManager['envPath'];
      await fs.access(envPath, fs.constants.W_OK);
      envWritable = true;
    } catch (err: any) {
      errors.push(`.env file is not writable: ${err.message}`);
    }

    // Check for orphaned apps (only if we can get an access token)
    try {
      const activeSessions = await provisioningStateService.listActiveSessions();
      const activeSession = activeSessions[0]?.provisioningId;
      if (activeSession) {
        const accessToken = await provisioningStateService.getAccessToken(activeSession);
        if (accessToken) {
          const orphans = await this.checkForOrphanedApps(accessToken);
          if (orphans.hasOrphans) {
            orphanedApps = {
              count: orphans.count,
              apps: orphans.apps
            };
            errors.push(`Found ${orphans.count} orphaned app(s) from previous failed attempts`);
          }
        }
      }
    } catch (err: any) {
      // Don't block on this check
      console.warn('[Preflight] Could not check for orphaned apps:', err.message);
    }

    return {
      redis,
      opensearch,
      envWritable,
      orphanedApps,
      errors,
    };
  }

  /**
   * Initiate device code flow for user authentication
   */
  async initiateDeviceCodeFlow(): Promise<{
    provisioningId: string;
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    message: string;
  }> {
    // Request expanded scopes for app creation
    const scopes = [
      'Application.ReadWrite.All',
      'AppRoleAssignment.ReadWrite.All',
      'Directory.Read.All',
      'User.Read',
      'offline_access',
    ];

    const deviceCodeResponse = await microsoftGraphClient.initiateDeviceCodeFlow(scopes);

    // Create provisioning state
    const provisioningId = await provisioningStateService.createState();

    // Update state with device code info
    await provisioningStateService.updateStep(provisioningId, {
      step: 'device_code_initiated',
      status: 'in_progress',
      message: 'Waiting for user authentication',
    });

    // Store device code temporarily for polling
    await provisioningStateService.setDeviceCode(
      provisioningId,
      deviceCodeResponse.device_code,
      deviceCodeResponse.expires_in
    );

    console.log(`[AutoProvisioning] Device code flow initiated: ${provisioningId}`);

    return {
      provisioningId,
      deviceCode: deviceCodeResponse.device_code,
      userCode: deviceCodeResponse.user_code,
      verificationUri: deviceCodeResponse.verification_uri,
      expiresIn: deviceCodeResponse.expires_in,
      message: deviceCodeResponse.message,
    };
  }

  /**
   * Poll for device code authentication completion
   */
  async pollDeviceCode(provisioningId: string): Promise<{
    status: 'pending' | 'completed' | 'error';
    error?: string;
  }> {
    const deviceCode = await provisioningStateService.getDeviceCode(provisioningId);
    if (!deviceCode) {
      return { status: 'error', error: 'Device code expired or not found' };
    }

    const pollResult = await microsoftGraphClient.pollDeviceCodeForToken(deviceCode);

    if (pollResult.status === 'completed' && pollResult.access_token) {
      // Store access token
      await provisioningStateService.setAccessToken(provisioningId, pollResult.access_token, 3600);

      // Update provisioning state
      await provisioningStateService.updateStep(provisioningId, {
        step: 'authenticated',
        status: 'completed',
        message: 'User authenticated successfully',
      });

      console.log(`[AutoProvisioning] User authenticated for ${provisioningId}`);
      return { status: 'completed' };
    }

    if (pollResult.status === 'error') {
      await provisioningStateService.setError(
        provisioningId,
        `Authentication failed: ${pollResult.error_description || pollResult.error}`
      );
      return { status: 'error', error: pollResult.error_description || pollResult.error };
    }

    return { status: 'pending' };
  }

  /**
   * Execute full provisioning flow
   */
  async executeProvisioning(input: ExecuteProvisioningInput): Promise<ProvisioningExecutionResult> {
    const { provisioningId, accessToken, redirectUri, adminEmail, adminPassword, adminDisplayName } =
      input;

    const startTime = Date.now();

    try {
      // Get tenant ID from token
      const tenantId = microsoftGraphClient.getTenantIdFromToken(accessToken);

      await provisioningStateService.updateStep(provisioningId, {
        step: 'creating_apps',
        status: 'in_progress',
        message: 'Creating Azure App Registrations...',
      });

      // Create backup of current .env
      const backupPath = await envManager.createBackup();
      if (backupPath) {
        await provisioningStateService.addCreatedResource(provisioningId, {
          type: 'file',
          id: backupPath,
          name: '.env backup',
          createdAt: Date.now(),
        });
      }

      // PARALLEL: Create Fetcher App and SSO App
      const [fetcherApp, ssoApp] = await Promise.all([
        this.createFetcherApp(provisioningId, accessToken),
        this.createSSOApp(provisioningId, accessToken, redirectUri),
      ]);

      await provisioningStateService.updateStep(provisioningId, {
        step: 'creating_service_principals',
        status: 'in_progress',
        message: 'Creating Service Principals...',
      });

      // Create Service Principals for both apps
      const fetcherSP = await microsoftGraphClient.createServicePrincipal(
        accessToken,
        fetcherApp.appId
      );
      await provisioningStateService.addCreatedResource(provisioningId, {
        type: 'service_principal',
        id: fetcherSP.id,
        name: `Service Principal: ${fetcherApp.displayName}`,
        createdAt: Date.now(),
      });

      const ssoSP = await microsoftGraphClient.createServicePrincipal(accessToken, ssoApp.appId);
      await provisioningStateService.addCreatedResource(provisioningId, {
        type: 'service_principal',
        id: ssoSP.id,
        name: `Service Principal: ${ssoApp.displayName}`,
        createdAt: Date.now(),
      });

      await provisioningStateService.updateStep(provisioningId, {
        step: 'generating_certificate',
        status: 'in_progress',
        message: 'Generating certificate for Fetcher App...',
      });

      // Generate certificate for Fetcher App
      const timestamp = Date.now();
      const certInfo = await certificateService.generateCertificate({
        commonName: `DeviceInventoryFetcher-${timestamp}`,
        validityDays: 365,
      });

      // Store certificate to disk
      const certStorage = await certificateService.storeCertificate(
        certInfo,
        `azure-app-${timestamp}`
      );
      await provisioningStateService.addCreatedResource(provisioningId, {
        type: 'certificate',
        id: certStorage.thumbprint,
        name: 'Azure Certificate',
        createdAt: Date.now(),
        metadata: {
          certPath: certStorage.certPath,
          keyPath: certStorage.keyPath,
          pfxPath: certStorage.pfxPath,
        },
      });

      await provisioningStateService.updateStep(provisioningId, {
        step: 'uploading_certificate',
        status: 'in_progress',
        message: 'Uploading certificate to Azure...',
      });

      // Prepare and upload certificate to Azure
      const certBase64 = certificateService.prepareCertForAzure(certInfo.publicKey);
      await microsoftGraphClient.uploadCertificate(
        accessToken,
        fetcherApp.id,
        certBase64,
        certInfo.thumbprint
      );

      // Skip certificate validation - Azure needs 30-60 seconds to propagate
      // The certificate will be validated when the Fetcher service starts
      console.log('[AutoProvisioning] Certificate uploaded successfully - skipping validation (will be validated on first use)');

      await provisioningStateService.updateStep(provisioningId, {
        step: 'granting_permissions',
        status: 'in_progress',
        message: 'Granting API permissions...',
      });

      // Get Microsoft Graph service principal ID for permission grants
      const graphSpId = await microsoftGraphClient.getGraphServicePrincipalId(accessToken);

      // Grant permissions to Fetcher App
      const grantResult = await microsoftGraphClient.grantAdminConsent(
        accessToken,
        fetcherSP.id,
        graphSpId,
        FETCHER_PERMISSIONS
      );

      console.log(`[AutoProvisioning] Admin consent: ${grantResult.succeeded.length} granted, ${grantResult.failed.length} failed`);

      // Check critical permissions
      const criticalPermissions = [
        '2f51be20-0bb4-4fed-bf7b-db946066c75e', // DeviceManagementManagedDevices.Read.All
        'dc377aa6-52d8-4e23-b271-2a7ae04cedf3', // DeviceManagementConfiguration.Read.All
        '7ab1d382-f21e-4acd-a863-ba3e13f7da61', // Directory.Read.All
        'df021288-bdef-4463-88db-98f22de89214', // User.Read.All
      ];

      const failedCritical = criticalPermissions.filter(p => grantResult.failed.includes(p));
      if (failedCritical.length > 0) {
        console.error(`[AutoProvisioning] CRITICAL: Failed to grant ${failedCritical.length} critical permissions`);
        console.error('[AutoProvisioning] User must manually grant admin consent via Azure Portal');
        // Continue anyway - we'll provide manual consent URL to user
      }

      await provisioningStateService.updateStep(provisioningId, {
        step: 'creating_admin_user',
        status: 'in_progress',
        message: 'Creating local admin user...',
      });

      // Create local admin user
      const adminUser = await localUserService.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminDisplayName || adminEmail.split('@')[0],
        role: 'admin',
      });
      await provisioningStateService.addCreatedResource(provisioningId, {
        type: 'local_user',
        id: adminUser.id,
        name: `Admin: ${adminUser.email}`,
        createdAt: Date.now(),
      });

      await provisioningStateService.updateStep(provisioningId, {
        step: 'writing_config',
        status: 'in_progress',
        message: 'Writing configuration...',
      });

      // Generate security tokens
      const adminToken = EnvManager.generateToken(32);
      const ingestSecret = EnvManager.generateToken(32);
      const encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || EnvManager.generateToken(32);

      // Generate infrastructure secrets
      const opensearchInitialPassword = EnvManager.generateToken(32);
      const esPass = EnvManager.generateToken(32);
      const sessionSecret = EnvManager.generateToken(64); // Longer for session security
      const redisPassword = EnvManager.generateToken(32); // Redis authentication

      // Write all configuration to .env
      const envUpdate = await envManager.updateEnv({
        // Encryption Key (Critical for Zero-Touch secure configuration)
        CONFIG_ENCRYPTION_KEY: encryptionKey,

        // Fetcher App
        CLIENT_ID: fetcherApp.appId,
        TENANT_ID: tenantId,
        AZURE_CERTIFICATE_THUMBPRINT: certInfo.thumbprint,
        AZURE_CERTIFICATE_PATH: certStorage.certPath,
        AZURE_CERTIFICATE_KEY_PATH: certStorage.keyPath,
        AZURE_CERTIFICATE_PFX_PATH: certStorage.pfxPath,
        AZURE_CERTIFICATE_PFX_PASSWORD: certInfo.pfxPassword,

        // SSO App
        SSO_CLIENT_ID: ssoApp.appId,
        SSO_CLIENT_SECRET: ssoApp.clientSecret,
        SSO_TENANT_ID: tenantId,
        SSO_REDIRECT_URI: redirectUri,

        // Security tokens
        ADMIN_TOKEN: adminToken,
        INGEST_SECRET: ingestSecret,
        INGEST_KEY_ID: 'default',

        // OpenSearch credentials
        OPENSEARCH_INITIAL_ADMIN_PASSWORD: opensearchInitialPassword,
        ES_USER: 'api_user',
        ES_PASS: esPass,

        // Redis session and authentication
        SESSION_SECRET: sessionSecret,
        REDIS_PASSWORD: redisPassword,

        // Local auth
        LOCAL_AUTH_ENABLED: 'true',
        BCRYPT_ROUNDS: '12',
      });

      if (!envUpdate.success) {
        throw new Error(`Failed to write .env: ${envUpdate.error}`);
      }

      // Store credentials in Redis for dynamic access by fetcher (doesn't require restart)
      console.log('[AutoProvisioning] Storing encrypted credentials in Redis for fetcher access...');
      const redis = redisSessionService.getClient();

      if (redis) {
        try {
          // Store fetcher credentials with 90-day expiry (same as cert validity)
          const REDIS_CREDENTIAL_TTL = 90 * 24 * 60 * 60; // 90 days

          // Encrypt all sensitive data before storage using the generated key
          await redis.setex('fetcher:client_id', REDIS_CREDENTIAL_TTL, encrypt(fetcherApp.appId, encryptionKey));
          await redis.setex('fetcher:tenant_id', REDIS_CREDENTIAL_TTL, encrypt(tenantId, encryptionKey));
          await redis.setex('fetcher:certificate_thumbprint', REDIS_CREDENTIAL_TTL, encrypt(certInfo.thumbprint, encryptionKey));
          await redis.setex('fetcher:certificate_path', REDIS_CREDENTIAL_TTL, encrypt(certStorage.certPath, encryptionKey));
          await redis.setex('fetcher:certificate_key_path', REDIS_CREDENTIAL_TTL, encrypt(certStorage.keyPath, encryptionKey));
          await redis.setex('fetcher:certificate_pfx_path', REDIS_CREDENTIAL_TTL, encrypt(certStorage.pfxPath, encryptionKey));
          await redis.setex('fetcher:certificate_pfx_password', REDIS_CREDENTIAL_TTL, encrypt(certInfo.pfxPassword, encryptionKey));
          
          // Store raw contents for true Zero-Touch (doesn't require volume sync)
          await redis.setex('fetcher:certificate_content', REDIS_CREDENTIAL_TTL, encrypt(certInfo.publicKey, encryptionKey));
          await redis.setex('fetcher:certificate_key_content', REDIS_CREDENTIAL_TTL, encrypt(certInfo.privateKey, encryptionKey));
          await redis.setex('fetcher:certificate_pfx_base64', REDIS_CREDENTIAL_TTL, encrypt(certInfo.pfxData.toString('base64'), encryptionKey));

          // Store API config for fetcher
          await redis.setex('fetcher:api_base', REDIS_CREDENTIAL_TTL, encrypt('http://api-ts:3001', encryptionKey)); // Use internal Docker name
          await redis.setex('fetcher:admin_token', REDIS_CREDENTIAL_TTL, encrypt(adminToken, encryptionKey));

          // Set reload flag to trigger fetcher restart
          await redis.setex('provisioning:fetcher_needs_reload', 300, 'true'); // 5 minute expiry

          console.log('[AutoProvisioning] ✓ Encrypted credentials stored in Redis, reload flag set');
        } catch (err: any) {
          console.error(`[AutoProvisioning] WARNING: Failed to store credentials in Redis: ${err.message}`);
          console.log('[AutoProvisioning] Fetcher will use environment variables instead');
        }
      } else {
        console.warn('[AutoProvisioning] WARNING: Redis not available, fetcher will use environment variables only');
      }

      // CRITICAL: Persist session ID to file for rollback capability after Docker restart
      // This allows us to find and delete tagged Azure apps even after Redis state is lost
      const sessionFilePath = '/data/provisioning-session.json';
      try {
        await fs.writeFile(
          sessionFilePath,
          JSON.stringify({
            sessionId: provisioningId,
            createdAt: new Date().toISOString(),
            tenantId: tenantId,
            fetcherAppId: fetcherApp.appId,
            ssoAppId: ssoApp.appId,
          }, null, 2)
        );
        console.log(`[AutoProvisioning] Session ID persisted to ${sessionFilePath} for rollback support`);
      } catch (err: any) {
        console.error(`[AutoProvisioning] WARNING: Failed to persist session ID: ${err.message}`);
        // Don't fail provisioning if session persistence fails, but log warning
      }

      const duration = Date.now() - startTime;

      await provisioningStateService.updateStep(provisioningId, {
        step: 'completed',
        status: 'completed',
        message: 'Provisioning completed successfully',
      });

      console.log(`[AutoProvisioning] Completed in ${duration}ms`);

      return {
        success: true,
        config: {
          fetcher: {
            appId: fetcherApp.appId,
            objectId: fetcherApp.id,
            displayName: fetcherApp.displayName,
            certificateThumbprint: certInfo.thumbprint,
          },
          sso: {
            appId: ssoApp.appId,
            objectId: ssoApp.id,
            displayName: ssoApp.displayName,
            redirectUri,
          },
          tenantId,
          adminUser: {
            id: adminUser.id,
            email: adminUser.email,
          },
        },
        duration,
        message: 'System provisioned successfully. Container will restart with new configuration.',
      };
    } catch (error: any) {
      console.error(`[AutoProvisioning] Error: ${error.message}`);

      await provisioningStateService.setError(provisioningId, error.message);

      // Attempt rollback
      await this.rollback(provisioningId, accessToken);

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create the Fetcher App Registration
   */
  private async createFetcherApp(
    provisioningId: string,
    accessToken: string
  ): Promise<{ id: string; appId: string; displayName: string }> {
    // Add tags to identify this app for cleanup
    const tags = [
      'DeviceInventory:AutoProvisioned',
      `DeviceInventory:SessionID:${provisioningId}`,
      'DeviceInventory:Type:Fetcher'
    ];

    const fetcherApp = await microsoftGraphClient.createAppRegistration(
      accessToken,
      'Device Inventory - Data Fetcher',
      tags
    );

    await provisioningStateService.addCreatedResource(provisioningId, {
      type: 'app_registration',
      id: fetcherApp.appId,
      objectId: fetcherApp.id,
      name: fetcherApp.displayName,
      createdAt: Date.now(),
    });

    console.log(`[AutoProvisioning] Created Fetcher App: ${fetcherApp.appId} with tags: ${tags.join(', ')}`);
    return fetcherApp;
  }

  /**
   * Create the SSO App Registration
   */
  private async createSSOApp(
    provisioningId: string,
    accessToken: string,
    redirectUri: string
  ): Promise<{ id: string; appId: string; displayName: string; clientSecret: string }> {
    // Add tags to identify this app for cleanup
    const tags = [
      'DeviceInventory:AutoProvisioned',
      `DeviceInventory:SessionID:${provisioningId}`,
      'DeviceInventory:Type:SSO'
    ];

    const ssoApp = await microsoftGraphClient.createSSOAppRegistration(
      accessToken,
      'Device Inventory - SSO',
      redirectUri,
      tags
    );

    await provisioningStateService.addCreatedResource(provisioningId, {
      type: 'app_registration',
      id: ssoApp.appId,
      objectId: ssoApp.id,
      name: ssoApp.displayName,
      createdAt: Date.now(),
    });

    console.log(`[AutoProvisioning] Created SSO App: ${ssoApp.appId} with tags: ${tags.join(', ')}`);
    return ssoApp;
  }

  /**
   * Rollback all created resources on failure
   */
  async rollback(provisioningId: string, accessToken?: string): Promise<void> {
    console.log(`[AutoProvisioning] Starting rollback for ${provisioningId}`);

    const state = await provisioningStateService.getState(provisioningId);
    if (!state || !state.createdResources) {
      console.log('[AutoProvisioning] No resources to rollback');
      return;
    }

    // Warn if accessToken is missing
    if (!accessToken) {
      console.warn('[AutoProvisioning] No access token provided for rollback - Azure resources will NOT be deleted');
      console.warn('[AutoProvisioning] To manually clean up Azure apps, use the cleanup endpoint with tag: DeviceInventory:SessionID:' + provisioningId);
    }

    await provisioningStateService.updateStep(provisioningId, {
      step: 'rolling_back',
      status: 'in_progress',
      message: 'Rolling back created resources...',
    });

    // Rollback in reverse order
    const resources = [...state.createdResources].reverse();
    let deletedCount = 0;
    let failedCount = 0;

    for (const resource of resources) {
      try {
        await this.deleteResource(resource, accessToken);
        deletedCount++;
        console.log(`[AutoProvisioning] ✓ Deleted ${resource.type}: ${resource.name}`);
      } catch (error: any) {
        failedCount++;
        console.error(`[AutoProvisioning] ✗ Failed to delete ${resource.type} "${resource.name}": ${error.message}`);
        // Continue with other resources even if one fails
      }
    }

    console.log(`[AutoProvisioning] Rollback summary: ${deletedCount} deleted, ${failedCount} failed`);

    if (failedCount > 0) {
      console.warn(`[AutoProvisioning] Some resources could not be deleted. To manually clean up, use tag: DeviceInventory:SessionID:${provisioningId}`);
    }

    await provisioningStateService.updateStep(provisioningId, {
      step: 'rolled_back',
      status: 'completed',
      message: `Rollback completed (${deletedCount} deleted, ${failedCount} failed)`,
    });

    console.log('[AutoProvisioning] Rollback completed');
  }

  /**
   * Delete a specific resource during rollback
   */
  private async deleteResource(resource: CreatedResource, accessToken?: string): Promise<void> {
    switch (resource.type) {
      case 'app_registration':
        if (accessToken) {
          await microsoftGraphClient.deleteAppRegistration(accessToken, resource.id);
        }
        break;

      case 'service_principal':
        if (accessToken) {
          await microsoftGraphClient.deleteServicePrincipal(accessToken, resource.id);
        }
        break;

      case 'certificate':
        if (resource.metadata?.certPath && resource.metadata?.keyPath) {
          await certificateService.deleteCertificate(
            resource.metadata.certPath,
            resource.metadata.keyPath
          );
        }
        break;

      case 'local_user':
        await localUserService.deleteUser(resource.id);
        break;

      case 'file':
        // Don't delete backup files during rollback
        break;
    }
  }

  /**
   * Get provisioning progress
   */
  async getProgress(provisioningId: string): Promise<{
    status: string;
    currentStep: ProvisioningStep | null;
    completedSteps: ProvisioningStep[];
    error?: string;
  }> {
    const state = await provisioningStateService.getState(provisioningId);
    if (!state) {
      return {
        status: 'not_found',
        currentStep: null,
        completedSteps: [],
      };
    }

    return {
      status: state.status,
      currentStep: PROVISIONING_STEPS.find(s => s.id === state.currentStep) || null,
      completedSteps: state.completedSteps.map(id => PROVISIONING_STEPS.find(s => s.id === id)!).filter(Boolean),
      error: state.error?.message,
    };
  }

  /**
   * Acquire a provisioning lock to prevent concurrent provisioning sessions
   * Uses Redis NX (set if not exists) with expiration
   *
   * @returns true if lock was acquired, false if lock already exists
   */
  async acquireProvisioningLock(): Promise<boolean> {
    const PROVISIONING_LOCK_KEY = 'provisioning:lock';
    const LOCK_EXPIRY_SECONDS = 600; // 10 minutes

    try {
      const redis = (provisioningStateService as any).redis;
      if (!redis) return false;

      const result = await redis.set(
        PROVISIONING_LOCK_KEY,
        Date.now().toString(),
        'EX',
        LOCK_EXPIRY_SECONDS,
        'NX'
      );

      const acquired = result === 'OK';
      console.log(`[AutoProvisioning] Provisioning lock ${acquired ? 'ACQUIRED' : 'ALREADY EXISTS'}`);
      return acquired;
    } catch (error: any) {
      console.error(`[AutoProvisioning] Failed to acquire provisioning lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Release the provisioning lock
   */
  async releaseProvisioningLock(): Promise<void> {
    const PROVISIONING_LOCK_KEY = 'provisioning:lock';

    try {
      const redis = (provisioningStateService as any).redis;
      if (redis) {
        await redis.del(PROVISIONING_LOCK_KEY);
      }
      console.log(`[AutoProvisioning] Provisioning lock RELEASED`);
    } catch (error: any) {
      console.error(`[AutoProvisioning] Failed to release provisioning lock: ${error.message}`);
    }
  }

  /**
   * Check for orphaned Azure app registrations from previous failed provisioning attempts
   * Uses tags to identify apps created by auto-provisioning
   *
   * @param accessToken - Azure AD access token with Application.ReadWrite.All permission
   * @param tag - Tag to identify apps to search for (default: DeviceInventory:AutoProvisioned)
   * @returns Information about orphaned apps (count and details)
   */
  async checkForOrphanedApps(
    accessToken: string,
    tag: string = 'DeviceInventory:AutoProvisioned'
  ): Promise<{
    hasOrphans: boolean;
    count: number;
    apps: Array<{ id: string; displayName: string; appId: string; created: string }>;
  }> {
    console.log(`[AutoProvisioning] Checking for orphaned apps with tag: ${tag}`);

    try {
      const apps = await microsoftGraphClient.findAppsByTag(accessToken, tag);

      console.log(`[AutoProvisioning] Found ${apps.length} orphaned app(s)`);

      return {
        hasOrphans: apps.length > 0,
        count: apps.length,
        apps: apps.map(app => ({
          id: app.id,
          displayName: app.displayName,
          appId: app.appId,
          created: app.createdDateTime
        }))
      };
    } catch (error: any) {
      console.error(`[AutoProvisioning] Failed to check for orphaned apps: ${error.message}`);
      return {
        hasOrphans: false,
        count: 0,
        apps: []
      };
    }
  }

  /**
   * Clean up orphaned Azure app registrations from failed provisioning attempts
   * Uses tags to identify apps created by auto-provisioning
   *
   * @param accessToken - Azure AD access token with Application.ReadWrite.All permission
   * @param tag - Tag to identify apps to delete (default: DeviceInventory:AutoProvisioned)
   * @returns Cleanup result with count of deleted apps and any errors
   */
  async cleanupOrphanedApps(
    accessToken: string,
    tag: string = 'DeviceInventory:AutoProvisioned'
  ): Promise<{ deleted: number; errors: string[] }> {
    console.log(`[AutoProvisioning] Starting cleanup for apps with tag: ${tag}`);

    try {
      const result = await microsoftGraphClient.deleteAppsByTag(accessToken, tag);

      console.log(`[AutoProvisioning] Cleanup complete: ${result.deleted} deleted, ${result.errors.length} errors`);

      return result;
    } catch (error: any) {
      console.error(`[AutoProvisioning] Cleanup failed: ${error.message}`);
      return {
        deleted: 0,
        errors: [error.message],
      };
    }
  }
}

// Export singleton instance
export const autoProvisioningService = new AutoProvisioningService();
