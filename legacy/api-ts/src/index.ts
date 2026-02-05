// Main API Server Entry Point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import {
  createOpenSearchClient,
  checkOpenSearchHealth,
  bootstrapIndices
} from './config/opensearch';
import { createAuthMiddleware, createIngestAuthMiddleware, createCombinedAuthMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createIngestRoutes } from './routes/ingest.routes';
import { createDeviceRoutes } from './routes/devices.routes';
import { createUserRoutes } from './routes/users.routes';
import { createLicenseRoutes } from './routes/licenses.routes';
import { createAnalyticsRoutes } from './routes/analytics.routes';
import { createConfigurationRoutes } from './routes/configurations.routes';
import { createComplianceRoutes } from './routes/compliance.routes';
import { createConditionalAccessRoutes } from './routes/conditional-access.routes';
import settingsRoutes from './routes/settings.routes';
import integrationRoutes from './routes/integration.routes';
import { createSetupRoutes } from './routes/setup.routes';
import { createAdminRoutes } from './routes/admin.routes';
import { createSchedulerRoutes } from './routes/scheduler.routes';
import { onboardingRoutes } from './routes/onboarding.routes'; // Import the new onboarding routes
import { createLogsRoutes } from './routes/logs.routes'; // Import the new logs routes
import { createAiRoutes } from './routes/ai.routes'; // AI Analyst routes
import { createAuthRoutes } from './routes/auth.routes'; // SSO Authentication routes
import provisioningRoutes from './routes/provisioning.routes'; // Auto-provisioning routes
import { createDiagnosticsRoutes } from './routes/diagnostics.routes'; // Diagnostics routes
import { swaggerSpec } from './config/swagger';
import { logger } from './utils/logger'; // Import our new logger
import { sessionMiddleware, requireAuth } from './middleware/session-auth.middleware'; // Session auth middleware
import { redisSessionService } from './services/redis-session.service'; // Redis session service
import { localUserService } from './services/local-user.service'; // Local user service
import { platformUserService as platformUserSvc } from './services/platform-user.service'; // Placeholder import if we exported a singleton
import { PlatformUserService, initializePlatformUserService } from './services/platform-user.service';
import { initializeIntegrationService } from './services/integration.service';
import { provisioningStateService } from './services/provisioning-state.service'; // Provisioning state service
import { envManager } from './services/env-manager.service'; // Environment manager
import { SchedulerService } from './services/scheduler.service'; // Scheduler service
import { configCache } from './utils/config-cache';
import { globalRateLimit, authRateLimit, ingestRateLimit, piiRedactionMiddleware } from './middleware/security.middleware';
import chokidar from 'chokidar';
import path from 'path';

// Configuration from environment
const config = {
  port: parseInt(process.env.PORT || '3001'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  ingestSecret: process.env.INGEST_SECRET,
  adminToken: process.env.ADMIN_TOKEN,
  requireAuth: process.env.REQUIRE_AUTH === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
  opensearch: {
    node: process.env.ES_NODE || 'https://localhost:9200',
    username: process.env.ES_USER || 'admin',
    password: process.env.ES_PASS || 'admin'
  },
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    fetcherCron: process.env.CRON_SCHEDULE || '*/30 * * * *',
    permissionCron: process.env.PERMISSION_CRON_SCHEDULE || '0 * * * *',
    fetcherContainerName: 'device_inventory_fetcher'
  }
};

// Global state for system configuration
let isSystemConfigured = false;

async function checkSystemConfiguration(): Promise<boolean> {
  try {
    const envCheck = await envManager.checkAzureConfig();
    return envCheck.hasAzureConfig;
  } catch (error) {
    console.warn('[Config] Error checking configuration:', error);
    return false;
  }
}

