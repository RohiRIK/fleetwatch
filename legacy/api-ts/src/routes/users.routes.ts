// User Query Routes for Frontend
import { Router, Request, Response, NextFunction } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';

export function createUserRoutes(client: Client): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/users:
   *   get:
   *     tags:
   *       - Users
   *     summary: Query users
   *     description: Search and filter users with full-text search, department filters, sorting, and pagination
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Full-text search across display name, UPN, mail, job title
   *       - in: query
   *         name: department
   *         schema:
   *           type: string
   *         description: Filter by department
   *       - in: query
   *         name: jobTitle
   *         schema:
   *           type: string
   *         description: Filter by job title
   *       - in: query
   *         name: city
   *         schema:
   *           type: string
   *         description: Filter by city
   *       - in: query
   *         name: country
   *         schema:
   *           type: string
   *         description: Filter by country
   *       - in: query
   *         name: accountEnabled
   *         schema:
   *           type: boolean
   *         description: Filter by account status
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           default: displayName
   *         description: Field to sort by
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
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
   *         description: Paginated list of users
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
   *                     $ref: '#/components/schemas/User'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: number
   *                     limit:
   *                       type: number
   *                     total:
   *                       type: number
   *                     pages:
   *                       type: number
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        search,
        department,
        jobTitle,
        accountEnabled,
        city,
        country,
        sortBy = 'displayName',
        sortOrder = 'asc',
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
              'displayName^3',
              'userPrincipalName^2',
              'mail^2',
              'jobTitle',
              'department'
            ],
            fuzziness: 'AUTO'
          }
        });
      }

      // Filters
      if (department) filter.push({ term: { 'department.keyword': department } });
      if (jobTitle) filter.push({ term: { 'jobTitle.keyword': jobTitle } });
      if (accountEnabled !== undefined) filter.push({ term: { accountEnabled: accountEnabled === 'true' } });
      if (city) filter.push({ term: { 'city.keyword': city } });
      if (country) filter.push({ term: { 'country.keyword': country } });

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
          { [`${sortBy}.keyword`]: { order: sortOrder, unmapped_type: 'keyword', missing: '_last' } }
        ],
        track_total_hits: true
      };

      const response = await client.search({
        index: INDICES.USERS,
        body
      });

      const hits = response.body.hits;
      const users = hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score
      }));

      res.json({
        success: true,
        data: users,
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
   * /api/v2/users/{id}:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get single user by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       200:
   *         description: User details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       404:
   *         description: User not found
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const cleanId = String(id).trim();
      console.log(`[Users] Lookup request for identifier: "${cleanId}"`);

      // 1. Try direct ID lookup (most efficient)
      try {
        const response = await client.get({
          index: INDICES.USERS,
          id: cleanId
        });

        console.log(`[Users] ✓ Document found by _id: "${cleanId}"`);
        return res.json({
          success: true,
          data: response.body._source
        });
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
        // Continue to search if direct lookup fails
      }

      // 2. Search by multiple fields (id, UPN, mail)
      console.log(`[Users] Searching index for: "${cleanId}"`);
      const searchResponse = await client.search({
        index: INDICES.USERS,
        body: {
          query: {
            bool: {
              should: [
                { term: { 'id.keyword': cleanId } },
                { term: { 'userPrincipalName.keyword': cleanId } },
                { term: { 'userPrincipalName.keyword': cleanId.toLowerCase() } },
                { term: { 'mail.keyword': cleanId } },
                { term: { 'mail.keyword': cleanId.toLowerCase() } }
              ],
              minimum_should_match: 1
            }
          },
          size: 1
        }
      });

      const totalHits = searchResponse.body.hits.total.value;
      if (totalHits > 0) {
        const foundUser = searchResponse.body.hits.hits[0]._source;
        console.log(`[Users] ✓ User found via search: "${foundUser.userPrincipalName}"`);
        return res.json({
          success: true,
          data: foundUser
        });
      }
      
      console.warn(`[Users] ✗ User not found: "${cleanId}"`);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: `User "${cleanId}" does not exist in the inventory.`
      });
    } catch (error) {
      console.error(`[Users] Critical error during lookup:`, error);
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/users/{id}/devices:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get devices for a specific user
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       200:
   *         description: User's devices
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
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     devices:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Device'
   *       404:
   *         description: User not found
   */
  router.get('/:id/devices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const cleanId = String(id).trim();

      let user: any = null;

      // 1. Try direct ID lookup
      try {
        const userResponse = await client.get({
          index: INDICES.USERS,
          id: cleanId
        });
        user = userResponse.body._source;
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
      }

      // 2. If direct lookup failed, try search
      if (!user) {
        const searchResponse = await client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                should: [
                  { term: { 'id.keyword': cleanId } },
                  { term: { 'userPrincipalName.keyword': cleanId } },
                  { term: { 'userPrincipalName.keyword': cleanId.toLowerCase() } },
                  { term: { 'mail.keyword': cleanId } },
                  { term: { 'mail.keyword': cleanId.toLowerCase() } }
                ],
                minimum_should_match: 1
              }
            },
            size: 1
          }
        });

        if (searchResponse.body.hits.total.value > 0) {
          user = searchResponse.body.hits.hits[0]._source;
        }
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const upn = user.userPrincipalName;

      // Then find their devices (match by ID first, then UPN)
      const devicesResponse = await client.search({
        index: INDICES.DEVICES,
        body: {
          query: {
            bool: {
              should: [
                { term: { 'user.id': user.id } },
                { term: { 'userPrincipalName.keyword': upn } },
                { term: { 'userPrincipalName.keyword': upn.toLowerCase() } }
              ],
              minimum_should_match: 1
            }
          },
          sort: [{ lastSyncDateTime: 'desc' }],
          size: 100
        }
      });

      res.json({
        success: true,
        data: {
          user: user,
          devices: devicesResponse.body.hits.hits.map((hit: any) => hit._source)
        }
      });
    } catch (error: any) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/users/stats/summary:
   *   get:
   *     tags:
   *       - Users
   *     summary: Get user statistics summary
   *     description: Aggregated statistics for users by department, job title, location, and status
   *     responses:
   *       200:
   *         description: User statistics summary
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
   *                     by_department:
   *                       type: array
   *                     by_job_title:
   *                       type: array
   *                     by_city:
   *                       type: array
   *                     by_country:
   *                       type: array
   *                     account_status:
   *                       type: array
   */
  router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.USERS,
        body: {
          size: 0,
          aggs: {
            total: { value_count: { field: 'id.keyword' } },
            by_department: {
              terms: { field: 'department.keyword', size: 50 }
            },
            by_job_title: {
              terms: { field: 'jobTitle.keyword', size: 50 }
            },
            by_city: {
              terms: { field: 'city.keyword', size: 50 }
            },
            by_country: {
              terms: { field: 'country.keyword', size: 50 }
            },
            account_status: {
              terms: { field: 'accountEnabled' }
            }
          }
        }
      });

      const aggs = response.body.aggregations;

      res.json({
        success: true,
        data: {
          total: aggs.total.value,
          by_department: aggs.by_department.buckets,
          by_job_title: aggs.by_job_title.buckets,
          by_city: aggs.by_city.buckets,
          by_country: aggs.by_country.buckets,
          account_status: aggs.account_status.buckets
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/users/search/advanced:
   *   post:
   *     tags:
   *       - Users
   *     summary: Advanced user search
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
   *               should:
   *                 type: array
   *               filter:
   *                 type: array
   *               sort:
   *                 type: array
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
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   *                 total:
   *                   type: number
   */
  router.post('/search/advanced', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        must = [],
        should = [],
        must_not = [],
        filter = [],
        sort = [{ 'displayName.keyword': 'asc' }],
        from = 0,
        size = 50
      } = req.body;

      const response = await client.search({
        index: INDICES.USERS,
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
