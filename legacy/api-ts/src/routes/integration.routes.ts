/**
 * Integration API Routes
 * 
 * Endpoints for managing third-party integrations and API keys.
 */

import { Router, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { asyncHandler } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/session-auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v2/integrations:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: List all active integrations
 */
router.get(
  '/',
  requireAuth('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const integrations = await integrationService.listIntegrations();
    res.json({ success: true, data: integrations });
  })
);

/**
 * @swagger
 * /api/v2/integrations/siem:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Create a new SIEM integration
 */
router.post(
  '/siem',
  requireAuth('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const userId = (req as any).session?.user?.id || 'system';
    const { integration, cleartextKey } = await integrationService.createSIEMIntegration(name, userId);

    res.status(201).json({
      success: true,
      data: {
        ...integration,
        apiKey: cleartextKey // ONLY returned on creation
      }
    });
  })
);

/**
 * @swagger
 * /api/v2/integrations/{id}:
 *   delete:
 *     tags:
 *       - Integrations
 *     summary: Delete an integration
 */
router.delete(
  '/:id',
  requireAuth('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    await integrationService.deleteIntegration(req.params.id);
    res.json({ success: true });
  })
);

/**
 * @swagger
 * /api/v2/integrations/{id}/toggle:
 *   patch:
 *     tags:
 *       - Integrations
 *     summary: Toggle integration active status
 */
router.patch(
  '/:id/toggle',
  requireAuth('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    await integrationService.toggleActive(req.params.id, isActive);
    res.json({ success: true });
  })
);

export default router;
