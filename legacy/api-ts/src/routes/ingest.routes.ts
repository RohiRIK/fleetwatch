// Ingest Routes - Handle data ingestion from fetcher
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/error.middleware';
import { IngestService } from '../services/ingest.service';
import { normalizeDevices } from '../normalizers/device-normalizer';
import { normalizeUsers } from '../normalizers/user-normalizer';
import { normalizeLicenses } from '../normalizers/license-normalizer';
import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';

export function createIngestRoutes(opensearchClient: Client): Router {
  const router = Router();
  const ingestService = new IngestService(opensearchClient);

  /**
   * @swagger
   * /api/v2/ingest/devices:
   *   post:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Ingest devices
   *     description: Ingest device data from fetcher (Supports full and incremental sync)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - managedDevices
   *             properties:
   *               managedDevices:
   *                 type: array
   *                 items:
   *                   type: object
   *               syncType:
   *                 type: string
   *                 enum: [full, incremental]
   *     responses:
   *       200:
   *         description: Ingestion result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 indexed:
   *                   type: integer
   *                 failed:
   *                   type: integer
   *                 syncType:
   *                   type: string
   */
  router.post('/devices', asyncHandler(async (req: Request, res: Response) => {
    const fetcherOutput = req.body;

    if (!fetcherOutput || !fetcherOutput.managedDevices) {
      throw createError('Invalid request: managedDevices required', 400);
    }

    const deviceCount = fetcherOutput.managedDevices?.length || 0;
    const syncType = fetcherOutput.syncType || 'unknown'; // 'full' or 'incremental'

    console.log(`Received device ingest request: ${deviceCount} devices (${syncType} sync)`);

    // Normalize devices
    const normalizedDevices = await normalizeDevices(fetcherOutput, {
      enableDualWrite: process.env.ENABLE_CONFIG_DUAL_WRITE === 'true',
      opensearchClient
    });
    console.log(`Normalized ${normalizedDevices.length} devices`);

    // Ingest to OpenSearch (upsert mode - updates existing, creates new)
    const result = await ingestService.ingestDevices(normalizedDevices, {
      refresh: true, // Make immediately searchable
      batchSize: 500,
      continueOnError: true,
      mode: 'upsert' // Incremental updates
    });

    res.json({
      success: result.success,
      indexed: result.indexed,
      failed: result.failed,
      duration: result.duration,
      syncType,
      errors: result.errors?.slice(0, 10), // Return first 10 errors only
      message: `Ingested ${result.indexed} devices (${syncType} sync) in ${result.duration}ms`
    });
  }));

  /**
   * @swagger
   * /api/v2/ingest/users:
   *   post:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Ingest users
   *     description: Ingest user data from fetcher
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - users
   *             properties:
   *               users:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Ingestion result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 indexed:
   *                   type: integer
   */
  router.post('/users', asyncHandler(async (req: Request, res: Response) => {
    const fetcherOutput = req.body;

    if (!fetcherOutput || !fetcherOutput.users) {
      throw createError('Invalid request: users required', 400);
    }

    console.log(`Received user ingest request: ${fetcherOutput.users?.length || 0} users`);

    // Normalize users (with device correlations if devices provided)
    const normalizedDevices = fetcherOutput.managedDevices ?
      await normalizeDevices(fetcherOutput) : undefined;

    const normalizedUsers = normalizeUsers(
      fetcherOutput,
      {},
      normalizedDevices
    );
    console.log(`Normalized ${normalizedUsers.length} users`);

    // Ingest to OpenSearch
    const result = await ingestService.ingestUsers(normalizedUsers, {
      refresh: true,
      batchSize: 500,
      continueOnError: true
    });

    res.json({
      success: result.success,
      indexed: result.indexed,
      failed: result.failed,
      duration: result.duration,
      errors: result.errors?.slice(0, 10),
      message: `Ingested ${result.indexed} users in ${result.duration}ms`
    });
  }));

  /**
   * @swagger
   * /api/v2/ingest/licenses:
   *   post:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Ingest licenses
   *     description: Ingest license data from fetcher (with stale data cleanup)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - subscribedSkus
   *             properties:
   *               subscribedSkus:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Ingestion result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 indexed:
   *                   type: integer
   *                 failed:
   *                   type: integer
   */
  router.post('/licenses', asyncHandler(async (req: Request, res: Response) => {
    const fetcherOutput = req.body;

    if (!fetcherOutput || !fetcherOutput.subscribedSkus) {
      throw createError('Invalid request: subscribedSkus required', 400);
    }

    console.log(`Received license ingest request: ${fetcherOutput.subscribedSkus?.length || 0} SKUs`);

    // Normalize licenses
    const normalizedLicenses = normalizeLicenses(fetcherOutput);
    console.log(`Normalized ${normalizedLicenses.length} licenses`);

    // Ingest to OpenSearch (with stale data cleanup)
    const result = await ingestService.ingestLicenses(normalizedLicenses, {
      refresh: true, // Make immediately searchable
      batchSize: 100,
      continueOnError: true,
      mode: 'upsert'
    });

    res.json({
      success: result.success,
      indexed: result.indexed,
      failed: result.failed,
      duration: result.duration,
      errors: result.errors?.slice(0, 10),
      message: `Ingested ${result.indexed} licenses in ${result.duration}ms`
    });
  }));

  /**
   * @swagger
   * /api/v2/ingest/all:
   *   post:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Ingest all data
   *     description: Ingest complete fetcher output (devices + users)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               managedDevices:
   *                 type: array
   *                 items:
   *                   type: object
   *               users:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Bulk ingestion result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 devices:
   *                   type: object
   *                 users:
   *                   type: object
   */
  router.post('/all', asyncHandler(async (req: Request, res: Response) => {
    const fetcherOutput = req.body;

    if (!fetcherOutput || (!fetcherOutput.managedDevices && !fetcherOutput.users)) {
      throw createError('Invalid request: managedDevices or users required', 400);
    }

    console.log('Received full ingest request');
    console.log(`  Devices: ${fetcherOutput.managedDevices?.length || 0}`);
    console.log(`  Users: ${fetcherOutput.users?.length || 0}`);

    const results: any = {
      devices: { indexed: 0, failed: 0 },
      users: { indexed: 0, failed: 0 },
      duration: 0
    };

    const startTime = Date.now();

    // Normalize and ingest devices
    if (fetcherOutput.managedDevices && fetcherOutput.managedDevices.length > 0) {
      const normalizedDevices = await normalizeDevices(fetcherOutput, {
        enableDualWrite: process.env.ENABLE_CONFIG_DUAL_WRITE === 'true',
        opensearchClient
      });
      console.log(`Normalized ${normalizedDevices.length} devices`);

      const deviceResult = await ingestService.ingestDevices(normalizedDevices, {
        refresh: false, // Don't refresh yet
        batchSize: 500,
        continueOnError: true
      });

      results.devices = {
        indexed: deviceResult.indexed,
        failed: deviceResult.failed,
        duration: deviceResult.duration,
        errors: deviceResult.errors?.slice(0, 5)
      };
    }

    // Normalize and ingest users
    if (fetcherOutput.users && fetcherOutput.users.length > 0) {
      const normalizedDevices = fetcherOutput.managedDevices ?
        await normalizeDevices(fetcherOutput) : undefined;

      const normalizedUsers = normalizeUsers(
        fetcherOutput,
        {},
        normalizedDevices
      );
      console.log(`Normalized ${normalizedUsers.length} users`);

      const userResult = await ingestService.ingestUsers(normalizedUsers, {
        refresh: false,
        batchSize: 500,
        continueOnError: true
      });

      results.users = {
        indexed: userResult.indexed,
        failed: userResult.failed,
        duration: userResult.duration,
        errors: userResult.errors?.slice(0, 5)
      };
    }

    // Refresh indices to make data searchable
    await opensearchClient.indices.refresh({
      index: [INDICES.DEVICES, INDICES.USERS].join(',')
    });

    results.duration = Date.now() - startTime;
    results.success = results.devices.failed === 0 && results.users.failed === 0;

    res.json({
      ...results,
      message: `Ingested ${results.devices.indexed} devices and ${results.users.indexed} users in ${results.duration}ms`
    });
  }));

  /**
   * @swagger
   * /api/v2/ingest/stats:
   *   get:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Ingestion statistics
   *     description: Get current document counts
   *     responses:
   *       200:
   *         description: Statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 devices:
   *                   type: integer
   *                 users:
   *                   type: integer
   *                 timestamp:
   *                   type: string
   */
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const [deviceCount, userCount] = await Promise.all([
      ingestService.getDocumentCount(INDICES.DEVICES),
      ingestService.getDocumentCount(INDICES.USERS)
    ]);

    res.json({
      devices: deviceCount,
      users: userCount,
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * @swagger
   * /api/v2/ingest/clear/{index}:
   *   delete:
   *     tags:
   *       - Ingest
   *     security:
   *       - bearerAuth: []
   *     summary: Clear index
   *     description: Clear an index (devices or users) for reindexing
   *     parameters:
   *       - in: path
   *         name: index
   *         required: true
   *         schema:
   *           type: string
   *           enum: [devices, users]
   *     responses:
   *       200:
   *         description: Index cleared
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  router.delete('/clear/:index', asyncHandler(async (req: Request, res: Response) => {
    const { index } = req.params;

    if (index !== 'devices' && index !== 'users') {
      throw createError('Invalid index. Must be "devices" or "users"', 400);
    }

    const indexName = index === 'devices' ? INDICES.DEVICES : INDICES.USERS;
    const success = await ingestService.clearIndex(indexName);

    if (!success) {
      throw createError(`Failed to clear index: ${indexName}`, 500);
    }

    res.json({
      success: true,
      message: `Cleared index: ${indexName}`
    });
  }));

  return router;
}
