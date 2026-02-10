# Document 12: Production Launch Plan
**FleetWatch Device Inventory - Critical Path to Launch**

**Version:** 1.0  
**Last Updated:** February 5, 2026  
**Author:** Technical Project Management  
**Status:** Active Development Plan

---

## Executive Summary

### Current State Assessment

**Completion Status: 70-75%**

✅ **What's Built (Phases 0-3 Complete):**
- Database schema with comprehensive JSONB columns (17 nested data structures)
- Microsoft Graph API integration (526 lines)
- Device/User sync services with delta sync support
- 15 API routes fully functional
- 7 frontend pages (Dashboard, Inventory, Compliance, Analytics, Users, Device/User Detail)
- Vercel Cron jobs (hourly, daily, weekly)
- Azure AD OAuth authentication (no credentials fallback)
- NextAuth.js session management

❌ **Critical Gaps (Production Blockers):**
1. **NO RBAC** - All authenticated users have admin access (CRITICAL SECURITY RISK)
2. **NO Testing** - 0% test coverage (QUALITY RISK)
3. **NO Monitoring** - Can't detect production issues (OBSERVABILITY RISK)
4. **Settings Page Missing** - No admin configuration UI
5. **Delta Sync Incomplete** - Falls back to full sync on errors
6. **Data Coverage 40%** - Only 40% of available JSONB data surfaced in UI

### Timeline to Production

```
┌─────────────────────────────────────────────────────────┐
│  CRITICAL PATH: 2-3 Weeks to Production Launch          │
│  POST-LAUNCH: 6-9 Weeks for Data Coverage Completion    │
└─────────────────────────────────────────────────────────┘
```

**Go-Live Decision Point:** Week 3, Friday (Production Readiness Review)

---

## Table of Contents

1. [Critical Path to Production (Weeks 1-3)](#critical-path-to-production-weeks-1-3)
2. [Phase 6: Data Coverage Completion (Weeks 4-12)](#phase-6-data-coverage-completion-weeks-4-12)
3. [Detailed Task Breakdown](#detailed-task-breakdown)
4. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
5. [Testing Strategy](#testing-strategy)
6. [Deployment & Rollback Plan](#deployment--rollback-plan)
7. [Success Metrics](#success-metrics)
8. [Timeline Gantt Chart](#timeline-gantt-chart)

---

## Critical Path to Production (Weeks 1-3)

### Priority Matrix

| Priority | Task | Blocking Issue | Est. Time |
|----------|------|----------------|-----------|
| **CRITICAL** | RBAC Implementation | Security vulnerability | 3-4 days |
| **CRITICAL** | Testing Infrastructure | No quality assurance | 2-3 days |
| **CRITICAL** | Monitoring & Logging | Can't diagnose issues | 2 days |
| **HIGH** | Settings Page | No admin controls | 2-3 days |
| **HIGH** | Delta Sync Robustness | Performance issue | 2 days |
| **MEDIUM** | Error Boundaries | Poor UX on errors | 1 day |
| **MEDIUM** | Pre-launch Security Audit | Unknown vulnerabilities | 1 day |

### Week 1: Security & Foundation (Days 1-5)

#### Task 1.1: RBAC (Role-Based Access Control) - CRITICAL
**Priority:** CRITICAL  
**Duration:** 3-4 days  
**Blocking:** Production launch  
**Assignee:** Backend Developer + Security Lead

**Problem:** All authenticated users currently have admin access. Any user can:
- Delete devices
- Modify compliance policies
- Trigger manual syncs
- View all activity logs
- Access admin APIs

**Solution:** Implement 3-tier RBAC system:

```typescript
// Role hierarchy
enum UserRole {
  VIEWER = 'VIEWER',     // Read-only access
  ADMIN = 'ADMIN',       // Full access except system config
  SUPERADMIN = 'SUPERADMIN' // Full access including system config
}
```

**Files to Create/Modify:**

1. **Database Schema Update**
   ```typescript
   // lib/db/schema.ts (MODIFY)
   export const users = pgTable('users', {
     // ... existing fields
     role: varchar('role', { length: 20 }).notNull().default('VIEWER'),
     // Add role field with VIEWER as safe default
   });
   ```

2. **RBAC Helper Functions**
   ```typescript
   // lib/auth/rbac.ts (CREATE)
   import { auth } from '@/lib/auth/config';
   import { db } from '@/lib/db/drizzle';
   import { users } from '@/lib/db/schema';
   import { eq } from 'drizzle-orm';
   
   export type UserRole = 'VIEWER' | 'ADMIN' | 'SUPERADMIN';
   
   export async function requireRole(allowedRoles: UserRole[]): Promise<void> {
     const session = await auth();
     if (!session?.user?.email) {
       throw new Error('Unauthorized');
     }
     
     const user = await db.query.users.findFirst({
       where: eq(users.email, session.user.email),
     });
     
     if (!user || !allowedRoles.includes(user.role as UserRole)) {
       throw new Error('Forbidden: Insufficient permissions');
     }
   }
   
   export async function getUserRole(): Promise<UserRole | null> {
     const session = await auth();
     if (!session?.user?.email) return null;
     
     const user = await db.query.users.findFirst({
       where: eq(users.email, session.user.email),
       columns: { role: true },
     });
     
     return user?.role as UserRole || null;
   }
   
   export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
     const hierarchy = { VIEWER: 0, ADMIN: 1, SUPERADMIN: 2 };
     return hierarchy[userRole] >= hierarchy[requiredRole];
   }
   ```

3. **Middleware Protection**
   ```typescript
   // middleware.ts (MODIFY)
   import { auth } from '@/lib/auth/config';
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export async function middleware(request: NextRequest) {
     const session = await auth();
     
     // Protect admin routes
     if (request.nextUrl.pathname.startsWith('/admin')) {
       if (!session?.user) {
         return NextResponse.redirect(new URL('/login', request.url));
       }
       
       const user = await db.query.users.findFirst({
         where: eq(users.email, session.user.email),
       });
       
       if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
         return NextResponse.redirect(new URL('/dashboard', request.url));
       }
     }
     
     return NextResponse.next();
   }
   
   export const config = {
     matcher: ['/dashboard/:path*', '/admin/:path*', '/api/:path*'],
   };
   ```

4. **API Route Protection**
   ```typescript
   // app/api/devices/[id]/route.ts (MODIFY)
   import { requireRole } from '@/lib/auth/rbac';
   
   export async function DELETE(req: Request, { params }: { params: { id: string } }) {
     // Require ADMIN or SUPERADMIN role
     await requireRole(['ADMIN', 'SUPERADMIN']);
     
     // ... existing delete logic
   }
   
   export async function PATCH(req: Request, { params }: { params: { id: string } }) {
     // Require ADMIN or SUPERADMIN role
     await requireRole(['ADMIN', 'SUPERADMIN']);
     
     // ... existing update logic
   }
   ```

5. **UI Components with Role-Based Rendering**
   ```typescript
   // components/auth/RoleGuard.tsx (CREATE)
   'use client';
   
   import { useSession } from 'next-auth/react';
   import { useEffect, useState } from 'react';
   
   export function RoleGuard({ 
     children, 
     allowedRoles 
   }: { 
     children: React.ReactNode; 
     allowedRoles: UserRole[] 
   }) {
     const { data: session } = useSession();
     const [userRole, setUserRole] = useState<UserRole | null>(null);
     
     useEffect(() => {
       async function fetchRole() {
         const res = await fetch('/api/auth/role');
         const data = await res.json();
         setUserRole(data.role);
       }
       fetchRole();
     }, [session]);
     
     if (!userRole || !allowedRoles.includes(userRole)) {
       return null;
     }
     
     return <>{children}</>;
   }
   ```

6. **Admin User Management Page**
   ```typescript
   // app/(dashboard)/admin/users/page.tsx (CREATE)
   import { requireRole } from '@/lib/auth/rbac';
   import { UserManagementTable } from '@/components/admin/UserManagementTable';
   
   export default async function AdminUsersPage() {
     await requireRole(['SUPERADMIN']); // Only superadmins can manage roles
     
     return (
       <div>
         <h1>User Management</h1>
         <UserManagementTable />
       </div>
     );
   }
   ```

**Database Migration:**
```sql
-- drizzle/migrations/0009_add_user_roles.sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'VIEWER';

-- Set initial superadmin (replace with your admin email)
UPDATE users SET role = 'SUPERADMIN' WHERE email = 'admin@yourcompany.com';
```

**Acceptance Criteria:**
- [ ] Database migration adds `role` column with default VIEWER
- [ ] RBAC helper functions created (`requireRole`, `getUserRole`, `hasPermission`)
- [ ] Middleware protects `/admin/*` routes
- [ ] All destructive API routes require ADMIN+ role
- [ ] All sync/manual trigger endpoints require ADMIN+ role
- [ ] UI components hide admin actions for VIEWER role
- [ ] Admin user management page created (SUPERADMIN only)
- [ ] Manual testing confirms:
  - VIEWER can view but not modify
  - ADMIN can modify devices/users but not system settings
  - SUPERADMIN can manage user roles

**Testing Requirements:**
```typescript
// __tests__/unit/lib/auth/rbac.test.ts
describe('RBAC', () => {
  it('should require admin role for device deletion', async () => {
    // Mock viewer session
    // Expect 403 error
  });
  
  it('should allow superadmin to manage user roles', async () => {
    // Mock superadmin session
    // Expect success
  });
});
```

---

#### Task 1.2: Testing Infrastructure - CRITICAL
**Priority:** CRITICAL  
**Duration:** 2-3 days  
**Assignee:** Full Stack Developer + QA Lead

**Problem:** 0% test coverage means we can't verify:
- API routes return correct data
- RBAC works as expected
- Sync logic handles errors gracefully
- Frontend components render correctly

**Solution:** Set up testing framework with 3 layers:

**1. Unit Tests (Vitest)**
```typescript
// vitest.config.ts (CREATE)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

```typescript
// vitest.setup.ts (CREATE)
import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
  // Setup test database
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  // Cleanup test database
});
```

**2. Integration Tests (API Routes)**
```typescript
// __tests__/integration/api/devices.test.ts (CREATE)
import { describe, it, expect, beforeAll } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/devices/route';

describe('GET /api/devices', () => {
  it('should return devices with pagination', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { page: '1', pageSize: '20' },
    });
    
    const response = await GET(req as any);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.devices).toBeInstanceOf(Array);
    expect(data.pagination).toBeDefined();
  });
  
  it('should require admin role for POST', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { deviceName: 'Test Device' },
    });
    
    const response = await POST(req as any);
    expect(response.status).toBe(403); // Forbidden without ADMIN role
  });
});
```

**3. E2E Tests (Playwright)**
```typescript
// playwright.config.ts (CREATE)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// __tests__/e2e/device-list.spec.ts (CREATE)
import { test, expect } from '@playwright/test';

