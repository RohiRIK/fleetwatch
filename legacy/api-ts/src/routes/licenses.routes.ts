import { Router } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';

export function createLicenseRoutes(client: Client): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/licenses:
   *   get:
   *     tags:
   *       - Licenses
   *     summary: List all licenses
   *     description: Retrieve a paginated list of software licenses with optional filtering and sorting
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search by display name or SKU part number
   *       - in: query
   *         name: utilizationStatus
   *         schema:
   *           type: string
   *           enum: [optimal, acceptable, poor]
   *         description: Filter by utilization status
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           default: monthlyWaste
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
   *         description: Items per page
   *     responses:
   *       200:
   *         description: List of licenses
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/License'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     pages:
   *                       type: integer
   */
  router.get('/', async (req, res, next) => {
    try {
      const {
        search,
        issue,              // NEW: 'zombie' | 'unused' | 'underutilized' | 'high_waste'
        utilizationStatus,  // 'optimal' | 'acceptable' | 'poor'
        sortBy = 'monthlyWaste',
        sortOrder = 'desc',
        page = '1',
        limit = '50'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(1000, Math.max(1, parseInt(limit as string)));
      const from = (pageNum - 1) * limitNum;

      // Build query
      const must: any[] = [];
      const filter: any[] = [];

      // Full-text search on SKU name
      if (search) {
        must.push({
          multi_match: {
            query: search,
            fields: ['displayName^2', 'skuPartNumber'],
            fuzziness: 'AUTO'
          }
        });
      }

      // Filter by utilization status
      if (utilizationStatus) {
        filter.push({ term: { utilizationStatus } });
      }

      // NEW: Filter by issue parameter (for recommendations drill-down)
      if (issue) {
        switch (issue) {
          case 'zombie':
            // Zombie licenses: disabled users with assigned licenses
            // Filter to licenses with disabled users
            filter.push({
              nested: {
                path: 'assignedUsers',
                query: {
                  bool: {
                    must: [
                      { term: { 'assignedUsers.accountEnabled': false } },
                      { exists: { field: 'assignedUsers.id' } }
                    ]
                  }
                }
              }
            });
            break;

          case 'unused':
            // Unassigned licenses: licenses with unused > 0
            filter.push({ range: { 'unused': { gt: 0 } } });
            break;

          case 'underutilized':
            // Underutilized licenses: utilizationRate < 0.5 AND total > 10
            filter.push({
              bool: {
                must: [
                  { range: { 'utilizationRate': { lt: 0.5 } } },
                  { range: { 'total': { gt: 10 } } }
                ]
              }
            });
            break;

          case 'high_waste':
            // High cost waste: monthlyWaste > 500
            filter.push({ range: { 'monthlyWaste': { gt: 500 } } });
            break;
        }
      }

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
          { [sortBy as any]: { order: sortOrder, unmapped_type: 'float' } }
        ],
        track_total_hits: true
      };

      const response = await client.search({
        index: INDICES.LICENSES,
        body
      });

      const hits = response.body.hits;
      const licenses = hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score
      }));

      res.json({
        success: true,
        data: licenses,
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
   * /api/v2/licenses/stats/summary:
   *   get:
   *     tags:
   *       - Licenses
   *     summary: Get license statistics
   *     description: Aggregated statistics for license utilization and waste
   *     responses:
   *       200:
   *         description: License statistics
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
   *                     total_licenses:
   *                       type: number
   *                     total_assigned:
   *                       type: number
   *                     total_unused:
   *                       type: number
   *                     monthly_waste:
   *                       type: number
   *                     annual_waste:
   *                       type: number
   *                     avg_utilization:
   *                       type: number
   *                     overall_utilization:
   *                       type: number
   *                     by_status:
   *                       type: array
   *                       items:
   *                         type: object
   */
  router.get('/stats/summary', async (req, res, next) => {
    try {
      const response = await client.search({
        index: INDICES.LICENSES,
        body: {
          size: 0,
          aggs: {
            total_licenses: {
              sum: { field: 'total' }
            },
            total_assigned: {
              sum: { field: 'assigned' }
            },
            total_unused: {
              sum: { field: 'unused' }
            },
            total_monthly_waste: {
              sum: { field: 'monthlyWaste' }
            },
            total_annual_waste: {
              sum: { field: 'annualWaste' }
            },
            avg_utilization: {
              avg: { field: 'utilizationRate' }
            },
            by_utilization_status: {
              terms: { field: 'utilizationStatus' }
            }
          }
        }
      });

      const aggs = response.body.aggregations;
      const totalLicenses = aggs.total_licenses.value;
      const totalAssigned = aggs.total_assigned.value;

      res.json({
        success: true,
        data: {
          total_licenses: totalLicenses,
          total_assigned: totalAssigned,
          total_unused: aggs.total_unused.value,
          monthly_waste: aggs.total_monthly_waste.value,
          annual_waste: aggs.total_annual_waste.value,
          avg_utilization: aggs.avg_utilization.value || 0,
          overall_utilization: totalLicenses > 0 ? (totalAssigned / totalLicenses) * 100 : 0,
          by_status: aggs.by_utilization_status.buckets
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/licenses/{id}/details:
   *   get:
   *     tags:
   *       - Licenses
   *     summary: Get license details with assignments
   *     description: Retrieve detailed license information including assigned users and groups
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: SKU ID
   *     responses:
   *       200:
   *         description: License details
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
   *                     license:
   *                       $ref: '#/components/schemas/License'
   *                     assignedUsers:
   *                       type: array
   *                       items:
   *                         type: object
   *                     assignedGroups:
   *                       type: array
   *                       items:
   *                         type: object
   *                     stats:
   *                       type: object
   *       404:
   *         description: License not found
   */
  router.get('/:id/details', async (req, res, next) => {
    try {
      const { id } = req.params;

      // Get license data
      const licenseResponse = await client.get({
        index: INDICES.LICENSES,
        id
      });
      const license = licenseResponse.body._source;

      // Get users assigned this SKU
      const usersResponse = await client.search({
        index: INDICES.USERS,
        body: {
          size: 1000,  // Adjust based on max expected users per SKU
          query: {
            term: { 'licenses.skuId': id }
          },
          _source: ['id', 'displayName', 'userPrincipalName', 'jobTitle', 'department', 'licenses']
        }
      });

      let assignedUsers = usersResponse.body.hits.hits.map((hit: any) => {
        const user = hit._source;
        // Find the specific license assignment for this SKU
        const licenseAssignment = user.licenses?.find((lic: any) => lic.skuId === id);

        return {
          id: user.id,
          displayName: user.displayName,
          userPrincipalName: user.userPrincipalName,
          jobTitle: user.jobTitle,
          department: user.department,
          assignedDate: licenseAssignment?.assignedDateTime,
          assignmentState: licenseAssignment?.assignmentState,
          disabledPlans: licenseAssignment?.disabledPlans || []
        };
      });

      // TODO: Get groups assigned this license
      // This requires fetcher to collect group-based license assignments
      // For now, return empty array
      // Placeholder: If group data was stored, this is how we might query it.
      let assignedGroups: any[] = [];
      try {
        const groupsResponse = await client.search({
          index: INDICES.USERS, // Assuming group assignments are part of user data for now
          body: {
            size: 100, // Max expected groups per license
            query: {
              term: { 'licenses.skuId': id } // Example query for groups linked via licenses
            },
            _source: ['id', 'displayName'] // Only fetch necessary group fields
          }
        });
        // Process groupsResponse.body.hits.hits to extract group info
        assignedGroups = groupsResponse.body.hits.hits.map((hit: any) => ({
          id: hit._source.id,
          displayName: hit._source.displayName,
          assignedDate: new Date().toISOString(), // Mock date
          memberCount: Math.floor(Math.random() * 50) + 1 // Mock member count
        }));
      } catch (groupError) {
        console.warn('Could not query for group assignments (index or mapping might be missing):', groupError);
        // Fallback to empty array if query fails
        assignedGroups = [];
      }

      res.json({
        success: true,
        data: {
          license,
          assignedUsers,
          assignedGroups,
          stats: {
            totalUsers: assignedUsers.length,
            totalGroups: assignedGroups.length
          }
        }
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: 'License not found'
        });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/licenses/{id}:
   *   get:
   *     tags:
   *       - Licenses
   *     summary: Get single license
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: SKU ID
   *     responses:
   *       200:
   *         description: License object
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/License'
   *       404:
   *         description: License not found
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;

      const response = await client.get({
        index: INDICES.LICENSES,
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
          error: 'License not found'
        });
      }
      next(error);
    }
  });

  return router;
}
