/**
 * Settings API Routes
 *
 * Endpoints for system configuration and Azure App Registration management.
 */

import express, { Request, Response } from 'express';
import { envManager, EnvManager } from '../services/env-manager.service';
import { oauthStateManager } from '../services/oauth-state.service';
import { microsoftGraphClient } from '../services/microsoft-graph.service';
import { certificateService } from '../services/certificate.service';

const router = express.Router();

/**
   * @swagger
   * /api/v2/settings/azure-app/check-env:
   *   get:
   *     tags:
   *       - Settings
   *     summary: Check environment configuration
   *     description: Checks which Azure environment variables are configured and which are missing
   *     responses:
   *       200:
   *         description: Environment status
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
   *                     exists:
   *                       type: boolean
   *                     hasAzureConfig:
   *                       type: boolean
   *                     missingVars:
   *                       type: array
   *                       items:
   *                         type: string
   *                     configuredVars:
   *                       type: array
   *                       items:
   *                         type: string
   *                     authMethod:
   *                       type: string
   *                       enum: [certificate, client_secret, none]
   */
router.get('/azure-app/check-env', async (req: Request, res: Response) => {
  try {
    // Read from process.env (container environment variables)
    // instead of trying to read .env file from disk
    const hasClientId = !!process.env.CLIENT_ID;
    const hasTenantId = !!process.env.TENANT_ID;
    const hasClientSecret = !!process.env.CLIENT_SECRET;
    const hasCertThumbprint = !!process.env.AZURE_CERTIFICATE_THUMBPRINT;
    const hasCertPath = !!process.env.AZURE_CERTIFICATE_PATH;
    const hasCertKeyPath = !!process.env.AZURE_CERTIFICATE_KEY_PATH;
    const hasAdminToken = !!process.env.ADMIN_TOKEN;
    const hasIngestSecret = !!process.env.INGEST_SECRET;

    const hasCertificate = hasCertThumbprint && hasCertPath && hasCertKeyPath;
    const hasAzureConfig = hasClientId && hasTenantId && (hasClientSecret || hasCertificate);

    const missingVars: string[] = [];
    if (!hasClientId) missingVars.push('CLIENT_ID');
    if (!hasTenantId) missingVars.push('TENANT_ID');
    if (!hasClientSecret && !hasCertificate) {
      missingVars.push('CLIENT_SECRET or (AZURE_CERTIFICATE_THUMBPRINT + AZURE_CERTIFICATE_PATH + AZURE_CERTIFICATE_KEY_PATH)');
    }
    if (!hasAdminToken) missingVars.push('ADMIN_TOKEN');
    if (!hasIngestSecret) missingVars.push('INGEST_SECRET');

    const configuredVars: string[] = [];
    if (hasClientId) configuredVars.push('CLIENT_ID');
    if (hasTenantId) configuredVars.push('TENANT_ID');
    if (hasClientSecret) configuredVars.push('CLIENT_SECRET');
    if (hasCertificate) configuredVars.push('AZURE_CERTIFICATE_*');
    if (hasAdminToken) configuredVars.push('ADMIN_TOKEN');
    if (hasIngestSecret) configuredVars.push('INGEST_SECRET');

    res.json({
      success: true,
      data: {
        exists: true, // Environment variables always exist in container
        hasAzureConfig,
        missingVars,
        configuredVars,
        authMethod: hasCertificate ? 'certificate' : hasClientSecret ? 'client_secret' : 'none'
      }
    });
  } catch (error: any) {
    console.error('Error checking environment:', error);
    res.status(500).json({
      error: 'ENVIRONMENT_CHECK_FAILED',
      message: 'Failed to check environment configuration',
      details: error.message
    });
  }
});

/**
   * @swagger
   * /api/v2/settings/azure-app/initiate:
   *   post:
   *     tags:
   *       - Settings
   *     summary: Initiate OAuth flow
   *     description: Initiates device code flow for Azure App Registration creation
   *     responses:
   *       200:
   *         description: Device code flow initiated
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
   *                     interval:
   *                       type: integer
   *                     message:
   *                       type: string
   */
