/**
 * Provisioning Routes
 *
 * API endpoints for the auto-provisioning setup wizard.
 * These routes are accessible without authentication during initial setup.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { autoProvisioningService } from '../services/auto-provisioning.service';
import { provisioningStateService } from '../services/provisioning-state.service';
import { localUserService } from '../services/local-user.service';
import { envManager } from '../services/env-manager.service';

const router = Router();

/**
 * Middleware to check if setup is allowed
 * Only allows access when system is not yet configured
 */
const requireUnconfigured = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isConfigured = await autoProvisioningService.isSystemConfigured();
    const hasAdmin = await localUserService.hasAnyAdmin();

    // Allow access if either system is not configured OR there's no admin user
    if (!isConfigured || !hasAdmin) {
      return next();
    }

    res.status(403).json({
      error: 'System is already configured',
      message: 'Setup is complete. Please use the normal login flow.',
    });
  } catch (error: any) {
    console.error('[Provisioning] Error checking configuration:', error.message);
    next(); // Allow access on error to enable recovery
  }
};

/**
 * GET /api/v2/provisioning/status
 *
 * Check if system needs setup
 * Returns configuration status and what's missing
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await autoProvisioningService.getConfigurationStatus();

    // Check if local auth is enabled via environment variable
    const localAuthEnabled = process.env.LOCAL_AUTH_ENABLED === 'true';

    res.json({
      data: {
        needsSetup: !status.configured || !status.hasLocalAdmin,
        configured: status.configured,
        hasLocalAdmin: status.hasLocalAdmin,
        missingVars: status.missingVars,
        localAuthEnabled,
      },
    });
  } catch (error: any) {
    console.error('[Provisioning] Error getting status:', error.message);
    res.status(500).json({
      error: 'Failed to get configuration status',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/initiate
 *
 * Start the device code authentication flow
 * Returns a user code for the user to enter at microsoft.com/devicelogin
 */
