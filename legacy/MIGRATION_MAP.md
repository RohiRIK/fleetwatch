# Legacy to New Code Migration Map

**Purpose:** This document maps all legacy code files to their new locations in Device Inventory v2. Use this as a reference when porting functionality from the legacy Docker/OpenSearch system to the new Next.js/Vercel architecture.

---

## Migration Status Legend

| Symbol | Status | Description |
|--------|--------|-------------|
| ⏳ | TODO | Not started yet |
| 🚧 | IN PROGRESS | Currently being migrated |
| ✅ | COMPLETE | Migration finished and tested |
| ⛔ | DEPRECATED | No longer needed in new architecture |

---

## 1. Fetcher Container → Vercel Cron + Sync Service

### Legacy TypeScript (Bun) → Next.js TypeScript Services

**IMPORTANT:** The legacy fetcher is written in TypeScript and runs on Bun, NOT Python. We're migrating from Docker+Bun to Vercel serverless TypeScript.

| Legacy File | New File | Functionality | Status | Notes |
|-------------|----------|---------------|--------|-------|
| `fetcher/src/sync.ts` (or similar) | `lib/services/sync-service.ts` | Main sync orchestration (devices + users) | ⏳ TODO | Port existing TypeScript sync logic, adapt for Vercel serverless |
| `fetcher/src/graph-client.ts` (or similar) | `lib/graph/graph-client.ts` | Microsoft Graph API wrapper | ⏳ TODO | Refactor existing TypeScript Graph client for Next.js environment |
| `fetcher/src/auth.ts` (or similar) | `lib/graph/auth-provider.ts` | Azure AD authentication for Graph API | ⏳ TODO | Refactor existing TypeScript auth logic using `@azure/identity` |
| `fetcher/src/opensearch-writer.ts` (or similar) | ⛔ DEPRECATED | OpenSearch bulk write operations | ⛔ N/A | Replaced by Drizzle ORM + Postgres |
| `fetcher/src/config.ts` (or similar) | `lib/config.ts` (optional) | Environment variable management | ⏳ TODO | Use Next.js `process.env` directly |
| `fetcher/src/logger.ts` (or similar) | ⛔ DEPRECATED | File-based logging | ⛔ N/A | Use Vercel logs (console.log) |
| `fetcher/crontab` | `app/api/cron/sync/route.ts` + `vercel.json` | Cron job trigger | ⏳ TODO | Replace Docker crontab with Vercel Cron config |
| `fetcher/package.json` | `package.json` (root) | TypeScript/Bun dependencies | ⏳ TODO | Merge dependencies into root package.json |
| `fetcher/Dockerfile` | ⛔ DEPRECATED | Docker container definition | ⛔ N/A | No containers needed (serverless) |

### Key Migration Tasks for Fetcher

- [ ] **Task F1:** Review and refactor `fetcher/src/` TypeScript files
  - Identify actual file structure in `legacy/fetcher/src/`
  - Port sync logic to `sync-service.ts::syncDevices()`
  - Replace OpenSearch writes with Drizzle ORM: `db.insert(devices).values()`
  - Add delta link storage in `sync_logs` table
  
- [ ] **Task F2:** Refactor Graph API client for Next.js
  - Review existing TypeScript Graph client implementation
  - Adapt for serverless environment (no long-running connections)
  - Ensure delta query support with `@odata.deltaLink`
  
- [ ] **Task F3:** Adapt authentication for Vercel environment
  - Review existing TypeScript auth implementation
  - Ensure compatibility with Next.js serverless functions
  - Use `@azure/identity` with proper credential caching
  
- [ ] **Task F4:** Create Vercel Cron endpoint
  - Create `app/api/cron/sync/route.ts` with GET handler
  - Add `vercel.json` with cron schedule: `*/30 * * * *`
  - Add CRON_SECRET validation

---

## 2. api-ts Container → Next.js Server Actions

### Express.js Routes → Server Actions