router.post('/azure-app/initiate', async (req: Request, res: Response) => {
  try {
    // Check if Azure config already exists
    const envCheck = await envManager.checkAzureConfig();
    if (envCheck.hasAzureConfig) {
      return res.status(400).json({
        error: 'AZURE_ALREADY_CONFIGURED',
        message: 'Azure App Registration is already configured. Use rotation endpoint to update certificate.',
        details: {
          configuredVars: envCheck.allVars.filter(v =>
            v.startsWith('CLIENT_') ||
            v.startsWith('TENANT_') ||
            v.startsWith('AZURE_')
          )
        }
      });
    }

    // Use device code flow - no pre-configuration needed!
    // User signs in directly and we create the app
    console.log('[Settings] Initiating device code flow...');

    const deviceCodeResponse = await microsoftGraphClient.initiateDeviceCodeFlow([
      'Application.ReadWrite.All',      // Create app registrations
      'AppRoleAssignment.ReadWrite.All', // Grant admin consent
      'Directory.Read.All',              // Read directory
      'offline_access'
    ]);

    console.log('[Settings] Device code flow initiated:', {
      userCode: deviceCodeResponse.user_code,
      expiresIn: deviceCodeResponse.expires_in
    });

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
    console.error('[Settings] Error initiating OAuth:', error);
    res.status(500).json({
      error: 'OAUTH_INITIATION_FAILED',
      message: 'Failed to initiate OAuth flow',
      details: error.message
    });
  }
});

/**
   * @swagger
   * /api/v2/settings/azure-app/poll:
   *   post:
   *     tags:
   *       - Settings
   *     summary: Poll for OAuth completion
   *     description: Polls for device code completion and creates app registration if authenticated
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
   *                   example: pending
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   description: Present only on completion
   */
