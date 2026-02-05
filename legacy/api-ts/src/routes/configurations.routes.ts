// Configuration Profile Routes (Phase 3: API Migration)
import { Router, Request, Response, NextFunction } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';
import { ConfigurationRepository } from '../repositories/configuration.repository';
import type { ConfigPlatform } from '../schemas/device.schema';

/**
 * Helper function to decode base64-encoded payloads in settings
 * This makes the data more readable in the frontend
 */
function decodePayloads(settings: any): any {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }

  const decoded = { ...settings };

  // Decode the 'payload' field if it exists and looks like base64
  if (typeof decoded.payload === 'string' && decoded.payload.length > 100) {
    try {
      const decodedPayload = Buffer.from(decoded.payload, 'base64').toString('utf-8');
      decoded.payload_decoded = decodedPayload;
      decoded.payload_base64 = decoded.payload; // Keep original for reference
      decoded.payload = '[Base64 - See payload_decoded]'; // Replace with placeholder
    } catch (error) {
      // If decoding fails, leave it as is
      console.error('Failed to decode payload:', error);
    }
  }

  return decoded;
}

export function createConfigurationRoutes(client: Client): Router {
  const router = Router();
  const configRepo = new ConfigurationRepository(client);

  /**
   * @swagger
   * /api/configurations:
   *   get:
   *     tags:
   *       - Configurations
   *     summary: List configuration profiles with optional platform filtering
   *     description: Returns configuration profiles, optionally filtered by platform. Use latest=true to get only the latest version of each profile.
   *     parameters:
   *       - in: query
   *         name: platform
   *         schema:
   *           type: string
   *           enum: [windows, macOS, iOS, android, linux]
   *         description: Filter by platform
   *       - in: query
   *         name: latest
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Return only latest versions
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 500
   *     responses:
   *       200:
   *         description: List of configuration profiles
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        platform,
        latest = 'true',
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));
      const from = (pageNum - 1) * limitNum;

      // Build query
      const mustClauses: any[] = [];

      if (platform) {
        mustClauses.push({
          term: { platform: platform }
        });
      }

      // Build aggregation for latest versions if requested
      const query: any = {
        query: {
          bool: {
            must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }]
          }
        },
        size: limitNum,
        from,
        sort: [
          { last_modified_date: { order: 'desc' } },
          { config_id: { order: 'asc' } }
        ]
      };

      // If latest=true, use aggregation to get only latest versions
      if (latest === 'true') {
        // Use collapse to get only latest version of each config_id
        query.collapse = {
          field: 'config_id',
          inner_hits: {
            name: 'latest_version',
            size: 1,
            sort: [{ version: { order: 'desc' } }]
          }
        };
      }

      const response = await client.search({
        index: INDICES.CONFIGURATION_PROFILES,
        body: query
      });

      const hits = response.body.hits.hits;
      const total = response.body.hits.total.value;

      // Extract profiles
      const profiles = hits.map((hit: any) => {
        const source = latest === 'true' && hit.inner_hits?.latest_version?.hits?.hits[0]?._source
          ? hit.inner_hits.latest_version.hits.hits[0]._source
          : hit._source;

        return {
          config_id: source.config_id,
          version: source.version,
          display_name: source.display_name,
          description: source.description,
          platform: source.platform,
          created_date: source.created_date,
          last_modified_date: source.last_modified_date,
          is_active_reference: source.is_active_reference
        };
      });

      res.json({
        success: true,
        data: profiles,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/configurations/{id}:
   *   get:
   *     tags:
   *       - Configurations
   *     summary: Get latest version of a specific configuration profile
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Configuration profile ID
   *     responses:
   *       200:
   *         description: Configuration profile with full settings
   *       404:
   *         description: Profile not found
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get latest version
      const latest = await configRepo.getLatestVersion(id);

      if (!latest) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      // Get the full profile
      const profile = await configRepo.getProfileVersion(id, latest.version);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }

      // Decode base64 payloads in settings_payload for better readability
      if (profile.settings_payload) {
        profile.settings_payload = decodePayloads(profile.settings_payload);
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/configurations/{id}/versions:
   *   get:
   *     tags:
   *       - Configurations
   *     summary: Get all versions of a configuration profile
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of all profile versions
   */
  router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const response = await client.search({
        index: INDICES.CONFIGURATION_PROFILES,
        body: {
          query: {
            term: { config_id: id }
          },
          sort: [{ version: { order: 'desc' } }],
          size: 100 // Max 100 versions
        }
      });

      const versions = response.body.hits.hits.map((hit: any) => ({
        version: hit._source.version,
        content_hash: hit._source.content_hash,
        last_modified_date: hit._source.last_modified_date,
        is_active_reference: hit._source.is_active_reference
      }));

      res.json({
        success: true,
        data: {
          config_id: id,
          versions,
          total: response.body.hits.total.value
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/configurations/{id}/versions/{version}:
   *   get:
   *     tags:
   *       - Configurations
   *     summary: Get a specific version of a configuration profile
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: version
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Configuration profile version with full settings
   *       404:
   *         description: Version not found
   */
  router.get('/:id/versions/:version', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, version } = req.params;
      const versionNum = parseInt(version);

      const profile = await configRepo.getProfileVersion(id, versionNum);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile version not found'
        });
      }

      // Decode base64 payloads in settings_payload for better readability
      if (profile.settings_payload) {
        profile.settings_payload = decodePayloads(profile.settings_payload);
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/configurations/{id}/deployments:
   *   get:
   *     tags:
   *       - Configurations
   *     summary: Get deployment status across all devices for a profile
   *     description: Shows which devices have this configuration and their deployment status
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [success, pending, error, conflict, notApplicable]
   *         description: Filter by deployment status
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: List of devices with this configuration
   */
  router.get('/:id/deployments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        status,
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));
      const from = (pageNum - 1) * limitNum;

      // Build query to find devices with this config
      // Note: configuration.references is NOT nested type (see mapping), so use regular terms query
      const mustClauses: any[] = [
        {
          term: { 'configuration.references.config_id.keyword': id }
        }
      ];

      // Add status filter if provided
      if (status) {
        mustClauses.push({
          term: { 'configuration.references.deployment_status.keyword': status }
        });
      }

      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          query: {
            bool: {
              must: mustClauses
            }
          },
          _source: [
            'id',
            'deviceName',
            'operatingSystem',
            'userPrincipalName',
            'configuration.references'
          ],
          size: limitNum,
          from
        }
      });

      const devices = response.body.hits.hits.map((hit: any) => {
        const device = hit._source;
        const configRef = device.configuration?.references?.find(
          (ref: any) => ref.config_id === id
        );

        return {
          device_id: device.id,
          device_name: device.deviceName,
          operating_system: device.operatingSystem,
          user_principal_name: device.userPrincipalName,
          deployment_status: configRef?.deployment_status,
          result_code: configRef?.result_code,
          last_evaluated: configRef?.last_evaluated
        };
      });

      res.json({
        success: true,
        data: devices,
        pagination: {
          total: response.body.hits.total.value,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(response.body.hits.total.value / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