| Legacy File | New File | Functionality | Status | Notes |
|-------------|----------|---------------|--------|-------|
| `api-ts/src/routes/devices.ts` | `lib/actions/device-actions.ts` | Device CRUD operations | ⏳ TODO | Convert REST endpoints to Server Actions |
| `api-ts/src/routes/users.ts` | `lib/actions/user-actions.ts` | User management | ⏳ TODO | Convert REST endpoints to Server Actions |
| `api-ts/src/routes/sync.ts` | `lib/actions/sync-actions.ts` | Manual sync triggers | ⏳ TODO | Convert to Server Actions (admin only) |
| `api-ts/src/routes/dashboard.ts` | `lib/actions/dashboard-actions.ts` | Dashboard metrics | ⏳ TODO | Convert to Server Actions |
| `api-ts/src/routes/activity.ts` | `lib/actions/activity-actions.ts` | Activity log queries | ⏳ TODO | Convert to Server Actions (admin only) |
| `api-ts/src/middleware/auth.ts` | `lib/auth/rbac.ts` | Authentication middleware | ⏳ TODO | Replace Express middleware with NextAuth.js + helper functions |
| `api-ts/src/middleware/rbac.ts` | `lib/auth/rbac.ts` | Role-based access control | ⏳ TODO | Merge into `requireAuth()` and `requireAdmin()` helpers |
| `api-ts/src/middleware/error.ts` | ⛔ DEPRECATED | Express error handler | ⛔ N/A | Use Server Action error handling pattern |
| `api-ts/src/db/opensearch.ts` | `lib/db/drizzle.ts` + `lib/db/schema.ts` | Database client | ⏳ TODO | Replace OpenSearch client with Drizzle ORM |
| `api-ts/src/models/device.ts` | `types/models.ts` | TypeScript types | ⏳ TODO | Port to shared types file |
| `api-ts/src/utils/validation.ts` | `lib/validation/schemas.ts` | Request validation | ⏳ TODO | Replace with Zod schemas |
| `api-ts/src/app.ts` | ⛔ DEPRECATED | Express app initialization | ⛔ N/A | No Express server needed |
| `api-ts/package.json` | `package.json` (root) | Node.js dependencies | ⏳ TODO | Merge dependencies into root package.json |
| `api-ts/Dockerfile` | ⛔ DEPRECATED | Docker container definition | ⛔ N/A | No containers needed (serverless) |

### REST Endpoint → Server Action Mapping

#### Device Endpoints

| Legacy REST Endpoint | New Server Action | HTTP Method → Function |
|---------------------|-------------------|------------------------|
| `GET /api/devices` | `getDevices(params)` | REST → Direct function call |
| `GET /api/devices/:id` | `getDeviceById(id)` | REST → Direct function call |
| `PUT /api/devices/:id` | `updateDevice({ deviceId, updates })` | REST → Direct function call |
| `DELETE /api/devices/:id` | `decommissionDevice(deviceId)` | REST → Direct function call |

**Migration Example:**

```typescript
// OLD: api-ts/src/routes/devices.ts (Express)
router.get('/devices', authMiddleware, async (req, res) => {
  const { page, pageSize, search } = req.query;
  const devices = await opensearchClient.search({
    index: 'devices',
    body: { query: { match: { name: search } } }
  });
  res.json({ success: true, data: devices });
});

// NEW: lib/actions/device-actions.ts (Server Action)
'use server';
export async function getDevices(params: GetDevicesParams): Promise<ActionResponse<PaginatedDevices>> {
  const session = await requireAuth(); // RBAC check
  const validated = GetDevicesSchema.parse(params); // Zod validation
  
  const devices = await db
    .select()
    .from(devices)
    .where(ilike(devices.name, `%${validated.search}%`))
    .limit(validated.pageSize)
    .offset((validated.page - 1) * validated.pageSize);
  
  return { success: true, data: { devices, pagination: {...} } };
}
```

