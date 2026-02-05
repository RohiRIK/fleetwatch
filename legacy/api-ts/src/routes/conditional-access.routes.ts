import { Router, Request, Response, NextFunction } from 'express';
import { Client } from '@opensearch-project/opensearch';
import { ConditionalAccessRepository } from '../repositories/conditional-access.repository';
import { ConditionalAccessService } from '../services/conditional-access.service';

export function createConditionalAccessRoutes(client: Client): Router {
  const router = Router();
  const repository = new ConditionalAccessRepository(client);
  const service = new ConditionalAccessService(repository);

  /**
   * @swagger
   * /api/v2/conditional-access/policies:
   *   get:
   *     tags:
   *       - Conditional Access
   *     summary: List Conditional Access policies
   *     description: Retrieve a paginated list of policies with filtering
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *           enum: [enabled, disabled, enabledForReportingButNotEnforced]
   *     responses:
   *       200:
   *         description: List of policies
   */
  router.get('/policies', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '10', search, state } = req.query;
      
      const result = await service.listPolicies({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        state: state as string
      });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: result.pages
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/conditional-access/policies/{id}:
   *   get:
   *     tags:
   *       - Conditional Access
   *     summary: Get a policy by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Policy details
   *       404:
   *         description: Policy not found
   */
  router.get('/policies/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const policy = await service.getPolicyById(req.params.id);
      
      if (!policy) {
        return res.status(404).json({
          success: false,
          error: 'Policy not found'
        });
      }

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