router.post('/initiate', requireUnconfigured, async (req: Request, res: Response) => {
  try {
    // Check provisioning lock to prevent concurrent provisioning sessions
    const lockAcquired = await autoProvisioningService.acquireProvisioningLock();
    if (!lockAcquired) {
      return res.status(409).json({
        error: 'Provisioning already in progress',
        message: 'Another provisioning session is currently active. Please wait or try again later.',
      });
    }

    const result = await autoProvisioningService.initiateDeviceCodeFlow();

    res.json({
      provisioningId: result.provisioningId,
      userCode: result.userCode,
      verificationUri: result.verificationUri,
      expiresIn: result.expiresIn,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[Provisioning] Error initiating device code:', error.message);
    res.status(500).json({
      error: 'Failed to initiate device code flow',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/poll
 *
 * Poll for device code authentication completion
 */
router.post('/poll', requireUnconfigured, async (req: Request, res: Response) => {
  try {
    const { provisioningId } = req.body;

    if (!provisioningId) {
      return res.status(400).json({
        error: 'Missing provisioningId',
      });
    }

    const result = await autoProvisioningService.pollDeviceCode(provisioningId);

    res.json(result);
  } catch (error: any) {
    console.error('[Provisioning] Error polling device code:', error.message);
    res.status(500).json({
      error: 'Failed to poll device code',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/execute
 *
 * Execute the full provisioning flow
 * Requires successful authentication (access token in state)
 */
router.post('/execute', requireUnconfigured, async (req: Request, res: Response) => {
  try {
    const { provisioningId, adminEmail, adminPassword, adminDisplayName, cleanupFirst } = req.body;

    // Validate required fields
    if (!provisioningId) {
      return res.status(400).json({ error: 'Missing provisioningId' });
    }
    if (!adminEmail) {
      return res.status(400).json({ error: 'Missing adminEmail' });
    }
    if (!adminPassword) {
      return res.status(400).json({ error: 'Missing adminPassword' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password
    const passwordValidation = localUserService.validatePassword(adminPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Invalid password',
        details: passwordValidation.errors,
      });
    }

    // Get access token from state
    const accessToken = await provisioningStateService.getAccessToken(provisioningId);
    if (!accessToken) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please complete the device code flow first',
      });
    }

    // If cleanupFirst=true, delete orphaned apps before proceeding
    if (cleanupFirst) {
      console.log('[Provisioning] Auto-cleaning orphaned apps before executing...');
      try {
        const cleanupResult = await autoProvisioningService.cleanupOrphanedApps(accessToken);
        console.log(`[Provisioning] Cleanup result: ${cleanupResult.deleted} deleted, ${cleanupResult.errors.length} errors`);
      } catch (cleanupError: any) {
        console.warn('[Provisioning] Cleanup failed, but continuing with provisioning:', cleanupError.message);
      }
    }

    // Build redirect URI from request
    const protocol = req.secure ? 'https' : req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;

    // Execute provisioning
    const result = await autoProvisioningService.executeProvisioning({
      provisioningId,
      accessToken,
      redirectUri,
      adminEmail,
      adminPassword,
      adminDisplayName,
    });

    // Release provisioning lock after provisioning completes (success or failure)
    await autoProvisioningService.releaseProvisioningLock();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        config: result.config,
        duration: result.duration,
        // Signal that container restart is needed
        restartRequired: true,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        duration: result.duration,
      });
    }
  } catch (error: any) {
    console.error('[Provisioning] Error executing provisioning:', error.message);
    // Release lock on error too
    await autoProvisioningService.releaseProvisioningLock();
    res.status(500).json({
      error: 'Provisioning failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/provisioning/progress/:id
 *
 * Get provisioning progress and status
 */
router.get('/progress/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const progress = await autoProvisioningService.getProgress(id);

    if (progress.status === 'not_found') {
      return res.status(404).json({
        error: 'Provisioning session not found',
      });
    }

    res.json(progress);
  } catch (error: any) {
    console.error('[Provisioning] Error getting progress:', error.message);
    res.status(500).json({
      error: 'Failed to get progress',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/rollback/:id
 *
 * Manually trigger rollback for a failed provisioning
 */
router.post('/rollback/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get access token from state if still available
    const accessToken = await provisioningStateService.getAccessToken(id);

    await autoProvisioningService.rollback(id, accessToken || undefined);

    res.json({
      success: true,
      message: 'Rollback completed',
    });
  } catch (error: any) {
    console.error('[Provisioning] Error during rollback:', error.message);
    res.status(500).json({
      error: 'Rollback failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/restart
 *
 * Trigger container restart after successful provisioning
 * This endpoint:
 * 1. Signals fetcher to reload environment by setting a Redis flag
 * 2. Exits the API process so Docker restarts it with new env vars
 * Note: Does NOT use requireUnconfigured since we need to restart AFTER provisioning
 */
router.post('/restart', async (req: Request, res: Response) => {
  try {
    // Verify system is now configured
    const isConfigured = await autoProvisioningService.isSystemConfigured();
    if (!isConfigured) {
      return res.status(400).json({
        error: 'System not configured',
        message: 'Complete provisioning before restarting',
      });
    }

    // Signal fetcher to reload environment on next run
    const redis = (provisioningStateService as any).redis;
    if (redis) {
      await redis.set(
        'provisioning:fetcher_needs_reload',
        'true',
        'EX',
        300 // 5 minutes
      );
    }

    console.log('[Provisioning] Set fetcher reload flag in Redis');

    res.json({
      success: true,
      message: 'Configuration reloaded successfully. Fetcher will update within 60 seconds.',
    });

    // Perform soft-reload instead of process.exit
    setTimeout(async () => {
      try {
        console.log('[Provisioning] Performing soft reload of configuration...');
        // Refresh the environment manager cache
        await envManager.readEnv();
        console.log('[Provisioning] ✓ API internal state updated');
      } catch (err: any) {
        console.error('[Provisioning] Soft reload failed:', err.message);
      }
    }, 1000);
  } catch (error: any) {
    console.error('[Provisioning] Error triggering restart:', error.message);
    res.status(500).json({
      error: 'Failed to trigger restart',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/provisioning/cleanup-orphaned-apps
 *
 * Clean up orphaned Azure app registrations from failed provisioning attempts
 * Requires access token from device code flow
 *
 * Body parameters:
 * - accessToken: Azure AD access token with Application.ReadWrite.All permission
 * - tag: (optional) Specific tag to filter apps (default: DeviceInventory:AutoProvisioned)
 */
router.post('/cleanup-orphaned-apps', async (req: Request, res: Response) => {
  try {
    const { accessToken, tag } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Missing accessToken',
        message: 'Provide an Azure AD access token with Application.ReadWrite.All permission',
      });
    }

    const cleanupTag = tag || 'DeviceInventory:AutoProvisioned';
    const result = await autoProvisioningService.cleanupOrphanedApps(accessToken, cleanupTag);

    res.json({
      success: true,
      tag: cleanupTag,
      deleted: result.deleted,
      errors: result.errors,
      message: `Cleanup completed: ${result.deleted} app(s) deleted, ${result.errors.length} error(s)`,
    });
  } catch (error: any) {
    console.error('[Provisioning] Error during cleanup:', error.message);
    res.status(500).json({
      error: 'Cleanup failed',
      message: error.message,
    });
  }
});

export default router;