#### User Endpoints

| Legacy REST Endpoint | New Server Action | HTTP Method → Function |
|---------------------|-------------------|------------------------|
| `GET /api/users` | `getUsers(params)` | REST → Direct function call |
| `GET /api/users/:id` | `getUserById(id)` | REST → Direct function call |
| `PUT /api/users/:id/role` | `updateUserRole({ userId, role })` | REST → Direct function call |

#### Sync Endpoints

| Legacy REST Endpoint | New Server Action | HTTP Method → Function |
|---------------------|-------------------|------------------------|
| `POST /api/sync/trigger` | `triggerManualSync()` | REST → Direct function call |
| `GET /api/sync/status` | `getSyncStatus()` | REST → Direct function call |

#### Dashboard Endpoints

| Legacy REST Endpoint | New Server Action | HTTP Method → Function |
|---------------------|-------------------|------------------------|
| `GET /api/dashboard/metrics` | `getDashboardMetrics()` | REST → Direct function call |

### Key Migration Tasks for api-ts

- [ ] **Task A1:** Convert device endpoints to Server Actions
  - Port `GET /api/devices` → `getDevices()` with pagination
  - Port `GET /api/devices/:id` → `getDeviceById()`
  - Port `PUT /api/devices/:id` → `updateDevice()`
  - Port `DELETE /api/devices/:id` → `decommissionDevice()`
  - Add RBAC checks using `requireAuth()` and `requireAdmin()`
  
- [ ] **Task A2:** Convert user endpoints to Server Actions
  - Port `GET /api/users` → `getUsers()`
  - Port `PUT /api/users/:id/role` → `updateUserRole()`
  - Admin-only access enforcement
  
- [ ] **Task A3:** Convert sync endpoints to Server Actions
  - Port `POST /api/sync/trigger` → `triggerManualSync()`
  - Port `GET /api/sync/status` → `getSyncStatus()`
  
- [ ] **Task A4:** Replace OpenSearch queries with Drizzle ORM
  - Map `opensearch.search()` → `db.select().from()`
  - Map `opensearch.index()` → `db.insert().values()`
  - Map `opensearch.update()` → `db.update().set()`
  - Map `opensearch.delete()` → `db.delete().where()`
  
- [ ] **Task A5:** Replace Express auth middleware with NextAuth.js
  - Remove `authMiddleware` and `rbacMiddleware`
  - Add `getServerSession()` to each Server Action
  - Implement `requireAuth()` and `requireAdmin()` helpers

---

## 3. Frontend App → Next.js App Router

### React SPA → Next.js Pages

| Legacy File | New File | Functionality | Status | Notes |
|-------------|----------|---------------|--------|-------|
| `frontend/src/pages/Login.tsx` | `app/login/page.tsx` | Login page | ⏳ TODO | Use NextAuth.js signIn() |
| `frontend/src/pages/Dashboard.tsx` | `app/dashboard/page.tsx` | Dashboard with metrics | ⏳ TODO | Server Component fetching data |
| `frontend/src/pages/DeviceList.tsx` | `app/devices/page.tsx` | Device list with table | ⏳ TODO | Server Component + Client Table |
| `frontend/src/pages/DeviceDetail.tsx` | `app/devices/[id]/page.tsx` | Device detail view | ⏳ TODO | Dynamic route with Server Component |
| `frontend/src/pages/UserList.tsx` | `app/users/page.tsx` | User management | ⏳ TODO | Server Component |
| `frontend/src/pages/ActivityLogs.tsx` | `app/activity-logs/page.tsx` | Activity log viewer (admin) | ⏳ TODO | Server Component with RBAC |
| `frontend/src/components/DeviceTable.tsx` | `components/devices/device-table.tsx` | Device table with filters | ⏳ TODO | Client Component with TanStack Table |
| `frontend/src/components/MetricCard.tsx` | `components/dashboard/metric-card.tsx` | Dashboard metric card | ⏳ TODO | Client Component |
| `frontend/src/components/Navbar.tsx` | `components/layout/header.tsx` | Top navigation bar | ⏳ TODO | Client Component with useSession() |
| `frontend/src/components/Sidebar.tsx` | `components/layout/sidebar.tsx` | Side navigation | ⏳ TODO | Client Component with role-based menu |
| `frontend/src/hooks/useAuth.ts` | `hooks/useRole.ts` | Authentication hook | ⏳ TODO | Replace with NextAuth `useSession()` wrapper |
| `frontend/src/hooks/useDevices.ts` | ⛔ DEPRECATED | Data fetching hook | ⛔ N/A | Use Server Components to fetch data |
| `frontend/src/api/client.ts` | ⛔ DEPRECATED | Axios API client | ⛔ N/A | Call Server Actions directly |
| `frontend/src/utils/formatDate.ts` | `lib/utils/date.ts` | Date formatting utility | ⏳ TODO | Port to shared utils |
| `frontend/package.json` | `package.json` (root) | Frontend dependencies | ⏳ TODO | Merge dependencies |

