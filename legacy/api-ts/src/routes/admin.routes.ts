import { Router } from 'express';
import type { Request, Response } from 'express';
import { INDICES } from '../config/opensearch';
import type { Client } from '@opensearch-project/opensearch';
import { onboardingRoutes } from './onboarding.routes'; // Import onboarding routes here to merge them
import { promises as fs } from 'fs';
import { normalizeDevices } from '../normalizers/device-normalizer';
import { normalizeUsers } from '../normalizers/user-normalizer';
import { normalizeLicenses } from '../normalizers/license-normalizer';
import { IngestService } from '../services/ingest.service';
import { platformUserService } from '../services/platform-user.service';
import { keyManagementService } from '../services/key-management.service';
import { envManager } from '../services/env-manager.service';
import { requireAuth } from '../middleware/session-auth.middleware';

export function createAdminRoutes(client: Client): Router {
  const router = Router();
  const ingestService = new IngestService(client);

  // Get last sync status
  router.get('/sync/status', async (req: Request, res: Response) => {
    try {
      const result = await client.get({
        index: INDICES.METADATA,
        id: 'last_sync_status'
      });

      res.json(result.body._source);
    } catch (error: any) {
      if (error.meta && error.meta.statusCode === 404) {
        res.json({ status: 'never_run' });
      } else {
        res.status(500).json({ error: 'Failed to fetch sync status' });
      }
    }
  });

  // Mount onboarding routes
  // We can mount them directly here since they are also "admin" routes
  // Note: onboardingRoutes itself assumes a global client currently,
  // we should probably refactor it too, but for now let's just mount it.
  router.use('/', onboardingRoutes);

  /**
   * GET /admin/users
   * List all platform users (Local and SSO)
   */
  router.get('/users', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const users = await platformUserService.listUsers(req.query);
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PATCH /admin/users/:id
   * Update a platform user's role
   */
  router.patch('/users/:id', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      await platformUserService.updateRole(id, role);
      res.json({ success: true, message: 'User role updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /admin/users/:id
   * Remove a platform user
   */
  router.delete('/users/:id', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      if (id === req.user?.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }

      await platformUserService.deleteUser(id);
      res.json({ success: true, message: 'User removed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /admin/settings/integrations
   * Get configured integration keys (masked)
   */
  router.get('/settings/integrations', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const vars = await envManager.readEnv();
      const keys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GEMINI_KEY',
        'LENOVO_CLIENT_ID',
        'LENOVO_CLIENT_SECRET'
      ];

      const result: Record<string, any> = {};
      for (const key of keys) {
        const value = vars[key];
        result[key] = value ? `********${value.slice(-4)}` : null;
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/settings/integrations
   * Update integration keys
   */
  router.post('/settings/integrations', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const updates = req.body;
      const allowedKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GOOGLE_GEMINI_KEY',
        'LENOVO_CLIENT_ID',
        'LENOVO_CLIENT_SECRET'
      ];

      const cleanUpdates: Record<string, string> = {};
      for (const key of allowedKeys) {
        if (updates[key] !== undefined) {
          // If value is masked (starts with stars), it means user didn't change it
          if (typeof updates[key] === 'string' && updates[key].startsWith('****')) {
            continue;
          }
          cleanUpdates[key] = updates[key];
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        return res.json({ success: true, message: 'No changes to apply' });
      }

      await envManager.updateEnv(cleanUpdates);
      res.json({ success: true, message: 'Settings updated' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /admin/settings/ai-config
   * Get AI provider status (masked) and active configuration
   */
  router.get('/settings/ai-config', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const providers = ['openai', 'anthropic', 'gemini'];
      const result: Record<string, any> = {
        keys: {},
        activeProvider: await keyManagementService.getActiveProvider(),
        activeModel: ''
      };

      for (const p of providers) {
        const key = await keyManagementService.getKey(p);
        result.keys[p] = key ? `••••••••${key.slice(-4)}` : null;
      }

      result.activeModel = await keyManagementService.getActiveModel(result.activeProvider);

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/settings/ai-config
   * Securely save AI keys, active provider, and active model to Redis
   */
  router.post('/settings/ai-config', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { provider, key, activeProvider, activeModel } = req.body;

      if (provider && key) {
        // If value is masked, it means user didn't change it
        if (!key.startsWith('••••')) {
          await keyManagementService.saveKey(provider, key);
        }
      }

      if (activeProvider) {
        await keyManagementService.setActiveProvider(activeProvider);
      }

      if (activeModel) {
        await keyManagementService.setActiveModel(activeModel);
      }
      
      res.json({ success: true, message: 'AI Configuration updated successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /admin/settings/ai-config
   * Delete an AI provider key
   */
  router.delete('/settings/ai-config', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { provider } = req.query;

      if (!provider || typeof provider !== 'string') {
        return res.status(400).json({ error: 'Provider is required' });
      }

      await keyManagementService.deleteKey(provider);
      res.json({ success: true, message: `Key for ${provider} deleted` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/ingest/devices-from-disk
   * Trigger ingestion of devices and users from JSON files on disk
   */
  router.post('/ingest/devices-from-disk', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      console.log('[Admin] Triggered devices ingestion from disk');

      const paths = {
        devices: '/data/data.json',
        users: '/data/users.json',
        licenses: '/data/licenses.json',
        warranty: '/data/warranty.json',
        compliance: '/data/device-compliance.json',
        configurations: '/data/device-configurations.json',
        crashes: '/data/app_crashes.json',
        securityAccess: '/data/security-access.json',
        uxaMetrics: '/data/uxa_metrics.json'
      };

      const results: any = {
        devices: { status: 'skipped', count: 0 },
        users: { status: 'skipped', count: 0 },
        licenses: { status: 'skipped', count: 0 },
        uxaAnalytics: { status: 'skipped', count: 0 },
        duration: 0
      };

      const startTime = Date.now();

      const readJson = async (path: string): Promise<any | null> => {
        try {
          await fs.access(path);
          const stats = await fs.stat(path);
          if (stats.size > 50 * 1024 * 1024) {
            console.warn(`[Admin] Skipping file ${path} (size ${stats.size} bytes > 50MB limit)`);
            return null;
          }
          const content = await fs.readFile(path, 'utf-8');
          return JSON.parse(content);
        } catch (e) {
          return null;
        }
      };

      const [deviceData, userData, licenseData, warrantyData, complianceData, configurationData, crashData, securityAccessData, uxaMetricsData] = await Promise.all([
        readJson(paths.devices),
        readJson(paths.users),
        readJson(paths.licenses),
        readJson(paths.warranty),
        readJson(paths.compliance),
        readJson(paths.configurations),
        readJson(paths.crashes),
        readJson(paths.securityAccess),
        readJson(paths.uxaMetrics)
      ]);

      if (!deviceData && !userData) {
        return res.status(404).json({ error: 'No data files found in /data' });
      }

      const fetcherOutput: any = {
        managedDevices: deviceData?.managedDevices || [],
        users: userData?.users || [],
        warranty: warrantyData?.items ? Object.values(warrantyData.items) : undefined,
        deviceComplianceStatus: complianceData?.deviceComplianceStates,
        compliancePolicies: complianceData?.policies,
        deviceConfigurationStatus: configurationData?.deviceConfigurationStates,
        configurationPolicies: configurationData?.configurations,
        crashes: crashData?.crashes || undefined,
        securityAccess: securityAccessData
      };

      // Ingest Devices
      if (fetcherOutput.managedDevices.length > 0) {
        const normalizedDevices = await normalizeDevices(fetcherOutput, {
          enableDualWrite: true,
          opensearchClient: client
        });

        const deviceResult = await ingestService.ingestDevices(normalizedDevices, {
          refresh: true,
          mode: 'upsert'
        });

        results.devices = {
          status: deviceResult.success ? 'success' : 'partial_failure',
          count: deviceResult.indexed,
          failed: deviceResult.failed
        };
      }

      // Ingest Users
      if (fetcherOutput.users.length > 0) {
        const normalizedDevices = fetcherOutput.managedDevices.length > 0 ?
          await normalizeDevices(fetcherOutput) : undefined;

        const normalizedUsers = normalizeUsers(fetcherOutput, {}, normalizedDevices);

        const userResult = await ingestService.ingestUsers(normalizedUsers, {
          refresh: true
        });

        results.users = {
          status: userResult.success ? 'success' : 'partial_failure',
          count: userResult.indexed,
          failed: userResult.failed
        };
      }

      // Ingest Licenses
      if (licenseData?.subscribedSkus) {
        const normalizedLicenses = normalizeLicenses(licenseData);
        const licenseResult = await ingestService.ingestLicenses(normalizedLicenses, {
          refresh: true,
          mode: 'upsert'
        });

        results.licenses = {
          status: licenseResult.success ? 'success' : 'partial_failure',
          count: licenseResult.indexed,
          failed: licenseResult.failed
        };
      }

      // Ingest Conditional Access Policies
      if (fetcherOutput.securityAccess?.conditionalAccessPolicies) {
        const caResult = await ingestService.ingestConditionalAccessPolicies(
          fetcherOutput.securityAccess.conditionalAccessPolicies, 
          {
            refresh: true
          }
        );
        
        results.conditionalAccess = {
          status: caResult.success ? 'success' : 'partial_failure',
          count: caResult.indexed,
          failed: caResult.failed
        };
      }

      // Ingest UXA Analytics
      if (uxaMetricsData && Array.isArray(uxaMetricsData)) {
        const uxaResult = await ingestService.ingestExperienceMetrics(uxaMetricsData, {
          refresh: true
        });

        results.uxaAnalytics = {
          status: uxaResult.success ? 'success' : 'partial_failure',
          count: uxaResult.indexed,
          failed: uxaResult.failed
        };
      }

      results.duration = Date.now() - startTime;

      // Save sync metadata
      try {
        await client.index({
          index: INDICES.METADATA,
          id: 'last_sync_status',
          body: {
            key: 'last_sync_status',
            lastRun: new Date().toISOString(),
            status: 'success',
            durationMs: results.duration,
            stats: {
              devices: results.devices.count,
              users: results.users.count
            },
            updatedAt: new Date().toISOString()
          },
          refresh: true
        });
      } catch (metaError) {
        console.error('Failed to save sync metadata:', metaError);
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Devices ingestion from disk failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /admin/ingest/trends-from-disk
   * Placeholder for trends ingestion (already handled in normal sync but provided for compatibility)
   */
  router.post('/ingest/trends-from-disk', async (req: Request, res: Response) => {
    res.json({ success: true, message: 'Trends ingestion handled during device ingestion' });
  });

  /**
   * POST /admin/ingest/abm-from-disk
   * Placeholder for ABM ingestion
   */
  router.post('/ingest/abm-from-disk', async (req: Request, res: Response) => {
    res.json({ success: true, message: 'ABM ingestion not implemented yet' });
  });

  return router;
}
