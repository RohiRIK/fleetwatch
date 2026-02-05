import { Router, Request, Response } from 'express';
import { Client } from '@opensearch-project/opensearch';
import { LogRepository } from '../repositories/log.repository';
import { LogType } from '../types/log.types';
import { systemLogSchema, userActivityLogSchema } from '../schemas/log.schema';
import { asyncHandler } from '../middleware/error.middleware';
import { apiKeyMiddleware } from '../middleware/api-key.middleware';

export function createLogsRoutes(opensearchClient: Client): Router {
  const router = Router();
  const logRepository = new LogRepository(opensearchClient);

  /**
   * @swagger
   * /api/v2/logs/export:
   *   get:
   *     tags:
   *       - Logs
   *     summary: Export logs for SIEM integration (API Key required)
   */
  router.get(
    '/export',
    apiKeyMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const type = (req.query.type as LogType) || LogType.SYSTEM;
      const severity = req.query.severity as string;
      const fromDate = req.query.from_date as string;

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');

      const logStream = logRepository.streamLogs({
        type,
        severity,
        from_date: fromDate,
      });

      for await (const log of logStream) {
        res.write(JSON.stringify(log) + '\n');
      }

      res.end();
    })
  );

  /**
   * @swagger
   * /api/v2/logs:
   *   get:
   *     tags:
   *       - Logs
   *     summary: Get logs with pagination and filters
   */
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const type = (req.query.type as LogType) || LogType.SYSTEM;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { data, total, pages } = await logRepository.getLogs({
        type,
        page,
        limit,
        severity: req.query.severity as string,
        source: req.query.source as string,
        search: req.query.search as string,
        user_upn: req.query.user_upn as string,
        category: req.query.category as string,
        status: req.query.status as string,
      });

      res.status(200).json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      });
    })
  );

  /**
   * @swagger
   * /api/v2/logs/batch:
   *   post:
   *     tags:
   *       - Logs
   *     summary: Bulk ingest logs
   */
  router.post(
    '/batch',
    asyncHandler(async (req: Request, res: Response) => {
      const type = (req.query.type as LogType) || LogType.SYSTEM;
      const logs = req.body;

      if (!Array.isArray(logs)) {
        res.status(400).json({ success: false, error: 'Expected an array of logs' });
        return;
      }

      const result = await logRepository.bulkCreateLogs(logs, type);

      res.status(201).json({
        success: true,
        ...result
      });
    })
  );

  /**
   * @swagger
   * /api/v2/logs/system:
   *   post:
   *     tags:
   *       - Logs
   *     summary: Create a new system log entry
   */
  router.post(
    '/system',
    asyncHandler(async (req: Request, res: Response) => {
      const payload = {
        ...req.body,
        severity: req.body.severity || req.body.level
      };
      
      const validated = systemLogSchema.parse(payload);
      const id = await logRepository.createLog(validated, LogType.SYSTEM);

      res.status(201).json({
        success: true,
        id,
      });
    })
  );

  /**
   * @swagger
   * /api/v2/logs/user:
   *   post:
   *     tags:
   *       - Logs
   *     summary: Create a new user activity log entry
   */
  router.post(
    '/user',
    asyncHandler(async (req: Request, res: Response) => {
      const payload = {
        ...req.body,
        user_upn: req.body.user_upn || (req as any).user?.upn,
        ip_address: req.body.ip_address || req.ip
      };

      if (!payload.user_upn) {
        return res.status(401).json({ success: false, error: 'User context required' });
      }

      const validated = userActivityLogSchema.parse(payload);
      const id = await logRepository.createLog(validated, LogType.USER);

      res.status(201).json({
        success: true,
        id,
      });
    })
  );

  /**
   * @swagger
   * /api/v2/logs/entra:
   *   post:
   *     tags:
   *       - Logs
   *     summary: Create a new Entra ID log entry
   */
  router.post(
    '/entra',
    asyncHandler(async (req: Request, res: Response) => {
      // In a real scenario, we might want a specific schema for Entra logs
      // but for now we accept the unified format
      const id = await logRepository.createLog(req.body, LogType.ENTRA);

      res.status(201).json({
        success: true,
        id,
      });
    })
  );

  // Backward compatibility
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const payload = {
        ...req.body,
        severity: req.body.severity || req.body.level
      };
      
      const validated = systemLogSchema.parse(payload);
      const id = await logRepository.createLog(validated, LogType.SYSTEM);

      res.status(201).json({
        success: true,
        id,
      });
    })
  );

  return router;
}
