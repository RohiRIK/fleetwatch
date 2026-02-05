// Scheduler Routes - Control background jobs
import { Router } from 'express';
import type { Request, Response } from 'express';
import { SchedulerService } from '../services/scheduler.service';

export function createSchedulerRoutes(schedulerService: SchedulerService): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/admin/scheduler/status:
   *   get:
   *     tags: [Admin]
   *     summary: Get scheduler status
   */
  router.get('/status', async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: schedulerService.getStatus()
    });
  });

  /**
   * @swagger
   * /api/v2/admin/scheduler/trigger/fetcher:
   *   post:
   *     tags: [Admin]
   *     summary: Manually trigger the data fetcher
   */
  router.post('/trigger/fetcher', async (req: Request, res: Response) => {
    schedulerService.triggerFetcherNow().catch((err: any) => console.error('Manual fetcher trigger failed:', err));
    res.json({ success: true, message: 'Fetcher triggered in background' });
  });

  /**
   * @swagger
   * /api/v2/admin/scheduler/trigger/permissions:
   *   post:
   *     tags: [Admin]
   *     summary: Manually trigger permission verification
   */
  router.post('/trigger/permissions', async (req: Request, res: Response) => {
    schedulerService.triggerPermissionsNow().catch((err: any) => console.error('Manual permission trigger failed:', err));
    res.json({ success: true, message: 'Permission check triggered in background' });
  });

  /**
   * @swagger
   * /api/v2/admin/scheduler/enable:
   *   put:
   *     tags: [Admin]
   *     summary: Enable or disable the scheduler
   */
  router.put('/enable', async (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled boolean required' });
    }
    schedulerService.setEnabled(enabled);
    res.json({ success: true, enabled });
  });

  return router;
}