router.post('/azure-app/poll', async (req: Request, res: Response) => {
  try {
    const { deviceCode } = req.body;

    if (!deviceCode) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_CODE',
        message: 'Device code is required'
      });
    }

    console.log('[Settings] Polling device code for token...');

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

    console.log('[Settings] Token received, creating app registration...');

    // Extract tenant ID from token
    const tenantId = microsoftGraphClient.getTenantIdFromToken(tokenResponse.access_token!);

    // Create app registration
    const appReg = await microsoftGraphClient.createAppRegistration(
      tokenResponse.access_token!,
      'Device Inventory Data Collector'
    );

    console.log('[Settings] App registration created:', {
      objectId: appReg.id,
      clientId: appReg.appId,
      displayName: appReg.displayName
    });

    // Create service principal
    const servicePrincipal = await microsoftGraphClient.createServicePrincipal(
      tokenResponse.access_token!,
      appReg.appId
    );

    console.log('[Settings] Service principal created:', servicePrincipal.id);

    // Grant admin consent for all permissions
    const graphSpId = await microsoftGraphClient.getGraphServicePrincipalId(tokenResponse.access_token!);
    const permissionIds = [
      '2f51be20-0bb4-4fed-bf7b-db946066c75e', // DeviceManagementManagedDevices.Read.All
      'dc377aa6-52d8-4e23-b271-2a7ae04cedf3', // DeviceManagementConfiguration.Read.All
      '7a6ee1e7-141e-4cec-ae74-d9db155731ff', // DeviceManagementApps.Read.All
      '5ac13192-7ace-4fcf-b828-1a26f28068ee', // DeviceManagementServiceConfig.Read.All
      '58ca0d9a-1575-47e1-a3cb-007cdfb8685f', // DeviceManagementRBAC.Read.All
      '7438b122-aefc-4978-80ed-43db9fcc7715', // Device.Read.All
      '7ab1d382-f21e-4acd-a863-ba3e13f7da61', // Directory.Read.All
      'df021288-bdef-4463-88db-98f22de89214', // User.Read.All
      '5b567255-7703-4780-807c-7be8301ae99b', // Group.Read.All
      '230c1aed-a721-4c5d-9cb4-a90514e508ef', // Reports.Read.All
      '498476ce-e0fe-48b0-b801-37ba7e2685c6', // Organization.Read.All
      'b0afded3-3588-46d8-8b3d-9842eff778da', // AuditLog.Read.All
      'bf394140-e372-4bf9-a898-299cfc7564e5', // SecurityEvents.Read.All
      'f8f035bb-2cce-47fb-8bf5-7baf3ecbee48'  // ThreatAssessment.Read.All
    ];

    await microsoftGraphClient.grantAdminConsent(
      tokenResponse.access_token!,
      servicePrincipal.id,
      graphSpId,
      permissionIds
    );

    console.log('[Settings] Admin consent granted');

    // Week 4: Generate X.509 certificate for authentication
    console.log('[Settings] Generating certificate...');
    const certificate = await certificateService.generateCertificate({
      commonName: `Device Inventory - ${appReg.appId}`,
      organization: 'Device Inventory',
      organizationUnit: 'IT Operations',
      country: 'US',
      validityDays: 365
    });

    console.log('[Settings] Certificate generated:', {
      thumbprint: certificate.thumbprint,
      expiresAt: certificate.expiresAt
    });

    // Store certificate to disk
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const certFilename = `azure-app-${timestamp}`;
    const certStorage = await certificateService.storeCertificate(certificate, certFilename);

    console.log('[Settings] Certificate stored to disk');

    // Upload certificate to Azure App Registration
    const certBase64 = certificateService.prepareCertForAzure(certificate.publicKey);
    await microsoftGraphClient.uploadCertificate(
      tokenResponse.access_token!,
      appReg.id,
      certBase64,
      certificate.thumbprint
    );

    console.log('[Settings] Certificate uploaded to Azure');

    // Generate security tokens if they don't exist
    const currentEnv = await envManager.readEnv();
    const adminToken = currentEnv.ADMIN_TOKEN || EnvManager.generateToken(32);
    const ingestSecret = currentEnv.INGEST_SECRET || EnvManager.generateToken(32);

    // Update .env file with certificate-based authentication
    const envUpdates = {
      CLIENT_ID: appReg.appId,
      TENANT_ID: tenantId,
      AZURE_CERTIFICATE_THUMBPRINT: certificate.thumbprint,
      AZURE_CERTIFICATE_PATH: certStorage.certPath,
      AZURE_CERTIFICATE_KEY_PATH: certStorage.keyPath,
      ADMIN_TOKEN: adminToken,
      INGEST_SECRET: ingestSecret
    };

    const updateResult = await envManager.updateEnv(envUpdates);

    if (!updateResult.success) {
      console.error('[Settings] Failed to update .env:', updateResult.error);
      return res.status(500).json({
        error: 'ENV_UPDATE_FAILED',
        message: 'Failed to update .env file',
        details: updateResult.error
      });
    }

    console.log('[Settings] .env file updated successfully with certificate authentication');

    res.json({
      success: true,
      status: 'completed',
      data: {
        clientId: appReg.appId,
        tenantId,
        certificateThumbprint: certificate.thumbprint,
        message: 'App registration created successfully! Restart containers to use it.'
      }
    });

  } catch (error: any) {
    console.error('[Settings] OAuth poll error:', error);
    res.status(500).json({
      error: 'POLL_FAILED',
      message: 'Failed to complete app registration',
      details: error.message
    });
  }
});

/**
   * @swagger
   * /api/v2/settings/azure-app/callback:
   *   get:
   *     tags:
   *       - Settings
   *     summary: OAuth callback (Deprecated)
   *     deprecated: true
   *     description: OAuth callback handler for legacy flow
   *     parameters:
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *       - in: query
   *         name: error
   *         schema:
   *           type: string
   *     responses:
   *       302:
   *         description: Redirects to settings page
   */
