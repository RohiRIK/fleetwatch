/**
 * Diagnostics Routes
 * 
 * Provides self-checking and diagnostic tools for platform health.
 */

import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { PermissionVerificationService } from '../services/permission-verification.service';

export function createDiagnosticsRoutes(redisClient: Redis | null): Router {
  const router = Router();
  const permissionService = new PermissionVerificationService(redisClient);

  /**
   * @swagger
   * /api/v2/diagnostics/permissions:
   *   post:
   *     tags: [Diagnostics]
   *     summary: Verify all Azure AD App permissions
   *     description: Tests each required permission by making real Microsoft Graph API calls.
   *     responses:
   *       200:
   *         description: Permission report
   *       500:
   *         description: Verification failed
   */
  router.post('/permissions', async (req: Request, res: Response) => {
    try {
      console.log('[Diagnostics] Starting permission verification request');
      const report = await permissionService.verifyAllPermissions();
      
      res.json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('[Diagnostics] Permission verification failed:', error);
      res.status(500).json({
        success: false,
        error: 'VERIFICATION_FAILED',
        message: error.message
      });
    }
  });

  /**
   * @swagger
   * /api/v2/diagnostics/health:
   *   get:
   *     tags: [Diagnostics]
   *     summary: Detailed platform health check
   *     responses:
   *       200:
   *         description: Health status
   */
  router.get('/health', async (req: Request, res: Response) => {
    const redisHealthy = redisClient ? (await redisClient.ping().catch(() => null)) === 'PONG' : false;
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        services: {
          redis: redisHealthy ? 'healthy' : 'unhealthy',
          api: 'healthy',
          // Add more service checks here
        }
      }
    });
  });

  return router;
}