test('should display device list after login', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.click('text=Sign in with Azure AD');
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Navigate to inventory
  await page.click('text=Inventory');
  await expect(page).toHaveURL('/inventory');
  
  // Verify device table renders
  await expect(page.locator('table')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount.greaterThan(0);
});
```

**Files to Create:**

1. `vitest.config.ts` - Vitest configuration
2. `vitest.setup.ts` - Test setup (mocks, database)
3. `playwright.config.ts` - Playwright configuration
4. `__tests__/unit/lib/auth/rbac.test.ts` - RBAC tests
5. `__tests__/unit/lib/services/deviceSync.test.ts` - Sync service tests
6. `__tests__/integration/api/devices.test.ts` - Devices API tests
7. `__tests__/integration/api/users.test.ts` - Users API tests
8. `__tests__/e2e/device-list.spec.ts` - Device list E2E test
9. `__tests__/e2e/compliance.spec.ts` - Compliance page E2E test
10. `__tests__/e2e/rbac.spec.ts` - RBAC E2E test

**Package.json Updates:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run __tests__/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@vitest/coverage-v8": "^1.0.4",
    "@playwright/test": "^1.40.1",
    "node-mocks-http": "^1.14.0",
    "vitest": "^1.0.4"
  }
}
```

**Acceptance Criteria:**
- [ ] Vitest configured and running
- [ ] Playwright configured and running
- [ ] At least 10 unit tests covering RBAC
- [ ] At least 8 integration tests covering API routes
- [ ] At least 5 E2E tests covering critical paths
- [ ] Test coverage > 60% (target: 80% by production)
- [ ] CI/CD runs tests on every PR
- [ ] Tests pass locally and in CI

**Testing Requirements:**
- Unit tests: `npm run test`
- Integration tests: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- Coverage report: `npm run test:coverage`

---

#### Task 1.3: Monitoring & Logging - CRITICAL
**Priority:** CRITICAL  
**Duration:** 2 days  
**Assignee:** DevOps + Backend Developer

**Problem:** No way to:
- See when syncs fail
- Track API errors
- Monitor performance
- Debug production issues

**Solution:** Implement 3-tier monitoring:

**1. Application Logging (Winston + Vercel Logs)**
```typescript
// lib/logger/logger.ts (CREATE)
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fleetwatch' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export default logger;

// Convenience methods
export const logSync = (syncType: string, result: any) => {
  logger.info('Sync completed', {
    syncType,
    recordsSynced: result.recordsSynced,
    recordsFailed: result.recordsFailed,
    durationMs: result.durationMs,
  });
};

export const logError = (error: Error, context: any) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logApiRequest = (method: string, path: string, statusCode: number, durationMs: number) => {
  logger.info('API request', {
    method,
    path,
    statusCode,
    durationMs,
  });
};
```

**2. Error Tracking (Sentry)**
```typescript
// lib/monitoring/sentry.ts (CREATE)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV === 'production',
});

export default Sentry;
```

```typescript
// sentry.client.config.ts (CREATE)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

```typescript
// sentry.server.config.ts (CREATE)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**3. Performance Monitoring (Vercel Analytics)**
```typescript
// app/layout.tsx (MODIFY)
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

**4. Health Check Endpoint**
```typescript
// app/api/health/route.ts (CREATE)
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { graphClient } from '@/lib/graph/client';
import logger from '@/lib/logger/logger';