async function startServer() {
  console.log('=== Device Inventory API (TypeScript) ===');

  // Initial config load
  await configCache.loadFromDisk();

  // Set up .env file watcher with debounce
  const envPath = path.join(process.cwd(), '.env');
  let debounceTimer: any = null;

  const watcher = chokidar.watch(envPath, {
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('all', (event: string) => {
    if (event === 'change' || event === 'add' || event === 'unlink') {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        logger.info(`[Watcher] .env file ${event} detected, reloading configuration...`);
        await configCache.loadFromDisk();
        debounceTimer = null;
      }, 200);
    }
  });

  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Port: ${config.port}`);
  console.log(`Auth required: ${config.requireAuth}`);
  console.log(`OpenSearch: ${config.opensearch.node}`);

  // Check system configuration status
  console.log('\nChecking system configuration...');
  isSystemConfigured = await checkSystemConfiguration();
  if (isSystemConfigured) {
    console.log('✓ System is configured');
  } else {
    console.log('⚠ System needs setup - provisioning wizard available at /setup/wizard');
  }

  // Initialize Redis session service
  console.log('\nInitializing Redis session service...');
  await redisSessionService.initialize();
  const redisHealthy = await redisSessionService.healthCheck();
  if (redisHealthy) {
    console.log('✓ Redis session service initialized');
  } else {
    console.warn('⚠ Redis not available - sessions will not persist');
  }

  // Initialize local user service (shares Redis connection)
  console.log('\nInitializing local user service...');
  await localUserService.initialize(redisSessionService.getClient() || undefined);
  if (localUserService.isAvailable()) {
    console.log('✓ Local user service initialized');
  } else {
    console.warn('⚠ Local user service not available');
  }

  // Initialize provisioning state service (shares Redis connection)
  console.log('\nInitializing provisioning state service...');
  await provisioningStateService.initialize(redisSessionService.getClient() || undefined);
  if (provisioningStateService.isAvailable()) {
    console.log('✓ Provisioning state service initialized');
  } else {
    console.warn('⚠ Provisioning state service not available');
  }

  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for API
  }));

  // CORS - must use specific origin when credentials: true (can't use '*')
  app.use(cors({
    origin: config.corsOrigin === '*' ? ['https://localhost', 'http://localhost', 'http://localhost:3000'] : config.corsOrigin,
    credentials: true
  }));

  // Body parsing
  app.use(express.json({ limit: '150mb' })); // Large payload support for bulk ingest
  app.use(express.urlencoded({ extended: true, limit: '150mb' }));

  // Compression
  app.use(compression());

  // Cookie parsing (required for sessions)
  app.use(cookieParser());

  // Security Hardening: Global Rate Limiting & PII Redaction
  app.use(globalRateLimit);
  app.use(piiRedactionMiddleware);

  // Session middleware (attaches session to request if valid)
  app.use(sessionMiddleware());

  // Request logging using Winston
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const severity = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';
      logger.log({
        level: severity,
        action: 'API Request',
        source: 'system',
        message: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration,
          // user: req.user?.email, // Assuming req.user exists from auth middleware
          // ip: req.ip,
        }
      });
    });
    next();
  });

  // Create OpenSearch client
  const opensearchClient = createOpenSearchClient({
    node: config.opensearch.node,
    auth: {
      username: config.opensearch.username,
      password: config.opensearch.password
    }
  });

  // Initialize platform user service
  initializePlatformUserService(opensearchClient);

  // Initialize integration service
  initializeIntegrationService(opensearchClient);

  // Initialize and start scheduler
  const schedulerService = new SchedulerService({
    enabled: config.scheduler.enabled,
    fetcherCronSchedule: config.scheduler.fetcherCron,
    permissionCronSchedule: config.scheduler.permissionCron,
    fetcherContainerName: config.scheduler.fetcherContainerName
  }, redisSessionService.getClient());
  
  if (config.scheduler.enabled) {
    schedulerService.start();
  }

  // Check OpenSearch health with retry
  console.log('\nChecking OpenSearch connection...');
  let isHealthy = false;
  const maxRetries = 30; // Wait up to 60 seconds
  
  for (let i = 0; i < maxRetries; i++) {
    isHealthy = await checkOpenSearchHealth(opensearchClient);
    if (isHealthy) break;
    
    // Only log every 5th attempt to reduce noise, unless it's the first few
    if (i < 3 || i % 5 === 0) {
      console.log(`Waiting for OpenSearch to be ready... (${i + 1}/${maxRetries})`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (!isHealthy) {
    console.error('ERROR: OpenSearch is not available after retries');
    process.exit(1);
  }
  console.log('✓ OpenSearch connection healthy');

  // Bootstrap indices
  console.log('\nBootstrapping indices...');
  try {
    await bootstrapIndices(opensearchClient);
    console.log('✓ Indices ready');
  } catch (error) {
    console.error('ERROR: Failed to bootstrap indices:', error);
    process.exit(1);
  }

  /**
   * @swagger
   * /health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Health check endpoint
   *     description: Returns the current health status of the API and OpenSearch connection
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: healthy
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 version:
   *                   type: string
   *                   example: 2.0.0
   *                 opensearch:
   *                   type: object
   *                   properties:
   *                     connected:
   *                       type: boolean
   */
  app.get('/health', async (req: express.Request, res: express.Response) => {
    const redisConnected = await redisSessionService.healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      configured: isSystemConfigured,
      opensearch: {
        connected: true
      },
      redis: {
        connected: redisConnected
      }
    });
  });

  /**
   * @swagger
   * /api:
   *   get:
   *     tags:
   *       - Health
   *     summary: API information endpoint
   *     description: Returns API metadata and available endpoints
   *     responses:
   *       200:
   *         description: API information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                   example: Device Inventory API (TypeScript)
   *                 version:
   *                   type: string
   *                   example: 2.0.0
   *                 endpoints:
   *                   type: object
   *                 auth:
   *                   type: string
   *                   enum: [required, disabled]
   */
  app.get('/api', (req: express.Request, res: express.Response) => {
    res.json({
      name: 'Device Inventory API (TypeScript)',
      version: '2.0.0',
      endpoints: {
        health: '/health',
        docs: '/api-docs',
        ingest: {
          devices: 'POST /api/ingest/devices',
          users: 'POST /api/ingest/users',
          all: 'POST /api/ingest/all',
          stats: 'GET /api/ingest/stats',
          clear: 'DELETE /api/ingest/clear/:index'
        }
      },
      auth: config.requireAuth ? 'required' : 'disabled'
    });
  });

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Device Inventory API Documentation'
  }));

  // === Authentication Routes (SSO) ===
  app.use('/auth', authRateLimit, createAuthRoutes());

  // === Auto-Provisioning Routes (available during setup) ===
  app.use('/v2/provisioning', authRateLimit, provisioningRoutes);

  // === V2 API Routes (Versioned) ===
  const ingestAuthMiddleware = createIngestAuthMiddleware(config.ingestSecret, config.requireAuth, config.adminToken);
  const combinedAdminAuth = createCombinedAuthMiddleware();

  // V2 Ingest routes (with auth and rate limiting)
  app.use('/v2/ingest', ingestRateLimit, ingestAuthMiddleware, createIngestRoutes(opensearchClient));

  // V2 Query routes (protected)
  app.use('/v2/devices', requireAuth(), createDeviceRoutes(opensearchClient));
  app.use('/v2/users', requireAuth(), createUserRoutes(opensearchClient));
  app.use('/v2/licenses', requireAuth(), createLicenseRoutes(opensearchClient));
  app.use('/v2/analytics', requireAuth(), createAnalyticsRoutes(opensearchClient, redisSessionService.getClient() || undefined));

  // V2 Settings routes (public - for system configuration)
  app.use('/v2/settings', settingsRoutes);

  // V2 Integration routes (protected)
  app.use('/v2/integrations', requireAuth('admin'), integrationRoutes);

  // V2 Log routes (public - for system configuration)
  app.use('/v2/logs', createLogsRoutes(opensearchClient));
  app.use('/v2/system-logs', createLogsRoutes(opensearchClient)); // Backward compatibility

  // V2 AI routes (protected)
  app.use('/v2/ai', requireAuth(), createAiRoutes(opensearchClient));

  // V2 Setup routes (public - for one-time initial setup)
  app.use('/v2/setup', authRateLimit, createSetupRoutes(opensearchClient));

  // V2 Diagnostics routes (protected)
  app.use('/v2/diagnostics', requireAuth(), createDiagnosticsRoutes(redisSessionService.getClient()));

  // V2 Admin/Management Routes (protected by combined auth - allows Fetcher and IT Admins)
  app.use('/v2/admin', ingestRateLimit, combinedAdminAuth, createAdminRoutes(opensearchClient));
  app.use('/v2/admin/scheduler', requireAuth(), createSchedulerRoutes(schedulerService));

  // === Legacy V1 Routes (for backward compatibility) ===
  // Redirect to V2 with deprecation notice
  app.use('/ingest', (req, res, next) => {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Migrate-To', '/v2/ingest');
    next();
  }, ingestAuthMiddleware, createIngestRoutes(opensearchClient));

  app.use('/devices', (req, res, next) => {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Migrate-To', '/v2/devices');
    next();
  }, createDeviceRoutes(opensearchClient));

  app.use('/users', (req, res, next) => {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Migrate-To', '/v2/users');
    next();
  }, createUserRoutes(opensearchClient));

  app.use('/analytics', (req, res, next) => {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Migrate-To', '/v2/analytics');
    next();
  }, createAnalyticsRoutes(opensearchClient));

  // Configuration routes (Phase 3: New normalized configuration API)
  app.use('/v2/configurations', createConfigurationRoutes(opensearchClient));

  // Compliance routes (Phase 3: New normalized compliance API)
  app.use('/v2/compliance', createComplianceRoutes(opensearchClient));

  // Conditional Access routes
  app.use('/v2/conditional-access', requireAuth(), createConditionalAccessRoutes(opensearchClient));

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  // Start server
  const server = app.listen(config.port, () => {
    console.log(`\n✓ Server listening on port ${config.port}`);
    console.log(`\nAPI endpoints:`);
    console.log(`  Health: http://localhost:${config.port}/health`);
    console.log(`  API Info: http://localhost:${config.port}/api`);
    console.log(`  API Docs: http://localhost:${config.port}/api-docs`);
    console.log(`  Ingest Devices: POST http://localhost:${config.port}/api/ingest/devices`);
    console.log(`  Ingest Users: POST http://localhost:${config.port}/api/ingest/users`);
    console.log(`  Ingest All: POST http://localhost:${config.port}/api/ingest/all`);
    console.log(`  Ingest Stats: GET http://localhost:${config.port}/api/ingest/stats`);
    console.log(`\nReady to receive data!`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received, shutting down gracefully...');
    await redisSessionService.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await redisSessionService.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
