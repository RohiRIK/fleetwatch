# Monitoring & Logging System

Comprehensive monitoring and logging system for FleetWatch with external error tracking (Sentry) and internal dashboard.

## Features

### 🔍 System Health Monitoring
- **Database**: PostgreSQL connection and latency monitoring
- **Redis Cache**: Connection status and performance tracking
- **Microsoft Graph API**: API connectivity and response time checks
- **Overall Status**: Aggregated health status (healthy/degraded/down)

### 📊 Performance Metrics
- **Response Times**: P50, P95, P99 percentiles, avg, min, max
- **Cache Statistics**: Hit rate, miss rate, total hits/misses
- **Request Stats**: Total, successful, failed requests with success rate
- **Real-time Tracking**: Middleware-based metrics collection

### 🐛 Error Tracking (Sentry)
- **External Monitoring**: Sentry.io integration for production error tracking
- **Session Replay**: Capture user sessions when errors occur
- **Performance Monitoring**: Track slow transactions and operations
- **Source Maps**: Upload source maps for better stack traces (production)
- **Graceful Degradation**: System continues working if Sentry is not configured

### 📝 System Logs (Winston)
- **Structured Logging**: JSON-formatted logs with levels (error, warn, info, http, debug)
- **In-Memory Storage**: Vercel-compatible log storage (1000 most recent logs)
- **Searchable**: Filter by level, search by message content
- **Context Tracking**: User ID, request context, metadata
- **Sensitive Data Redaction**: Automatically redacts passwords, tokens, secrets

### 🎯 Internal Dashboard
- **Superadmin Only**: Restricted access via RBAC
- **Real-time Updates**: Auto-refresh every 60 seconds
- **Tab Navigation**: Overview | Errors | Logs
- **Professional UI**: Built with shadcn/ui components

## Architecture

```
monitoring/
├── lib/
│   ├── logger/
│   │   └── logger.ts              # Winston logger with in-memory storage
│   ├── monitoring/
│   │   ├── types.ts               # TypeScript type definitions
│   │   ├── sentry.ts              # Sentry wrapper utilities
│   │   └── metrics-collector.ts   # Performance metrics collection
│   └── auth/
│       └── rbac.ts                # Role-based access control
├── app/
│   ├── api/
│   │   ├── health/route.ts        # System health endpoint
│   │   ├── metrics/route.ts       # Performance metrics endpoint
│   │   └── monitoring/
│   │       ├── errors/route.ts    # Sentry errors proxy
│   │       └── logs/route.ts      # Winston logs viewer
│   └── (dashboard)/admin/monitoring/
│       └── page.tsx               # Monitoring dashboard UI
├── components/monitoring/
│   ├── metric-card.tsx            # Reusable metric display
│   ├── health-status-panel.tsx   # System health display
│   ├── performance-panel.tsx     # Performance metrics display
│   ├── error-list-panel.tsx      # Sentry errors list
│   └── log-viewer-panel.tsx      # Winston logs viewer
├── sentry.client.config.ts       # Sentry browser config
├── sentry.server.config.ts       # Sentry Node.js config
├── sentry.edge.config.ts         # Sentry edge runtime config
├── instrumentation.ts            # Next.js instrumentation hook
└── middleware.ts                 # Enhanced with metrics tracking
```

## Setup

### 1. Install Dependencies

Already installed during implementation:
```bash
npm install winston @sentry/nextjs
```

### 2. Environment Variables

Add to `.env.local`:

```bash
# Sentry Configuration (Optional but recommended for production)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug

# Admin Email (for superadmin access)
ADMIN_EMAIL=admin@device-inventory.local
```

### 3. Sentry Setup (Optional)