export async function GET() {
  const checks = {
    database: false,
    graphApi: false,
    redis: false,
  };

  try {
    // Check database
    await db.execute('SELECT 1');
    checks.database = true;
  } catch (error) {
    logger.error('Database health check failed', error);
  }

  try {
    // Check Graph API
    await graphClient.testConnection();
    checks.graphApi = true;
  } catch (error) {
    logger.error('Graph API health check failed', error);
  }

  try {
    // Check Redis (if using)
    const redis = await import('@/lib/redis/client');
    await redis.default.ping();
    checks.redis = true;
  } catch (error) {
    logger.error('Redis health check failed', error);
  }

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
```

**5. Sync Monitoring Dashboard**
```typescript
// app/(dashboard)/admin/monitoring/page.tsx (CREATE)
import { requireRole } from '@/lib/auth/rbac';
import { db } from '@/lib/db/drizzle';
import { syncLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export default async function MonitoringPage() {
  await requireRole(['ADMIN', 'SUPERADMIN']);

  const recentSyncs = await db.query.syncLogs.findMany({
    orderBy: [desc(syncLogs.startedAt)],
    limit: 50,
  });

  const failedSyncs = recentSyncs.filter(log => log.recordsFailed > 0);

  return (
    <div>
      <h1>Sync Monitoring</h1>
      
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          title="Total Syncs (24h)"
          value={recentSyncs.length}
        />
        <MetricCard
          title="Failed Syncs"
          value={failedSyncs.length}
          alert={failedSyncs.length > 5}
        />
        <MetricCard
          title="Avg Duration"
          value={`${Math.round(recentSyncs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / recentSyncs.length / 1000)}s`}
        />
      </div>

      <SyncLogsTable logs={recentSyncs} />
    </div>
  );
}
```

**Files to Create:**

1. `lib/logger/logger.ts` - Winston logger
2. `lib/monitoring/sentry.ts` - Sentry error tracking
3. `sentry.client.config.ts` - Sentry client config
4. `sentry.server.config.ts` - Sentry server config
5. `app/api/health/route.ts` - Health check endpoint
6. `app/(dashboard)/admin/monitoring/page.tsx` - Monitoring dashboard
7. `components/admin/SyncLogsTable.tsx` - Sync logs table component
8. `components/admin/MetricCard.tsx` - Metric card component

**Package.json Updates:**
```json
{
  "dependencies": {
    "@sentry/nextjs": "^7.91.0",
    "@vercel/analytics": "^1.1.1",
    "@vercel/speed-insights": "^1.0.2",
    "winston": "^3.11.0"
  }
}
```

**Environment Variables:**
```bash
# .env.local
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

**Acceptance Criteria:**
- [ ] Winston logger configured and used throughout app
- [ ] Sentry error tracking configured for client and server
- [ ] Vercel Analytics installed
- [ ] Health check endpoint returns correct status
- [ ] Sync monitoring dashboard shows recent syncs
- [ ] Failed syncs are logged with full context
- [ ] API errors are automatically sent to Sentry
- [ ] Performance metrics tracked in Vercel Analytics
- [ ] Manual testing confirms:
  - Errors appear in Sentry dashboard
  - Sync logs appear in monitoring page
  - Health check responds correctly

---

### Week 2: Settings & Robustness (Days 6-10)

#### Task 2.1: Settings Page - HIGH
**Priority:** HIGH  
**Duration:** 2-3 days  
**Assignee:** Full Stack Developer

**Problem:** No admin UI to:
- Configure sync schedules
- Set alert thresholds
- Manage Azure AD credentials
- Configure email notifications

**Solution:** Build comprehensive settings page

**Files to Create:**

1. **Settings Page**
```typescript
// app/(dashboard)/admin/settings/page.tsx (CREATE)
import { requireRole } from '@/lib/auth/rbac';
import { SettingsTabs } from '@/components/admin/SettingsTabs';

export default async function SettingsPage() {
  await requireRole(['SUPERADMIN']); // Only superadmins can change settings

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">System Settings</h1>
      <SettingsTabs />
    </div>
  );
}
```

2. **Settings Tabs Component**
```typescript
// components/admin/SettingsTabs.tsx (CREATE)
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SyncSettingsForm } from './SyncSettingsForm';
import { AzureADSettingsForm } from './AzureADSettingsForm';
import { AlertSettingsForm } from './AlertSettingsForm';
import { EmailSettingsForm } from './EmailSettingsForm';

export function SettingsTabs() {
  return (
    <Tabs defaultValue="sync">
      <TabsList>
        <TabsTrigger value="sync">Sync Schedule</TabsTrigger>
        <TabsTrigger value="azure">Azure AD</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
      </TabsList>

      <TabsContent value="sync">
        <SyncSettingsForm />
      </TabsContent>

      <TabsContent value="azure">
        <AzureADSettingsForm />
      </TabsContent>

      <TabsContent value="alerts">
        <AlertSettingsForm />
      </TabsContent>

      <TabsContent value="email">
        <EmailSettingsForm />
      </TabsContent>
    </Tabs>
  );
}
```

3. **Sync Settings Form**
```typescript
// components/admin/SyncSettingsForm.tsx (CREATE)
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

const syncSettingsSchema = z.object({
  incrementalSyncCron: z.string().min(1, 'Required'),
  deepSyncCron: z.string().min(1, 'Required'),
  fullSyncCron: z.string().min(1, 'Required'),
  deltaTokenExpiry: z.number().min(1).max(30),
});

export function SyncSettingsForm() {
  const form = useForm({
    resolver: zodResolver(syncSettingsSchema),
    defaultValues: {
      incrementalSyncCron: '0 * * * *', // Every hour
      deepSyncCron: '0 2 * * *', // Daily at 2am
      fullSyncCron: '0 2 * * 0', // Weekly on Sunday at 2am
      deltaTokenExpiry: 7, // 7 days
    },
  });

  const onSubmit = async (data: z.infer<typeof syncSettingsSchema>) => {
    const response = await fetch('/api/admin/settings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert('Sync settings saved!');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="incrementalSyncCron">Incremental Sync (Cron)</Label>
        <Input {...form.register('incrementalSyncCron')} />
        <p className="text-sm text-gray-500">Every hour: 0 * * * *</p>
      </div>

      <div>
        <Label htmlFor="deepSyncCron">Deep Sync (Cron)</Label>
        <Input {...form.register('deepSyncCron')} />
        <p className="text-sm text-gray-500">Daily at 2am: 0 2 * * *</p>
      </div>

      <div>
        <Label htmlFor="fullSyncCron">Full Sync (Cron)</Label>
        <Input {...form.register('fullSyncCron')} />
        <p className="text-sm text-gray-500">Weekly on Sunday: 0 2 * * 0</p>
      </div>

      <div>
        <Label htmlFor="deltaTokenExpiry">Delta Token Expiry (days)</Label>
        <Input type="number" {...form.register('deltaTokenExpiry', { valueAsNumber: true })} />
      </div>

      <Button type="submit">Save Settings</Button>
    </form>
  );
}
```

4. **Settings API Routes**
```typescript
// app/api/admin/settings/sync/route.ts (CREATE)
import { requireRole } from '@/lib/auth/rbac';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { systemSettings } from '@/lib/db/schema'; // New table

export async function POST(req: Request) {
  await requireRole(['SUPERADMIN']);

  const data = await req.json();

  // Save to database
  await db.insert(systemSettings).values({
    key: 'sync_settings',
    value: data,
  }).onConflictDoUpdate({
    target: systemSettings.key,
    set: { value: data, updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  await requireRole(['SUPERADMIN']);

  const settings = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'sync_settings'),
  });

  return NextResponse.json(settings?.value || {});
}
```

5. **System Settings Table**
```typescript
// lib/db/schema.ts (ADD)
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Acceptance Criteria:**
- [ ] Settings page accessible at `/admin/settings`
- [ ] Only SUPERADMIN can access settings
- [ ] Sync schedule configurable (cron expressions)
- [ ] Alert thresholds configurable (compliance %, storage %, battery %)
- [ ] Azure AD credentials securely stored
- [ ] Email notification settings saved
- [ ] Settings persist to database
- [ ] Settings API routes protected by RBAC
- [ ] Manual testing confirms:
  - Settings save successfully
  - Changed settings take effect
  - Invalid cron expressions rejected

---

#### Task 2.2: Delta Sync Robustness - HIGH
**Priority:** HIGH  
**Duration:** 2 days  
**Assignee:** Backend Developer

**Problem:** Delta sync currently falls back to full sync on any error, causing:
- Unnecessary API calls
- Longer sync times
- Risk of hitting Graph API rate limits

**Solution:** Improve delta sync error handling

**Files to Modify:**

```typescript
// lib/services/deviceSync.ts (MODIFY)
import logger, { logSync, logError } from '@/lib/logger/logger';

export async function syncDevicesDelta() {
  const startTime = Date.now();
  let recordsSynced = 0;
  let recordsFailed = 0;

  try {
    // Get delta token from database
    const lastSync = await db.query.syncLogs.findFirst({
      where: and(
        eq(syncLogs.syncType, 'DEVICE_DELTA'),
        isNotNull(syncLogs.deltaToken)
      ),
      orderBy: [desc(syncLogs.completedAt)],
    });

    const deltaToken = lastSync?.deltaToken;

    if (!deltaToken) {
      logger.warn('No delta token found, falling back to full sync');
      return await syncDevicesFull();
    }

    // Check if delta token is expired
    const tokenAge = Date.now() - new Date(lastSync.completedAt).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (tokenAge > maxAge) {
      logger.warn('Delta token expired, falling back to full sync');
      return await syncDevicesFull();
    }

    // Fetch devices delta from Graph API
    const { devices, deltaToken: newDeltaToken, errors } = await graphClient.fetchDevicesDelta(deltaToken);

    // Handle partial errors (some devices failed to sync)
    if (errors && errors.length > 0) {
      logger.warn('Partial delta sync errors', { errorCount: errors.length });
      recordsFailed = errors.length;

      // Log each error for investigation
      errors.forEach((error: any) => {
        logError(new Error(error.message), {
          deviceId: error.deviceId,
          syncType: 'DEVICE_DELTA',
        });
      });
    }

    // Process devices
    for (const device of devices) {
      try {
        await upsertDevice(device);
        recordsSynced++;
      } catch (error) {
        logger.error('Failed to upsert device', { deviceId: device.id, error });
        recordsFailed++;
      }
    }

    // Save new delta token
    await db.insert(syncLogs).values({
      syncType: 'DEVICE_DELTA',
      recordsSynced,
      recordsFailed,
      durationMs: Date.now() - startTime,
      deltaToken: newDeltaToken,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    logSync('DEVICE_DELTA', { recordsSynced, recordsFailed, durationMs: Date.now() - startTime });

    return { success: true, recordsSynced, recordsFailed };

  } catch (error) {
    logError(error as Error, { syncType: 'DEVICE_DELTA' });

    // Only fall back to full sync if delta link is explicitly invalid
    if (error.message.includes('Invalid delta link') || error.message.includes('Resource not found')) {
      logger.warn('Delta token invalid, falling back to full sync');
      return await syncDevicesFull();
    }

    // For transient errors (network, timeout), don't fall back - retry later
    throw error;
  }
}
```

**Acceptance Criteria:**
- [ ] Delta sync handles partial errors gracefully
- [ ] Delta sync only falls back to full sync on token expiry/invalidity
- [ ] Transient errors (network, timeout) are logged but don't trigger full sync
- [ ] All sync errors logged with full context
- [ ] Delta token expiry configurable via settings
- [ ] Manual testing confirms:
  - Delta sync succeeds with valid token
  - Delta sync falls back on expired token
  - Network errors don't trigger unnecessary full sync

---

#### Task 2.3: Error Boundaries - MEDIUM
**Priority:** MEDIUM  
**Duration:** 1 day  
**Assignee:** Frontend Developer

**Problem:** When errors occur in frontend, entire page crashes with white screen

**Solution:** Add React Error Boundaries

**Files to Create:**

```typescript
// components/error/ErrorBoundary.tsx (CREATE)
'use client';

import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Send to Sentry
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// app/error.tsx (CREATE)
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Error boundaries wrap critical components
- [ ] Errors logged to Sentry
- [ ] User sees friendly error message
- [ ] "Try Again" button resets error state
- [ ] Manual testing confirms:
  - Component errors don't crash entire page
  - Error message displays correctly

---

### Week 3: Pre-Launch Prep (Days 11-15)

#### Task 3.1: Security Audit - MEDIUM
**Priority:** MEDIUM  
**Duration:** 1 day  
**Assignee:** Security Lead

**Checklist:**

**Authentication & Authorization:**
- [ ] All API routes require authentication
- [ ] RBAC implemented and tested
- [ ] Session tokens secure (httpOnly, secure, sameSite)
- [ ] No hardcoded credentials in code
- [ ] Azure AD credentials stored in environment variables only

**Data Protection:**
- [ ] Database connection uses SSL
- [ ] Sensitive data encrypted at rest (JSONB columns)
- [ ] No PII logged to console/Sentry
- [ ] User emails not exposed in public APIs

**API Security:**
- [ ] Rate limiting on all public endpoints
- [ ] CSRF protection enabled
- [ ] SQL injection prevention (using Drizzle ORM)
- [ ] Input validation on all API routes (Zod schemas)

**Frontend Security:**
- [ ] XSS protection (React escapes by default)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] External links open with `rel="noopener noreferrer"`
- [ ] No sensitive data in client-side state

**Dependencies:**
- [ ] `npm audit` passes with no critical vulnerabilities
- [ ] Dependencies up to date
- [ ] Unused dependencies removed

**Tools to Use:**
```bash
# Run npm audit
npm audit --production

# Check for outdated packages
npm outdated

# OWASP ZAP scan (manual)
# https://www.zaproxy.org/
```

---

#### Task 3.2: Performance Optimization - MEDIUM
**Priority:** MEDIUM  
**Duration:** 1 day  
**Assignee:** Frontend Developer

**Optimizations:**

1. **Database Indexes**
```sql
-- Add indexes for commonly queried columns
CREATE INDEX idx_devices_is_compliant ON devices(is_compliant);
CREATE INDEX idx_devices_operating_system ON devices(operating_system);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_last_sync_at ON devices(last_sync_at);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);
```

2. **API Response Caching**
```typescript
// app/api/dashboard/overview/route.ts (MODIFY)
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  // ... existing logic
}
```

3. **Image Optimization**
```typescript
// next.config.ts (MODIFY)
export default {
  images: {
    domains: ['graph.microsoft.com'],
    formats: ['image/avif', 'image/webp'],
  },
};
```

4. **Code Splitting**
```typescript
// Use dynamic imports for heavy components
const DeviceDetailsDialog = dynamic(() => import('@/components/devices/DeviceDetailsDialog'));
```

**Acceptance Criteria:**
- [ ] Lighthouse score > 90
- [ ] Database queries use indexes
- [ ] API responses cached appropriately
- [ ] Large components lazy-loaded
- [ ] Images optimized
- [ ] Manual testing confirms:
  - Dashboard loads < 2 seconds
  - Inventory page loads < 3 seconds

---

#### Task 3.3: Production Deployment Checklist - CRITICAL
**Priority:** CRITICAL  
**Duration:** 1 day  
**Assignee:** DevOps + Tech Lead

**Pre-Deployment:**
- [ ] All tests passing (unit, integration, e2e)
- [ ] RBAC implemented and tested
- [ ] Monitoring configured (Sentry, Vercel Analytics)
- [ ] Health check endpoint working
- [ ] Environment variables configured in Vercel
- [ ] Database migrations applied
- [ ] Backup of production database created
- [ ] Rollback plan documented

**Deployment:**
- [ ] Deploy to production: `git push origin main`
- [ ] Verify deployment successful in Vercel dashboard
- [ ] Run smoke tests on production URL
- [ ] Check health endpoint: `curl https://fleetwatch.vercel.app/api/health`
- [ ] Verify cron jobs registered: Vercel Dashboard → Cron
- [ ] Monitor error rate in Sentry for 1 hour

**Post-Deployment:**
- [ ] Send launch announcement to organization
- [ ] Monitor sync logs for 24 hours
- [ ] Check for errors in Sentry dashboard
- [ ] Verify device/user sync working correctly
- [ ] Collect user feedback

**Rollback Plan:**
```bash
# If critical issues arise:
# 1. Revert to previous deployment
vercel rollback

# 2. Investigate logs
vercel logs --follow

# 3. Fix issue locally
# 4. Redeploy with fix
```

---

## Phase 6: Data Coverage Completion (Weeks 4-12)

### Overview

**Current Data Coverage: 40%**  
**Target Data Coverage: 100%**  
**Effort: 6-9 weeks post-launch**

### Priority Phases

#### Phase 6.1: Dashboard Enhancements (Week 4)
**Duration:** 3-4 days

**Missing Features:**
- Battery health alerts (low battery devices)
- Jailbroken/Rooted devices alert banner
- Malware detection alerts (CRITICAL)
- Recent device actions widget
- Lost Mode devices alert (iOS)

**Files to Create:**
```typescript
// components/dashboard/BatteryHealthAlert.tsx
// components/dashboard/SecurityAlertsSection.tsx
// components/dashboard/RecentActionsWidget.tsx
```

**Acceptance Criteria:**
- [ ] Dashboard shows battery health alerts for devices < 80%
- [ ] Security alerts banner shows jailbroken/malware devices
- [ ] Recent device actions widget shows last 10 actions
- [ ] Lost Mode alert for iOS devices
- [ ] All alerts clickable → navigate to device details

---

#### Phase 6.2: Device Details Page (Weeks 5-7)
**Duration:** 10-15 days

**Build comprehensive device deep-dive with 17 tabs:**

**Priority Tabs (Week 5):**
1. Overview (identity, status, quick actions)
2. Hardware Details (IMEI, MEID, battery, storage, memory)
3. Security & Compliance (encryption, Defender, TPM, BitLocker)
4. Network Configuration (IP, MAC, DNS, WiFi)

**Medium Priority Tabs (Week 6):**
5. Installed Applications (app list from `detectedAppsDetails` JSONB)
6. Device Actions History (wipe, lock, retire from `actionsHistory` JSONB)
7. Compliance Policies (which policies pass/fail)
8. Malware & Threats (from `malwareDetails` JSONB)

**Lower Priority Tabs (Week 7):**
9. Configuration Profiles
10. App Crashes
11. Warranty Information
12. Endpoint Analytics
13. Conditional Access
14. Organization & Groups
15. Lost Mode (iOS)
16. Exchange ActiveSync
17. Sync & Activity Timeline

**Files to Create:**
```typescript
// app/(dashboard)/devices/[id]/page.tsx (REBUILD)
// components/devices/DeviceDetailsTabs.tsx
// components/devices/tabs/OverviewTab.tsx
// components/devices/tabs/HardwareTab.tsx
// components/devices/tabs/SecurityTab.tsx
// components/devices/tabs/NetworkTab.tsx
// components/devices/tabs/ApplicationsTab.tsx
// components/devices/tabs/ActionsHistoryTab.tsx
// components/devices/tabs/CompliancePoliciesTab.tsx
// components/devices/tabs/MalwareTab.tsx
// ... (9 more tab components)
```

**Acceptance Criteria:**
- [ ] All 17 tabs render correctly
- [ ] JSONB data parsed and displayed
- [ ] Empty states for missing data
- [ ] Search/filter within tabs (applications, actions)
- [ ] Export data to CSV/JSON
- [ ] Manual testing confirms all data displays correctly

---

#### Phase 6.3: Reports System (Weeks 8-10)
**Duration:** 10-14 days

**Build 8 priority reports:**

**Compliance Reports:**
1. Devices Non-Compliant Report
2. Compliance SLA Report
3. Failed Policies Report

**Security Reports:**
4. Unencrypted Devices Report
5. Jailbroken/Rooted Devices Report
6. Malware Detection Report

**Hardware Reports:**
7. Battery Health Report
8. Low Storage Report

**Files to Create:**
```typescript
// app/(dashboard)/reports/page.tsx
// app/(dashboard)/reports/[reportType]/page.tsx
// components/reports/ReportBuilder.tsx
// components/reports/ReportExport.tsx (CSV, PDF)
// lib/reports/generators.ts (report generation logic)
```

**Acceptance Criteria:**
- [ ] 8 standard reports available
- [ ] Reports filterable by date range, OS, department
- [ ] Export to CSV/PDF
- [ ] Scheduled reports (email PDF on schedule)
- [ ] Report templates (save common report configs)

---

#### Phase 6.4: Analytics Enhancements (Weeks 11-12)
**Duration:** 7-10 days

**Add missing analytics from JSONB data:**
- Battery health trends
- Malware detection trends
- Security posture trends (TPM, Secure Boot, Defender)
- Jailbreak/Root detection trends
- Exchange ActiveSync trends
- App installation trends
- Configuration drift analysis

**Files to Create:**
```typescript
// app/(dashboard)/analytics/page.tsx (ENHANCE)
// components/analytics/BatteryHealthChart.tsx
// components/analytics/MalwareDetectionChart.tsx
// components/analytics/SecurityPostureChart.tsx
```

**Acceptance Criteria:**
- [ ] All missing charts implemented
- [ ] Charts responsive and interactive
- [ ] Data aggregated efficiently (pre-compute where possible)
- [ ] Export chart data to CSV

---

## Detailed Task Breakdown

### CRITICAL Tasks (Must Have for Production)

| Task ID | Task Name | Priority | Duration | Dependencies | Files to Create/Modify |
|---------|-----------|----------|----------|--------------|------------------------|
| C-1 | RBAC Implementation | CRITICAL | 3-4 days | None | `lib/auth/rbac.ts`, `lib/db/schema.ts` (add role column), all API routes, `middleware.ts` |
| C-2 | Testing Infrastructure | CRITICAL | 2-3 days | None | `vitest.config.ts`, `playwright.config.ts`, 20+ test files |
| C-3 | Monitoring & Logging | CRITICAL | 2 days | None | `lib/logger/logger.ts`, Sentry configs, `app/api/health/route.ts` |
| C-4 | Security Audit | CRITICAL | 1 day | C-1, C-2 | Audit checklist, fix any vulnerabilities |
| C-5 | Production Deployment | CRITICAL | 1 day | All above | Deploy to Vercel, smoke tests |

**Total Critical Path: 10-12 days (2-2.5 weeks)**

---

### HIGH Priority Tasks (Should Have for Launch)

| Task ID | Task Name | Priority | Duration | Dependencies | Files to Create/Modify |
|---------|-----------|----------|----------|--------------|------------------------|
| H-1 | Settings Page | HIGH | 2-3 days | C-1 (RBAC) | `app/(dashboard)/admin/settings/page.tsx`, 4+ settings form components |
| H-2 | Delta Sync Robustness | HIGH | 2 days | C-3 (Logging) | `lib/services/deviceSync.ts`, improve error handling |
| H-3 | Error Boundaries | HIGH | 1 day | None | `components/error/ErrorBoundary.tsx`, `app/error.tsx` |
| H-4 | Performance Optimization | HIGH | 1 day | None | Database indexes, API caching, code splitting |

**Total High Priority: 6-7 days**

---

### MEDIUM Priority Tasks (Nice to Have for Launch)

| Task ID | Task Name | Priority | Duration | Dependencies | Files to Create/Modify |
|---------|-----------|----------|----------|--------------|------------------------|
| M-1 | Dashboard Enhancements | MEDIUM | 3-4 days | None | `components/dashboard/BatteryHealthAlert.tsx`, etc. |
| M-2 | Compliance Page Drill-Down | MEDIUM | 2 days | None | `app/(dashboard)/compliance/[policyId]/page.tsx` |

---

## Risk Assessment & Mitigation

### Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|-------------|--------|----------|------------|
| **RBAC bugs allow unauthorized access** | Medium | Critical | HIGH | Comprehensive RBAC testing, security audit, penetration testing |
| **Delta sync fails in production** | Medium | High | MEDIUM | Improved error handling, fallback to full sync, monitoring alerts |
| **Graph API rate limiting** | Low | High | MEDIUM | Exponential backoff, respect retry-after headers, monitor API usage |
| **Database performance degradation** | Low | High | MEDIUM | Proper indexing, query optimization, connection pooling |
| **Monitoring blind spots** | Medium | Medium | MEDIUM | Health check endpoint, comprehensive logging, Sentry alerts |
| **User adoption resistance** | High | Medium | MEDIUM | Training sessions, documentation, support channel |
| **Deployment issues** | Low | Critical | MEDIUM | Staged rollout, smoke tests, rollback plan ready |
| **Data loss during sync** | Low | Critical | MEDIUM | Soft deletes, audit logs, database backups |

### Mitigation Strategies

**1. RBAC Security**
- Write comprehensive unit tests for `requireRole` function
- Test all API routes with different roles (VIEWER, ADMIN, SUPERADMIN)
- Security audit by external team
- Penetration testing of RBAC implementation

**2. Delta Sync Reliability**
- Improved error handling (only fall back on token expiry)
- Log all sync errors to Sentry with full context
- Alert on consecutive sync failures (> 3)
- Manual sync trigger for admins

**3. Graph API Rate Limiting**
- Respect `Retry-After` headers
- Exponential backoff on 429 errors
- Monitor API usage in Azure portal
- Delta sync reduces API calls by 90%+

**4. Database Performance**
- Add indexes on frequently queried columns
- Use `EXPLAIN ANALYZE` to optimize slow queries
- Connection pooling (Vercel Postgres handles this)
- Consider read replicas for analytics queries (future)

**5. Deployment Safety**
- Staged rollout: staging → 10% users → 100% users
- Smoke tests after deployment
- Monitor error rate in Sentry for 1 hour post-deploy
- Rollback plan documented and tested

---

## Testing Strategy

### Testing Pyramid

```
        /\
       /  \     E2E Tests (5%)
      /    \    - Critical user flows
     /------\   
    /        \  Integration Tests (25%)
   /          \ - API routes
  /------------\
 /              \ Unit Tests (70%)
/________________\ - RBAC, sync logic, helpers
```

### Unit Tests (70% of tests)

**Coverage Target: 80%+**

**Areas to Test:**
- `lib/auth/rbac.ts` - All RBAC functions
- `lib/services/deviceSync.ts` - Delta sync, full sync, error handling
- `lib/services/userSync.ts` - User sync logic
- `lib/graph/client.ts` - Graph API client methods
- `lib/logger/logger.ts` - Logging helpers
- Helper functions in `lib/utils.ts`

**Example Test:**
```typescript
// __tests__/unit/lib/auth/rbac.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireRole, hasPermission } from '@/lib/auth/rbac';

describe('RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireRole', () => {
    it('should throw error if user not authenticated', async () => {
      // Mock unauthenticated session
      vi.mock('@/lib/auth/config', () => ({
        auth: vi.fn().mockResolvedValue(null),
      }));

      await expect(requireRole(['ADMIN'])).rejects.toThrow('Unauthorized');
    });

    it('should throw error if user has insufficient permissions', async () => {
      // Mock VIEWER session trying to access ADMIN route
      vi.mock('@/lib/auth/config', () => ({
        auth: vi.fn().mockResolvedValue({ user: { email: 'viewer@company.com' } }),
      }));

      vi.mock('@/lib/db/drizzle', () => ({
        db: {
          query: {
            users: {
              findFirst: vi.fn().mockResolvedValue({ role: 'VIEWER' }),
            },
          },
        },
      }));

      await expect(requireRole(['ADMIN'])).rejects.toThrow('Forbidden');
    });

    it('should pass if user has required role', async () => {
      // Mock ADMIN session
      vi.mock('@/lib/auth/config', () => ({
        auth: vi.fn().mockResolvedValue({ user: { email: 'admin@company.com' } }),
      }));

      vi.mock('@/lib/db/drizzle', () => ({
        db: {
          query: {
            users: {
              findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
            },
          },
        },
      }));

      await expect(requireRole(['ADMIN'])).resolves.not.toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should return true if user role >= required role', () => {
      expect(hasPermission('SUPERADMIN', 'VIEWER')).toBe(true);
      expect(hasPermission('ADMIN', 'VIEWER')).toBe(true);
      expect(hasPermission('ADMIN', 'ADMIN')).toBe(true);
      expect(hasPermission('VIEWER', 'ADMIN')).toBe(false);
    });
  });
});
```

### Integration Tests (25% of tests)

**Areas to Test:**
- All API routes with different auth states
- Database operations (CRUD)
- Sync services with real database (test DB)

**Example Test:**
```typescript
// __tests__/integration/api/devices.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PATCH, DELETE } from '@/app/api/devices/[id]/route';
import { createMocks } from 'node-mocks-http';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';

describe('GET /api/devices/[id]', () => {
  let testDeviceId: string;

  beforeAll(async () => {
    // Insert test device
    const [device] = await db.insert(devices).values({
      azureId: 'test-azure-id',
      deviceName: 'Test Device',
      operatingSystem: 'Windows',
      isCompliant: true,
      isEncrypted: true,
    }).returning();

    testDeviceId = device.id;
  });

  afterAll(async () => {
    // Cleanup test device
    await db.delete(devices).where(eq(devices.id, testDeviceId));
  });

  it('should return device by ID', async () => {
    const { req } = createMocks({
      method: 'GET',
    });

    const response = await GET(req as any, { params: { id: testDeviceId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.device.id).toBe(testDeviceId);
    expect(data.device.deviceName).toBe('Test Device');
  });

  it('should return 404 for non-existent device', async () => {
    const { req } = createMocks({
      method: 'GET',
    });

    const response = await GET(req as any, { params: { id: 'non-existent-id' } });
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/devices/[id]', () => {
  it('should require ADMIN role', async () => {
    // Mock VIEWER session
    vi.mock('@/lib/auth/config', () => ({
      auth: vi.fn().mockResolvedValue({ user: { email: 'viewer@company.com' } }),
    }));

    const { req } = createMocks({
      method: 'PATCH',
      body: { deviceName: 'Updated Name' },
    });

    const response = await PATCH(req as any, { params: { id: testDeviceId } });
    expect(response.status).toBe(403); // Forbidden
  });
});
```

### E2E Tests (5% of tests)

**Critical User Flows:**
1. Login → Dashboard → View device list
2. Login → Device details → View all tabs
3. Login (Admin) → Trigger manual sync
4. Login (Admin) → Manage user roles
5. Login (Viewer) → Verify no admin actions visible

**Example Test:**
```typescript
// __tests__/e2e/rbac.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RBAC', () => {
  test('should hide admin actions for VIEWER role', async ({ page }) => {
    // Login as VIEWER
    await page.goto('/login');
    await page.fill('input[name="email"]', 'viewer@company.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Navigate to inventory
    await page.click('text=Inventory');
    await expect(page).toHaveURL('/inventory');

    // Verify no "Delete Device" button visible
    await expect(page.locator('button:has-text("Delete")')).toHaveCount(0);

    // Verify no "Trigger Sync" button visible
    await expect(page.locator('button:has-text("Trigger Sync")')).toHaveCount(0);
  });

  test('should allow admin actions for ADMIN role', async ({ page }) => {
    // Login as ADMIN
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@company.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Navigate to inventory
    await page.click('text=Inventory');
    await expect(page).toHaveURL('/inventory');

    // Verify "Trigger Sync" button visible
    await expect(page.locator('button:has-text("Trigger Sync")')).toBeVisible();

    // Click first device row
    await page.locator('tbody tr').first().click();

    // Verify "Delete Device" button visible in device details
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });
});
```

---

## Deployment & Rollback Plan

### Pre-Deployment Checklist

**Code Quality:**
- [ ] All unit tests passing (> 80% coverage)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] ESLint passing with no errors
- [ ] TypeScript compilation successful
- [ ] No console.log statements in production code

**Security:**
- [ ] RBAC implemented and tested
- [ ] Security audit completed
- [ ] `npm audit` passes with no critical vulnerabilities
- [ ] Environment variables configured in Vercel
- [ ] No hardcoded credentials in code

**Monitoring:**
- [ ] Sentry configured for error tracking
- [ ] Vercel Analytics configured
- [ ] Winston logger configured
- [ ] Health check endpoint working
- [ ] Sync monitoring dashboard accessible

**Database:**
- [ ] Migrations applied to production database
- [ ] Database indexes created
- [ ] Database backup created (Vercel Postgres)
- [ ] Connection pooling configured

**Documentation:**
- [ ] README.md updated with deployment instructions
- [ ] CHANGELOG.md updated with v1.0 release notes
- [ ] User guide created (for end users)
- [ ] Admin guide created (for admins/superadmins)

---

### Deployment Process

**Step 1: Final Testing (Day -1)**
```bash
# Run full test suite locally
npm run test
npm run test:integration
npm run test:e2e

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint

# Build production bundle locally
npm run build
```

**Step 2: Staging Deployment (Day 0, Morning)**
```bash
# Deploy to staging (if using Vercel preview)
git checkout staging
git merge main
git push origin staging

# Verify staging deployment
curl https://fleetwatch-staging.vercel.app/api/health

# Run smoke tests on staging
npm run test:e2e -- --baseURL https://fleetwatch-staging.vercel.app
```

**Step 3: Production Deployment (Day 0, Afternoon)**
```bash
# Merge to main and deploy
git checkout main
git merge staging
git tag -a v1.0.0 -m "Production launch v1.0.0"
git push origin main --tags

# Vercel auto-deploys from main branch
# Monitor deployment in Vercel dashboard
vercel logs --follow
```

**Step 4: Smoke Tests (Day 0, After Deployment)**
```bash
# Health check
curl https://fleetwatch.vercel.app/api/health

# Verify authentication
curl https://fleetwatch.vercel.app/api/auth/session

# Verify cron jobs registered
# Check Vercel Dashboard → Cron
```

**Step 5: Monitoring (Day 0-1)**
- Monitor Sentry dashboard for errors (every 2 hours)
- Check Vercel Analytics for traffic/performance
- Verify sync jobs running successfully
- Check sync logs in monitoring dashboard
- Collect user feedback

---

### Rollback Plan

**If Critical Issues Arise:**

**Option 1: Rollback to Previous Deployment (< 5 minutes)**
```bash
# In Vercel dashboard:
# 1. Go to Deployments
# 2. Find previous working deployment
# 3. Click "..." → Promote to Production

# Or via CLI:
vercel rollback
```

**Option 2: Fix Forward (10-30 minutes)**
```bash
# If issue is minor and fixable quickly:
# 1. Fix issue locally
# 2. Test fix
# 3. Deploy fix immediately

git add .
git commit -m "hotfix: fix critical issue"
git push origin main
```

**Option 3: Revert to Legacy System (1 hour)**
```bash
# If new system completely broken:
# 1. Promote previous deployment
# 2. Restart legacy Docker containers
# 3. Update DNS to point back to legacy system
# 4. Investigate issue in development

docker-compose -f legacy/docker-compose.yml up -d
```

**Communication During Rollback:**
- Notify all users via email/Slack
- Update status page (if available)
- Provide ETA for fix
- Explain what went wrong (transparency)

---

## Success Metrics

### Launch Criteria (Go/No-Go Decision)

**Must Have (Go-Live Blockers):**
- [ ] All CRITICAL tasks completed (RBAC, Testing, Monitoring)
- [ ] Security audit passed with no critical findings
- [ ] All tests passing (unit, integration, e2e)
- [ ] Health check endpoint returns 200
- [ ] Staging deployment successful
- [ ] Rollback plan tested

**Should Have (Can Launch Without, But Fix Soon):**
- [ ] Settings page functional
- [ ] Delta sync robust
- [ ] Error boundaries in place
- [ ] Performance optimized (Lighthouse > 90)

**Nice to Have (Post-Launch):**
- [ ] Data coverage > 60%
- [ ] Device details page with all tabs
- [ ] Reports system

---

### Post-Launch Success Metrics

**Week 1 (Stabilization):**
- [ ] Zero critical errors in Sentry
- [ ] Sync success rate > 95%
- [ ] Page load time < 2 seconds (p95)
- [ ] User adoption > 50%
- [ ] Zero security incidents

**Week 4 (Adoption):**
- [ ] User adoption > 90%
- [ ] Sync success rate > 98%
- [ ] Zero critical bugs
- [ ] User satisfaction score > 4/5
- [ ] Support ticket volume < 5/week

**Week 12 (Full Maturity):**
- [ ] 100% user adoption
- [ ] Data coverage 100%
- [ ] All Phase 6 features complete
- [ ] Test coverage > 80%
- [ ] Zero P0/P1 bugs in backlog

---

### KPIs to Track

**Technical Metrics:**
- Error rate (Sentry)
- API response time (p50, p95, p99)
- Database query performance
- Sync success rate
- Sync duration (incremental, deep, full)
- Test coverage %
- Deployment frequency
- Mean time to recovery (MTTR)

**User Metrics:**
- Daily active users
- User adoption rate
- Page views per session
- Time on site
- User satisfaction score (NPS)
- Support ticket volume
- Feature usage (which pages most visited)

**Business Metrics:**
- Compliance rate (% of devices compliant)
- Encryption rate (% of devices encrypted)
- Device lifecycle (average device age)
- Storage utilization (% of devices > 90% full)
- Security posture (% with TPM, Secure Boot, Defender enabled)

---

## Timeline Gantt Chart

```mermaid
gantt
    title FleetWatch Production Launch Timeline
    dateFormat YYYY-MM-DD
    
    section Week 1: Security
    RBAC Implementation                :crit, c1, 2026-02-06, 4d
    Testing Infrastructure             :crit, c2, 2026-02-06, 3d
    Monitoring & Logging               :crit, c3, 2026-02-09, 2d
    
    section Week 2: Robustness
    Settings Page                      :high, h1, after c1, 3d
    Delta Sync Robustness              :high, h2, after c3, 2d
    Error Boundaries                   :h3, 2026-02-12, 1d
    
    section Week 3: Launch Prep
    Security Audit                     :crit, c4, 2026-02-17, 1d
    Performance Optimization           :h4, 2026-02-18, 1d
    Staging Deployment                 :crit, 2026-02-19, 0.5d
    Production Deployment              :crit, milestone, c5, 2026-02-19, 0.5d
    Monitoring & Stabilization         :crit, 2026-02-20, 2d
    
    section Week 4: Post-Launch
    Dashboard Enhancements             :m1, 2026-02-23, 4d
    Compliance Drill-Down              :m2, 2026-02-24, 2d
    
    section Weeks 5-7: Device Details
    Device Details Phase 1 (Priority)  :2026-02-27, 5d
    Device Details Phase 2 (Medium)    :2026-03-04, 5d
    Device Details Phase 3 (Lower)     :2026-03-11, 5d
    
    section Weeks 8-10: Reports
    Compliance Reports                 :2026-03-18, 5d
    Security Reports                   :2026-03-23, 5d
    Hardware Reports                   :2026-03-28, 4d
    
    section Weeks 11-12: Analytics
    Analytics Enhancements             :2026-04-01, 10d
```

---

## Appendix A: File Creation Checklist

### CRITICAL Path Files

**RBAC:**
- [ ] `lib/auth/rbac.ts` (CREATE)
- [ ] `lib/db/schema.ts` (MODIFY - add role column)
- [ ] `middleware.ts` (MODIFY - protect admin routes)
- [ ] `components/auth/RoleGuard.tsx` (CREATE)
- [ ] `app/(dashboard)/admin/users/page.tsx` (CREATE)
- [ ] `app/api/auth/role/route.ts` (CREATE)
- [ ] `drizzle/migrations/0009_add_user_roles.sql` (CREATE)

**Testing:**
- [ ] `vitest.config.ts` (CREATE)
- [ ] `vitest.setup.ts` (CREATE)
- [ ] `playwright.config.ts` (CREATE)
- [ ] `__tests__/unit/lib/auth/rbac.test.ts` (CREATE)
- [ ] `__tests__/unit/lib/services/deviceSync.test.ts` (CREATE)
- [ ] `__tests__/integration/api/devices.test.ts` (CREATE)
- [ ] `__tests__/integration/api/users.test.ts` (CREATE)
- [ ] `__tests__/e2e/device-list.spec.ts` (CREATE)
- [ ] `__tests__/e2e/compliance.spec.ts` (CREATE)
- [ ] `__tests__/e2e/rbac.spec.ts` (CREATE)

**Monitoring:**
- [ ] `lib/logger/logger.ts` (CREATE)
- [ ] `lib/monitoring/sentry.ts` (CREATE)
- [ ] `sentry.client.config.ts` (CREATE)
- [ ] `sentry.server.config.ts` (CREATE)
- [ ] `app/api/health/route.ts` (CREATE)
- [ ] `app/(dashboard)/admin/monitoring/page.tsx` (CREATE)
- [ ] `components/admin/SyncLogsTable.tsx` (CREATE)
- [ ] `components/admin/MetricCard.tsx` (CREATE)

**Settings:**
- [ ] `app/(dashboard)/admin/settings/page.tsx` (CREATE)
- [ ] `components/admin/SettingsTabs.tsx` (CREATE)
- [ ] `components/admin/SyncSettingsForm.tsx` (CREATE)
- [ ] `components/admin/AzureADSettingsForm.tsx` (CREATE)
- [ ] `components/admin/AlertSettingsForm.tsx` (CREATE)
- [ ] `components/admin/EmailSettingsForm.tsx` (CREATE)
- [ ] `app/api/admin/settings/sync/route.ts` (CREATE)
- [ ] `lib/db/schema.ts` (MODIFY - add system_settings table)

**Error Boundaries:**
- [ ] `components/error/ErrorBoundary.tsx` (CREATE)
- [ ] `app/error.tsx` (CREATE)

---

## Appendix B: Database Migrations

### Migration 0009: Add User Roles

```sql
-- drizzle/migrations/0009_add_user_roles.sql

-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'VIEWER';

-- Create index on role for faster queries
CREATE INDEX idx_users_role ON users(role);

-- Set initial superadmin (REPLACE WITH YOUR ADMIN EMAIL)
UPDATE users SET role = 'SUPERADMIN' WHERE email = 'admin@yourcompany.com';

-- Add comment
COMMENT ON COLUMN users.role IS 'User role: VIEWER (read-only), ADMIN (full access except system config), SUPERADMIN (full access)';
```

### Migration 0010: Add System Settings Table

```sql
-- drizzle/migrations/0010_add_system_settings.sql

-- Create system_settings table
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on key for faster queries
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- Add comment
COMMENT ON TABLE system_settings IS 'System-wide configuration settings (sync schedules, alert thresholds, etc.)';
```

### Migration 0011: Add Database Indexes for Performance

```sql
-- drizzle/migrations/0011_add_performance_indexes.sql

-- Devices table indexes (commonly queried columns)
CREATE INDEX idx_devices_is_compliant ON devices(is_compliant);
CREATE INDEX idx_devices_operating_system ON devices(operating_system);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_last_sync_at ON devices(last_sync_at);
CREATE INDEX idx_devices_enrolled_at ON devices(enrolled_at);
CREATE INDEX idx_devices_chassis_type ON devices(chassis_type);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- Sync logs indexes
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);

-- Compliance history indexes
CREATE INDEX idx_compliance_history_device_id ON compliance_history(device_id);
CREATE INDEX idx_compliance_history_recorded_at ON compliance_history(recorded_at);

-- Storage history indexes
CREATE INDEX idx_storage_history_device_id ON storage_history(device_id);
CREATE INDEX idx_storage_history_recorded_at ON storage_history(recorded_at);
```

---

## Appendix C: Environment Variables

### Required Environment Variables

```bash
# .env.local (development)
# .env.production (production - configure in Vercel)

# ========== DATABASE ==========
POSTGRES_URL=postgres://user:password@localhost:5432/fleetwatch_dev
POSTGRES_URL_NON_POOLING=postgres://user:password@localhost:5432/fleetwatch_dev

# ========== AZURE AD ==========
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret

# ========== NEXTAUTH.JS ==========
NEXTAUTH_SECRET=your-nextauth-secret-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000 # Production: https://fleetwatch.vercel.app

# ========== CRON SECURITY ==========
CRON_SECRET=your-cron-secret-generate-with-openssl-rand-base64-32

# ========== MONITORING ==========
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# ========== EMERGENCY ADMIN ==========
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD_HASH=bcrypt-hash-of-emergency-admin-password

# ========== REDIS (OPTIONAL) ==========
REDIS_URL=redis://localhost:6379

# ========== DEBUG ==========
NODE_ENV=development # production in Vercel
DEBUG=true # false in production
```

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-05 | Technical PM | Initial production launch plan created |

---

**End of Production Launch Plan** - Ready for execution!