### Key Migration Tasks for Frontend

- [ ] **Task UI1:** Create App Router structure
  - Create `app/layout.tsx` with Sidebar + Header
  - Create route groups for auth pages: `app/(auth)/login/page.tsx`
  
- [ ] **Task UI2:** Build device pages
  - Create `app/devices/page.tsx` (Server Component)
  - Create `components/devices/device-table.tsx` (Client Component with TanStack Table)
  - Create `app/devices/[id]/page.tsx` (Dynamic route)
  - Create `app/devices/[id]/edit/page.tsx` (Admin only)
  
- [ ] **Task UI3:** Build dashboard
  - Create `app/dashboard/page.tsx`
  - Create metric card components
  - Create chart components (Recharts)
  
- [ ] **Task UI4:** Replace data fetching
  - Remove all `useEffect` + `fetch` patterns
  - Use Server Components for initial data
  - Call Server Actions for mutations
  
- [ ] **Task UI5:** Replace authentication
  - Remove custom auth logic
  - Use `useSession()` from NextAuth.js
  - Use `signIn()` and `signOut()` for auth actions

---

## 4. Docker Infrastructure → Vercel Platform

### Docker Compose → Vercel Config

| Legacy File | New File | Functionality | Status | Notes |
|-------------|----------|---------------|--------|-------|
| `docker-compose.yml` | ⛔ DEPRECATED | Multi-container orchestration | ⛔ N/A | Vercel handles infrastructure |
| `fetcher/Dockerfile` | ⛔ DEPRECATED | Fetcher container image | ⛔ N/A | Replaced by Vercel Cron |
| `api-ts/Dockerfile` | ⛔ DEPRECATED | API container image | ⛔ N/A | Replaced by Vercel serverless functions |
| `nginx.conf` | ⛔ DEPRECATED | Reverse proxy config | ⛔ N/A | Vercel Edge Network handles routing |
| `.env` | `.env.local` + Vercel env vars | Environment variables | ⏳ TODO | Store secrets in Vercel Dashboard |
| N/A | `vercel.json` | Vercel configuration | ⏳ TODO | Add cron jobs, redirects, headers |
| N/A | `next.config.js` | Next.js configuration | ⏳ TODO | Configure images, env vars, headers |

### Key Migration Tasks for Infrastructure

- [ ] **Task I1:** Configure Vercel project
  - Link GitHub repository to Vercel
  - Set environment variables in Vercel Dashboard
  - Configure custom domain (optional)
  
- [ ] **Task I2:** Create `vercel.json`
  - Add cron job configuration
  - Add security headers
  - Add redirects (if needed)
  
- [ ] **Task I3:** Shutdown legacy Docker infrastructure
  - Backup data from OpenSearch
  - Stop all containers: `docker-compose down`
  - Archive Docker Compose files for reference