1. Create account at [sentry.io](https://sentry.io)
2. Create new project (Next.js platform)
3. Copy DSN and add to `NEXT_PUBLIC_SENTRY_DSN`
4. Generate auth token: Settings > Developer Settings > Auth Tokens
5. Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

### 4. Build Configuration

Sentry is already integrated in `next.config.ts`. To disable Sentry during development:

```typescript
// next.config.ts
const useSentry = process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default useSentry ? withSentryConfig(nextConfig, ...) : nextConfig;
```

## Usage

### Accessing the Dashboard

1. Log in as superadmin (emergency admin account)
2. Navigate to **Admin > Monitoring** in the sidebar
3. View real-time health status, metrics, errors, and logs

### Using the Logger

```typescript
import { log } from '@/lib/logger/logger';

// Log messages
log.error('Database connection failed', {
  context: 'Database',
  error: new Error('Connection timeout'),
  metadata: { host: 'localhost', port: 5432 }
});

log.warn('Cache miss rate is high', {
  context: 'Cache',
  metadata: { missRate: 75 }
});

log.info('User logged in', {
  context: 'Auth',
  userId: '123',
  metadata: { method: 'azure-ad' }
});

// Query logs
const result = log.queryLogs({
  level: ['error', 'warn'],
  search: 'database',
  limit: 50,
  offset: 0
});
```

### Using Sentry

```typescript
import { captureError, captureMessage, addBreadcrumb } from '@/lib/monitoring/sentry';

// Capture errors
try {
  await riskyOperation();
} catch (error) {
  captureError(error as Error, {
    user: { id: '123', email: 'user@example.com' },
    tags: { feature: 'sync', operation: 'device-fetch' },
    extra: { deviceCount: 100 },
    level: 'error'
  });
}

// Capture messages
captureMessage('Device sync completed', {
  level: 'info',
  tags: { feature: 'sync' },
  extra: { syncedCount: 50, failedCount: 2 }
});

// Add breadcrumbs
addBreadcrumb('Starting device sync', {
  category: 'sync',
  level: 'info',
  data: { deviceCount: 100 }
});
```

### Using Metrics Collector

```typescript
import { metricsCollector } from '@/lib/monitoring/metrics-collector';

// Record request (automatically done by middleware)
await metricsCollector.recordRequest({
  path: '/api/devices',
  method: 'GET',
  statusCode: 200,
  duration: 150,
  timestamp: new Date(),
  userId: '123'
});

// Record cache operations
await metricsCollector.recordCacheHit();
await metricsCollector.recordCacheMiss();

// Get metrics
const metrics = await metricsCollector.getMetrics();
console.log(`Avg response time: ${metrics.responseTime.avg}ms`);
console.log(`Cache hit rate: ${metrics.cache.hitRate}%`);
```

## API Endpoints

All endpoints require **Superadmin** access.

### GET /api/health

Returns system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "services": {
      "database": {
        "status": "healthy",
        "latency": 45,
        "message": "Database responding normally",
        "lastChecked": "2024-02-06T10:00:00Z"
      },
      "redis": { ... },
      "graphApi": { ... }
    },
    "timestamp": "2024-02-06T10:00:00Z"
  }
}
```

### GET /api/metrics

Returns performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "responseTime": {
      "p50": 120,
      "p95": 450,
      "p99": 800,
      "avg": 180,
      "min": 50,
      "max": 1200
    },
    "cache": {
      "hitRate": 75.5,
      "missRate": 24.5,
      "totalHits": 1200,
      "totalMisses": 389
    },
    "requests": {
      "total": 5000,
      "successful": 4850,
      "failed": 150,
      "successRate": 97
    }
  }
}
```

### GET /api/monitoring/errors

Fetches recent errors from Sentry.

**Query Parameters:**
- `limit` (default: 25) - Max errors to return
- `status` (default: unresolved) - resolved | unresolved | ignored
- `query` - Search query

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [...],
    "total": 15,
    "pageSize": 25,
    "hasMore": false
  }
}
```

### GET /api/monitoring/logs

Fetches logs from Winston.

**Query Parameters:**
- `level` - Comma-separated levels (error,warn,info)
- `search` - Search term
- `limit` (default: 100) - Max logs to return
- `offset` (default: 0) - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [...],
    "total": 450,
    "hasMore": true
  }
}
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test:coverage
```

Test files:
- `__tests__/unit/lib/logger/logger.test.ts` - Logger tests
- `__tests__/unit/lib/monitoring/metrics-collector.test.ts` - Metrics collector tests
- `__tests__/unit/lib/auth/rbac.test.ts` - RBAC tests

## Production Considerations

### 1. Vercel Deployment

- **Logs**: In-memory storage only (read-only filesystem)
- **Metrics**: Use Redis for persistence across serverless invocations
- **Sentry**: Recommended for production error tracking

### 2. Performance

- **Metrics Storage**: Configure Redis for production (already set up)
- **Log Retention**: Limited to 1000 most recent logs in memory
- **Auto-refresh**: Dashboard polls every 60 seconds (configurable)

### 3. Security

- **RBAC**: All monitoring endpoints restricted to superadmin
- **Sensitive Data**: Automatically redacted in logs and Sentry
- **Sentry Tunnel**: Uses Next.js rewrite to bypass ad-blockers

### 4. Scaling

- **Metrics TTL**: 60-minute retention by default
- **Sentry Rate Limiting**: 10% sampling in production (configurable)
- **Log Rotation**: Automatic (keeps 1000 most recent)

## Troubleshooting

### Monitoring Dashboard Not Showing

1. **Check RBAC**: Ensure you're logged in as superadmin (ADMIN_EMAIL)
2. **Check Sidebar**: "Monitoring" link only visible to superadmins
3. **Check Console**: Look for API errors in browser console

### Sentry Not Capturing Errors

1. **Check DSN**: Verify `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. **Check Environment**: Sentry warnings appear in console if not configured
3. **Check Network**: Errors sent to `/monitoring` tunnel route

### Metrics Not Recording

1. **Check Storage**: Verify Redis connection if using Redis storage
2. **Check Middleware**: Ensure middleware is not being bypassed
3. **Check Logs**: Look for "Failed to record metrics" warnings

### Logs Not Appearing

1. **Check Level**: Logs below INFO level may not appear in production
2. **Check Retention**: Only 1000 most recent logs are kept
3. **Check Search**: Verify search terms match log content

## Future Enhancements

- [ ] Custom alert rules and notifications
- [ ] Grafana/Prometheus integration
- [ ] Log export to external services
- [ ] Performance benchmarking and trends
- [ ] Custom metrics and dashboards
- [ ] Webhook integrations for alerts

## Support

For issues or questions:
1. Check logs in `/admin/monitoring`
2. Review Sentry errors (if configured)
3. Check application logs: `npm run docker:logs`
