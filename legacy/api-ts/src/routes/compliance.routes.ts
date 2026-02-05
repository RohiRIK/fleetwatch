// Compliance Policy Routes (Phase 3: API Migration)
import { Router, Request, Response, NextFunction } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';
import { ComplianceRepository } from '../repositories/compliance.repository';
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

export function createComplianceRoutes(client: Client): Router {
  const router = Router();
  const complianceRepo = new ComplianceRepository(client);

  /**
   * @swagger
   * /api/v2/compliance:
   *   get:
   *     tags:
   *       - Compliance
   *     summary: List compliance policies with optional platform filtering
   *     description: Returns compliance policies, optionally filtered by platform. Use latest=true to get only the latest version of each policy.
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
   *         description: List of compliance policies
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
          { policy_id: { order: 'asc' } }
        ]
      };

      // If latest=true, use aggregation to get only latest versions
      if (latest === 'true') {
        // Use collapse to get only latest version of each policy_id
        query.collapse = {
          field: 'policy_id',
          inner_hits: {
            name: 'latest_version',
            size: 1,
            sort: [{ version: { order: 'desc' } }]
          }
        };
      }

      const response = await client.search({
        index: INDICES.COMPLIANCE_POLICIES,
        body: query
      });

      const hits = response.body.hits.hits;
      const total = response.body.hits.total.value;

      // Extract policies
      const policies = hits.map((hit: any) => {
        const source = latest === 'true' && hit.inner_hits?.latest_version?.hits?.hits[0]?._source
          ? hit.inner_hits.latest_version.hits.hits[0]._source
          : hit._source;

        return {
          policy_id: source.policy_id,
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
        data: policies,
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
   * /api/v2/compliance/{id}:
   *   get:
   *     tags:
   *       - Compliance
   *     summary: Get latest version of a specific compliance policy
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Compliance policy ID
   *     responses:
   *       200:
   *         description: Compliance policy with full settings
   *       404:
   *         description: Policy not found
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get latest version
      const latest = await complianceRepo.getLatestVersion(id);

      if (!latest) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      // Get the full policy
      const policy = await complianceRepo.getPolicyVersion(id, latest.version);

      if (!policy) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      // Decode base64 payloads in settings_payload for better readability
      if (policy.settings_payload) {
        policy.settings_payload = decodePayloads(policy.settings_payload);
      }

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/compliance/{id}/versions:
   *   get:
   *     tags:
   *       - Compliance
   *     summary: Get all versions of a compliance policy
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of all policy versions
   */
  router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const response = await client.search({
        index: INDICES.COMPLIANCE_POLICIES,
        body: {
          query: {
            term: { policy_id: id }
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
          policy_id: id,
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
   * /api/v2/compliance/{id}/versions/{version}:
   *   get:
   *     tags:
   *       - Compliance
   *     summary: Get a specific version of a compliance policy
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
   *         description: Compliance policy version with full settings
   *       404:
   *         description: Version not found
   */
  router.get('/:id/versions/:version', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, version } = req.params;
      const versionNum = parseInt(version);

      const policy = await complianceRepo.getPolicyVersion(id, versionNum);

      if (!policy) {
        return res.status(404).json({
          success: false,
          error: 'Policy version not found'
        });
      }

      // Decode base64 payloads in settings_payload for better readability
      if (policy.settings_payload) {
        policy.settings_payload = decodePayloads(policy.settings_payload);
      }

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/compliance/{id}/deployments:
   *   get:
   *     tags:
   *       - Compliance
   *     summary: Get deployment status across all devices for a policy
   *     description: Shows which devices have this compliance policy and their compliance status
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
   *           enum: [compliant, noncompliant, error, conflict, notApplicable]
   *         description: Filter by compliance status
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
   *         description: List of devices with this compliance policy
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

      // Build query to find devices with this policy
      // Note: compliance.references uses nested type (see mapping)
      const mustClauses: any[] = [
        {
          nested: {
            path: 'compliance.references',
            query: {
              term: { 'compliance.references.policy_id': id }
            }
          }
        }
      ];

      // Add status filter if provided
      if (status) {
        mustClauses.push({
          nested: {
            path: 'compliance.references',
            query: {
              term: { 'compliance.references.deployment_status': status }
            }
          }
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
            'compliance.references',
            'compliance.state'
          ],
          size: limitNum,
          from
        }
      });

      const devices = response.body.hits.hits.map((hit: any) => {
        const device = hit._source;
        const policyRef = device.compliance?.references?.find(
          (ref: any) => ref.policy_id === id
        );

        return {
          device_id: device.id,
          device_name: device.deviceName,
          operating_system: device.operatingSystem,
          user_principal_name: device.userPrincipalName,
          compliance_state: device.compliance?.state,
          deployment_status: policyRef?.deployment_status,
          result_code: policyRef?.result_code,
          error_count: policyRef?.error_count,
          total_settings: policyRef?.total_settings,
          last_evaluated: policyRef?.last_evaluated
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