---

## 5. Database Migration

### OpenSearch → Vercel Postgres

| Legacy Structure | New Structure | Migration Script |
|------------------|---------------|------------------|
| OpenSearch index: `devices` | Postgres table: `devices` | `scripts/migrate-from-opensearch.ts` |
| OpenSearch index: `users` | Postgres table: `users` | `scripts/migrate-from-opensearch.ts` |
| OpenSearch index: `activity_logs` | Postgres table: `activity_logs` | `scripts/migrate-from-opensearch.ts` |
| N/A | Postgres table: `teams` | Seed with default team |
| N/A | Postgres table: `team_members` | Auto-populate from users |
| N/A | Postgres table: `sync_logs` | New table for sync tracking |

### Field Mapping: Devices

| OpenSearch Field | Postgres Field | Transformation |
|------------------|----------------|----------------|
| `_id` | `intune_id` (string) | Direct copy |
| `deviceName` | `name` | Direct copy |
| `operatingSystem` | `operating_system` | Direct copy |
| `osVersion` | `os_version` | Direct copy |
| `complianceState` | `compliance_status` | Enum: compliant\|noncompliant\|unknown |
| `lastSyncDateTime` | `last_sync_date` | Parse ISO 8601 → timestamp |
| `serialNumber` | `serial_number` | Direct copy |
| `manufacturer` | `manufacturer` | Direct copy |
| `model` | `model` | Direct copy |
| `enrolledDateTime` | `enrollment_date` | Parse ISO 8601 → timestamp |
| `managementAgent` | `management_type` | Direct copy |
| `userPrincipalName` | `user_id` (FK) | Lookup user by email |

### Field Mapping: Users

| OpenSearch Field | Postgres Field | Transformation |
|------------------|----------------|----------------|
| `_id` | `azure_id` (string) | Direct copy |
| `userPrincipalName` | `email` | Direct copy |
| `displayName` | `name` | Direct copy |
| `mail` | `email` | Use as primary email |
| `department` | `department` | Direct copy |
| `jobTitle` | `job_title` | Direct copy |
| N/A | `role` | Default: 'viewer' |

### Key Migration Tasks for Database

- [ ] **Task D1:** Create migration script
  - Create `scripts/migrate-from-opensearch.ts`
  - Implement OpenSearch → Postgres data transformation
  - Add dry-run mode for testing
  
- [ ] **Task D2:** Create validation script
  - Create `scripts/validate-migration.ts`
  - Compare record counts between OpenSearch and Postgres
  - Verify sample data matches
  
- [ ] **Task D3:** Execute migration
  - Run dry-run: `pnpm tsx scripts/migrate-from-opensearch.ts --dry-run`
  - Run actual migration: `pnpm tsx scripts/migrate-from-opensearch.ts --source=production`
  - Run validation: `pnpm tsx scripts/validate-migration.ts`

---

## 6. Configuration & Secrets

### Environment Variables Migration

| Legacy Variable | New Variable | Location | Notes |
|-----------------|--------------|----------|-------|
| `OPENSEARCH_URL` | ⛔ DEPRECATED | N/A | No longer needed |
| `OPENSEARCH_USERNAME` | ⛔ DEPRECATED | N/A | No longer needed |
| `OPENSEARCH_PASSWORD` | ⛔ DEPRECATED | N/A | No longer needed |
| `AZURE_TENANT_ID` | `AZURE_AD_TENANT_ID` | `.env.local` + Vercel | Rename for consistency |
| `AZURE_CLIENT_ID` | `AZURE_AD_CLIENT_ID` | `.env.local` + Vercel | Rename for consistency |
| `AZURE_CLIENT_SECRET` | `AZURE_AD_CLIENT_SECRET` | `.env.local` + Vercel | Rename for consistency |
| `JWT_SECRET` | `NEXTAUTH_SECRET` | `.env.local` + Vercel | NextAuth.js uses different format |
| `API_PORT` | ⛔ DEPRECATED | N/A | Vercel handles ports |
| `FETCHER_CRON_SCHEDULE` | `vercel.json::crons` | `vercel.json` | Move to Vercel config |
| N/A | `NEXTAUTH_URL` | `.env.local` + Vercel | New: NextAuth.js callback URL |
| N/A | `POSTGRES_URL` | `.env.local` + Vercel | New: Vercel Postgres connection string |
| N/A | `CRON_SECRET` | `.env.local` + Vercel | New: Protect cron endpoint |

