// Device Query Routes for Frontend
import { Router, Request, Response, NextFunction } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';

export function createDeviceRoutes(client: Client): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/devices:
   *   get:
   *     tags:
   *       - Devices
   *     summary: Query devices with filters and pagination
   *     description: Search and filter devices with full-text search, OS/manufacturer filters, compliance filters, sorting, and pagination
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Full-text search across device name, user, serial, model
   *       - in: query
   *         name: os
   *         schema:
   *           type: string
   *           enum: [Windows, macOS, iOS, Android]
   *         description: Filter by operating system
   *       - in: query
   *         name: manufacturer
   *         schema:
   *           type: string
   *         description: Filter by manufacturer (LENOVO, Apple, Dell, HP, etc.)
   *       - in: query
   *         name: compliant
   *         schema:
   *           type: boolean
   *         description: Filter by compliance status
   *       - in: query
   *         name: managed
   *         schema:
   *           type: boolean
   *         description: Filter by managed status
   *       - in: query
   *         name: encrypted
   *         schema:
   *           type: boolean
   *         description: Filter by encryption status
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           default: lastSyncDateTime
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort direction
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 1000
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Paginated list of devices
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedDevices'
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        search,
        os,
        manufacturer,
        compliant,
        managed,
        encrypted,
        issue,
        sortBy = 'lastSyncDateTime',
        sortOrder = 'desc',
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(10000, Math.max(1, parseInt(limit as string)));
      const from = (pageNum - 1) * limitNum;

      // Build query
      const must: any[] = [];
      const filter: any[] = [];

      // Full-text search
      if (search) {
        must.push({
          multi_match: {
            query: search,
            fields: [
              'deviceName^3',
              'userDisplayName^2',
              'userPrincipalName^2',
              'serialNumber',
              'model',
              'manufacturer'
            ],
            fuzziness: 'AUTO'
          }
        });
      }

      // Issue-based filters
      if (issue) {
        switch (issue) {
          case 'offline':
            // Devices not synced in last 7 days
            filter.push({
              range: {
                lastSyncDateTime: { lte: 'now-7d' }
              }
            });
            break;
          case 'compliance_failed':
            // Non-compliant devices
            filter.push({
              bool: {
                should: [
                  { term: { isCompliant: false } },
                  { term: { 'compliance.state': 'noncompliant' } }
                ],
                minimum_should_match: 1
              }
            });
            break;
          case 'battery_low':
            // Battery health < 80%
            filter.push({
              range: {
                'analytics.battery.maxCapacityPercentage': { lt: 80 }
              }
            });
            break;
          case 'bsod_errors':
            // Devices with BSOD errors
            filter.push({
              range: {
                'analytics.startup.blueScreenCount': { gt: 0 }
              }
            });
            break;
          case 'warranty_expiring':
            // Warranty expiring within 90 days
            filter.push({
              range: {
                'warranty.endDate': { lte: 'now+90d', gte: 'now' }
              }
            });
            break;
          case 'low_storage':
            // Devices with < 20% free storage
            filter.push({
              bool: {
                must: [
                  { exists: { field: 'hardware.totalStorageSpaceInBytes' } },
                  { range: { 'hardware.freeStorageSpaceInBytes': { gt: 0 } } },
                  { range: { 'hardware.totalStorageSpaceInBytes': { gt: 0 } } }
                ],
                filter: {
                  script: {
                    script: {
                      source: "(doc['hardware.freeStorageSpaceInBytes'].value.doubleValue() / doc['hardware.totalStorageSpaceInBytes'].value.doubleValue()) < 0.20",
                      lang: 'painless'
                    }
                  }
                }
              }
            });
            break;
          case 'outdated_os':
            // Windows 10 devices (outdated OS)
            filter.push({
              bool: {
                must: [
                  { term: { operatingSystem: 'Windows' } },
                  { prefix: { osVersion: '10.0.19' } }
                ]
              }
            });
            break;
          case 'excessive_crashes':
            // Devices with >= 3 blue screens
            filter.push({
              range: {
                'analytics.startup.blueScreenCount': { gte: 3 }
              }
            });
            break;
          case 'poor_health':
            // Devices with overall health score < 70
            filter.push({
              range: {
                'analytics.scores.overall': { lt: 70, gte: 0 }
              }
            });
            break;
          case 'slow_startup':
            // Devices with startup score < 60
            filter.push({
              range: {
                'analytics.scores.startup': { lt: 60, gte: 0 }
              }
            });
            break;
          case 'frequent_restarts':
            // Devices with > 20 restarts
            filter.push({
              range: {
                'analytics.startup.restartCount': { gt: 20 }
              }
            });
            break;
          case 'legacy_storage':
            // Devices with non-SSD storage
            filter.push({
              bool: {
                must_not: [
                  { term: { 'analytics.startup.diskType.keyword': 'SSD' } }
                ],
                must: [
                  { exists: { field: 'analytics.startup.diskType' } }
                ]
              }
            });
            break;
          case 'reboot_required':
            // Devices with pending reboot
            filter.push({
              term: {
                'deviceManagement.restartRequired': true
              }
            });
            break;
          case 'pending_updates':
            // Devices with pending updates
            filter.push({
              bool: {
                should: [
                  { term: { 'deviceManagement.windowsUpdatesPending': true } },
                  { range: { 'deviceManagement.pendingUpdateCount': { gt: 0 } } }
                ],
                minimum_should_match: 1
              }
            });
            break;
          case 'not_encrypted':
            // Encryption disabled (All platforms)
            filter.push({
              term: { isEncrypted: false }
            });
            break;
          case 'jailbroken':
            // Jailbroken or rooted devices
            filter.push({
              bool: {
                should: [
                  { term: { 'security.isJailbroken': true } },
                  { term: { 'security.isRooted': true } }
                ],
                minimum_should_match: 1
              }
            });
            break;
        }
      }

      // Filters
      if (os) filter.push({ term: { operatingSystem: os } });
      if (manufacturer) filter.push({ term: { manufacturer: manufacturer } });
      if (compliant !== undefined) filter.push({ term: { complianceState: compliant === 'true' ? 'compliant' : 'noncompliant' } });
      if (managed !== undefined) filter.push({ term: { managedDeviceOwnerType: managed === 'true' ? 'company' : 'personal' } });
      if (encrypted !== undefined) filter.push({ term: { isEncrypted: encrypted === 'true' } });

      const body: any = {
        from,
        size: limitNum,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter: filter.length > 0 ? filter : undefined
          }
        },
        sort: [
          { [sortBy as string]: { order: sortOrder, unmapped_type: 'date', missing: '_last' } }
        ],
        track_total_hits: true
      };

      const response = await client.search({
        index: INDICES.DEVICES,
        body
      });

      const hits = response.body.hits;
      const devices = hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score
      }));

      res.json({
        success: true,
        data: devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: hits.total.value,
          pages: Math.ceil(hits.total.value / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/devices/{id}:
   *   get:
   *     tags:
   *       - Devices
   *     summary: Get single device by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Device ID
   *     responses:
   *       200:
   *         description: Device details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Device'
   *       404:
   *         description: Device not found
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const response = await client.get({
        index: INDICES.DEVICES,
        id
      });

      res.json({
        success: true,
        data: response.body._source
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/devices/stats/summary:
   *   get:
   *     tags:
   *       - Devices
   *     summary: Get device statistics summary
   *     description: Aggregated statistics for devices by OS, manufacturer, model, compliance, and encryption status
   *     responses:
   *       200:
   *         description: Device statistics summary
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
   *                     total:
   *                       type: number
   *                       example: 2247
   *                     by_os:
   *                       type: array
   *                       items:
   *                         type: object
   *                     by_manufacturer:
   *                       type: array
   *                       items:
   *                         type: object
   *                     compliance:
   *                       type: array
   *                       items:
   *                         type: object
   *                     encrypted:
   *                       type: array
   *                       items:
   *                         type: object
   */
  router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            total: { value_count: { field: 'id' } },
            by_os: {
              terms: { field: 'operatingSystem', size: 20 }
            },
            by_manufacturer: {
              terms: { field: 'manufacturer', size: 20 }
            },
            by_model: {
              terms: { field: 'model', size: 20 }
            },
            compliance: {
              terms: { field: 'isCompliant' }
            },
            encrypted: {
              terms: { field: 'isEncrypted' }
            },
            managed_vs_personal: {
              terms: { field: 'managedDeviceOwnerType' }
            }
          }
        }
      });

      const aggs = response.body.aggregations;

      res.json({
        success: true,
        data: {
          total: aggs.total.value,
          by_os: aggs.by_os.buckets,
          by_manufacturer: aggs.by_manufacturer.buckets,
          by_model: aggs.by_model.buckets,
          compliance: aggs.compliance.buckets,
          encrypted: aggs.encrypted.buckets,
          managed_vs_personal: aggs.managed_vs_personal.buckets
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/devices/stats/compliance:
   *   get:
   *     tags:
   *       - Devices
   *     summary: Get compliance statistics
   *     description: Detailed compliance breakdown by OS and grace period expiration
   *     responses:
   *       200:
   *         description: Compliance statistics
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
   *                     compliance_by_os:
   *                       type: object
   *                     compliance_grace:
   *                       type: object
   */
  router.get('/stats/compliance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            compliance_by_os: {
              terms: { field: 'operatingSystem' },
              aggs: {
                compliant: {
                  filter: { term: { isCompliant: true } }
                },
                non_compliant: {
                  filter: { term: { isCompliant: false } }
                }
              }
            },
            compliance_grace: {
              terms: { field: 'complianceGracePeriodExpirationDateTime' },
              aggs: {
                count: { value_count: { field: 'id' } }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.aggregations
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/devices/stats/security:
   *   get:
   *     tags:
   *       - Devices
   *     summary: Get security statistics
   *     description: Security metrics including encryption, supervision, and jailbreak status
   *     responses:
   *       200:
   *         description: Security statistics
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
   *                     encryption_status:
   *                       type: object
   *                     supervised_status:
   *                       type: object
   *                     jailbroken_status:
   *                       type: object
   */
  router.get('/stats/security', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            encryption_status: {
              terms: { field: 'isEncrypted' }
            },
            supervised_status: {
              terms: { field: 'isSupervised' }
            },
            jailbroken_status: {
              terms: { field: 'jailBroken' }
            },
            activation_lock: {
              terms: { field: 'activationLockBypassCode' }
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.aggregations
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/devices/search/advanced:
   *   post:
   *     tags:
   *       - Devices
   *     summary: Advanced device search
   *     description: Execute complex queries using OpenSearch DSL-like structure
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               must:
   *                 type: array
   *                 description: Terms that must match
   *               should:
   *                 type: array
   *                 description: Terms that should match
   *               filter:
   *                 type: array
   *                 description: Filter clauses
   *               sort:
   *                 type: array
   *                 description: Sort definitions
   *               from:
   *                 type: integer
   *               size:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedDevices'
   */
  router.post('/search/advanced', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        must = [],
        should = [],
        must_not = [],
        filter = [],
        sort = [{ lastSyncDateTime: 'desc' }],
        from = 0,
        size = 50
      } = req.body;

      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : undefined,
              should: should.length > 0 ? should : undefined,
              must_not: must_not.length > 0 ? must_not : undefined,
              filter: filter.length > 0 ? filter : undefined
            }
          },
          sort,
          from,
          size,
          track_total_hits: true
        }
      });

      const hits = response.body.hits;

      res.json({
        success: true,
        data: hits.hits.map((hit: any) => ({ ...hit._source, _score: hit._score })),
        total: hits.total.value
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