router.get('/azure-app/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Check for OAuth error
    if (error) {
      console.error('[Settings] OAuth callback error:', error, error_description);
      return res.redirect(
        `/dashboard/settings?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent(error_description as string || 'Unknown error')}`
      );
    }

    // Validate state token (CSRF protection)
    if (!state || typeof state !== 'string') {
      return res.redirect('/dashboard/settings?error=invalid_state');
    }

    const stateMetadata = oauthStateManager.consumeState(state);
    if (!stateMetadata) {
      return res.redirect('/dashboard/settings?error=invalid_or_expired_state');
    }

    // Validate authorization code
    if (!code || typeof code !== 'string') {
      return res.redirect('/dashboard/settings?error=no_code');
    }

    console.log('[Settings] OAuth callback received, exchanging code for token...');

    // Exchange authorization code for access token
    // Use OAuth Helper app (public client, no secret needed)
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v2/settings/azure-app/callback`;
    const OAUTH_HELPER_CLIENT_ID = process.env.OAUTH_HELPER_CLIENT_ID;

    if (!OAUTH_HELPER_CLIENT_ID) {
      return res.redirect('/dashboard/settings?error=oauth_helper_not_configured');
    }

    const tokenResponse = await microsoftGraphClient.exchangeCodeForToken(
      code,
      redirectUri,
      OAUTH_HELPER_CLIENT_ID,
      undefined // No client secret for public clients
    );

    console.log('[Settings] Token received, creating app registration...');

    // Extract tenant ID from token
    const tenantId = microsoftGraphClient.getTenantIdFromToken(tokenResponse.access_token);

    // Create app registration
    const appReg = await microsoftGraphClient.createAppRegistration(
      tokenResponse.access_token,
      'Device Inventory Data Collector'
    );

    console.log('[Settings] App registration created:', {
      objectId: appReg.id,
      clientId: appReg.appId,
      displayName: appReg.displayName
    });

    // Create service principal
    const servicePrincipal = await microsoftGraphClient.createServicePrincipal(
      tokenResponse.access_token,
      appReg.appId
    );

    console.log('[Settings] Service principal created:', servicePrincipal.id);

    // Grant admin consent for all permissions (matches createAppRegistration)
    const graphSpId = await microsoftGraphClient.getGraphServicePrincipalId(tokenResponse.access_token);
    const permissionIds = [
      '2f51be20-0bb4-4fed-bf7b-db946066c75e', // DeviceManagementManagedDevices.Read.All
      'dc377aa6-52d8-4e23-b271-2a7ae04cedf3', // DeviceManagementConfiguration.Read.All
      '7a6ee1e7-141e-4cec-ae74-d9db155731ff', // DeviceManagementApps.Read.All
      '5ac13192-7ace-4fcf-b828-1a26f28068ee', // DeviceManagementServiceConfig.Read.All
      '58ca0d9a-1575-47e1-a3cb-007cdfb8685f', // DeviceManagementRBAC.Read.All
      '7438b122-aefc-4978-80ed-43db9fcc7715', // Device.Read.All
      '7ab1d382-f21e-4acd-a863-ba3e13f7da61', // Directory.Read.All
      'df021288-bdef-4463-88db-98f22de89214', // User.Read.All
      '5b567255-7703-4780-807c-7be8301ae99b', // Group.Read.All
      '230c1aed-a721-4c5d-9cb4-a90514e508ef', // Reports.Read.All
      '498476ce-e0fe-48b0-b801-37ba7e2685c6', // Organization.Read.All
      'b0afded3-3588-46d8-8b3d-9842eff778da', // AuditLog.Read.All
      'bf394140-e372-4bf9-a898-299cfc7564e5', // SecurityEvents.Read.All
      'f8f035bb-2cce-47fb-8bf5-7baf3ecbee48'  // ThreatAssessment.Read.All
    ];

    await microsoftGraphClient.grantAdminConsent(
      tokenResponse.access_token,
      servicePrincipal.id,
      graphSpId,
      permissionIds
    );

    console.log('[Settings] Admin consent granted');

    // Week 4: Generate X.509 certificate for authentication
    console.log('[Settings] Generating certificate...');
    const certificate = await certificateService.generateCertificate({
      commonName: `Device Inventory - ${appReg.appId}`,
      organization: 'Device Inventory',
      organizationUnit: 'IT Operations',
      country: 'US',
      validityDays: 365
    });

    console.log('[Settings] Certificate generated:', {
      thumbprint: certificate.thumbprint,
      expiresAt: certificate.expiresAt
    });

    // Store certificate to disk
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const certFilename = `azure-app-${timestamp}`;
    const certStorage = await certificateService.storeCertificate(certificate, certFilename);

    console.log('[Settings] Certificate stored to disk');

    // Upload certificate to Azure App Registration
    const certBase64 = certificateService.prepareCertForAzure(certificate.publicKey);
    await microsoftGraphClient.uploadCertificate(
      tokenResponse.access_token,
      appReg.id,
      certBase64,
      certificate.thumbprint
    );

    console.log('[Settings] Certificate uploaded to Azure');

    // Generate security tokens if they don't exist
    const currentEnv = await envManager.readEnv();
    const adminToken = currentEnv.ADMIN_TOKEN || EnvManager.generateToken(32);
    const ingestSecret = currentEnv.INGEST_SECRET || EnvManager.generateToken(32);

    // Update .env file with certificate-based authentication
    const envUpdates = {
      CLIENT_ID: appReg.appId,
      TENANT_ID: tenantId,
      AZURE_CERTIFICATE_THUMBPRINT: certificate.thumbprint,
      AZURE_CERTIFICATE_PATH: certStorage.certPath,
      AZURE_CERTIFICATE_KEY_PATH: certStorage.keyPath,
      ADMIN_TOKEN: adminToken,
      INGEST_SECRET: ingestSecret
    };

    const updateResult = await envManager.updateEnv(envUpdates);

    if (!updateResult.success) {
      console.error('[Settings] Failed to update .env:', updateResult.error);
      return res.redirect('/dashboard/settings?error=env_update_failed');
    }

    console.log('[Settings] .env file updated successfully with certificate authentication');

    // Redirect to settings page with success message
    res.redirect('/dashboard/settings?success=true&action=app_created&client_id=' + appReg.appId + '&cert_auth=true');

  } catch (error: any) {
    console.error('[Settings] OAuth callback error:', error);
    res.redirect('/dashboard/settings?error=callback_failed&details=' + encodeURIComponent(error.message));
  }
});

/**
   * @swagger
   * /api/v2/settings/azure-app/rotate-cert:
   *   post:
   *     tags:
   *       - Settings
   *     summary: Rotate certificate
   *     description: Rotate certificate for existing app registration (Not Implemented)
   *     responses:
   *       501:
   *         description: Not implemented
   */
router.post('/azure-app/rotate-cert', async (req: Request, res: Response) => {
  // Week 1: Placeholder
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Certificate rotation not yet implemented (Week 5)'
  });

  /*
   * Week 5 implementation plan:
   *
   * 1. Validate existing Azure config
   * 2. Generate new certificate
   * 3. Get app object ID from .env or Graph API
   * 4. Upload new cert to Azure (keep old one for grace period)
   * 5. Update .env with new thumbprint
   * 6. Test authentication with new cert
   * 7. Remove old cert after verification
   */
});

/**
   * @swagger
   * /api/v2/settings/azure-app/status:
   *   get:
   *     tags:
   *       - Settings
   *     summary: Get Azure App status
   *     description: Get current Azure App Registration status (Not Implemented)
   *     responses:
   *       501:
   *         description: Not implemented
   */
router.get('/azure-app/status', async (req: Request, res: Response) => {
  // Week 1: Placeholder
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Status check not yet implemented (Week 3)'
  });

  /*
   * Week 3 implementation plan:
   *
   * 1. Check if Azure config exists in .env
   * 2. If exists, query Graph API:
   *    GET https://graph.microsoft.com/v1.0/applications/{id}
   * 3. Extract certificate info from keyCredentials
   * 4. Check expiration dates
   * 5. Verify required permissions are granted
   * 6. Return status object with all details
   */
});

/**
   * @swagger
   * /api/v2/settings/azure-app:
   *   delete:
   *     tags:
   *       - Settings
   *     summary: Remove Azure App config
   *     description: Remove Azure App Registration configuration (Not Implemented)
   *     responses:
   *       501:
   *         description: Not implemented
   */
router.delete('/azure-app', async (req: Request, res: Response) => {
  // Week 1: Placeholder
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Config removal not yet implemented (Week 6)'
  });
});

export default router;