---

## Migration Sequence Recommendation

Follow this order to minimize dependencies and enable parallel work:

### Week 1-2: Foundation
1. ✅ Clone Next.js SaaS Starter (Task 0.1)
2. ✅ Restructure project (Task 0.2)
3. ✅ Copy legacy code to `legacy/` (Task 0.3)
4. ✅ Database schema (Task 1.1)
5. ✅ Authentication setup (Task 1.2)

### Week 3-4: Backend (Can work in parallel)
6. ✅ Graph API integration (Task 2.1 - reference `fetcher/src/graph_client.py`)
7. ✅ Vercel Cron setup (Task 2.2 - reference `fetcher/cron.sh`)
8. ✅ Server Actions (Task 2.3 - reference `api-ts/src/routes/*.ts`)

### Week 5-6: Frontend (Can work in parallel after Task 8)
9. ✅ UI components (Task 3.1)
10. ✅ Device pages (Task 3.2-3.3 - reference `frontend/src/pages/Device*.tsx`)
11. ✅ Dashboard (Task 3.4 - reference `frontend/src/pages/Dashboard.tsx`)

### Week 7: Data Migration
12. ✅ Migration script (Task 4.1)
13. ✅ Execute migration (Task 4.2)

### Week 8-9: Launch
14. ✅ Testing (Task 5.1)
15. ✅ Production deployment (Task 5.2)

---

## Progress Tracking

Update this section as you complete migrations:

| Component | Files Migrated | Files Total | Progress | Status |
|-----------|----------------|-------------|----------|--------|
| **Fetcher** | 0 | 7 | 0% | ⏳ TODO |
| **api-ts** | 0 | 12 | 0% | ⏳ TODO |
| **Frontend** | 0 | 15 | 0% | ⏳ TODO |
| **Infrastructure** | 0 | 3 | 0% | ⏳ TODO |
| **Database** | 0 | 3 | 0% | ⏳ TODO |
| **Total** | **0** | **40** | **0%** | ⏳ TODO |

---

## Reference Links

- [Document 04: Data Migration Strategy](./04_Data_Migration_Strategy.md)
- [Document 05: Fetcher to Cron Conversion](./05_Fetcher_to_Cron_Conversion.md)
- [Document 06: API Server Actions Spec](./06_API_Server_Actions_Spec.md)
- [Document 11: Development Roadmap](./11_Development_Roadmap.md)

---

## Notes for Developers

### When Starting a Migration Task:

1. **Read Legacy Code First**
   - Open the legacy file in `legacy/fetcher/` or `legacy/api-ts/`
   - Understand the business logic and data flow
   - Note any edge cases or special handling

2. **Reference Documentation**
   - Check the corresponding document (05, 06, 07, etc.) for implementation guidance
   - Follow the code examples provided

3. **Update This Document**
   - Change status from ⏳ TODO → 🚧 IN PROGRESS when starting
   - Change to ✅ COMPLETE when finished and tested
   - Update progress tracking table

4. **Write Tests**
   - Create unit tests for all new functions
   - Create integration tests for Server Actions
   - Update test coverage metrics

5. **Document Changes**
   - Add code comments explaining complex logic
   - Update API documentation if needed
   - Note any deviations from original legacy behavior

---

**Last Updated:** 2026-02-05  
**Maintained By:** Engineering Team