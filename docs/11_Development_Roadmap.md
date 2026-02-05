# Document 11: Development Roadmap

**Version:** 1.0  
**Last Updated:** February 5, 2026  
**Author:** Engineering Team  
**Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Migration Overview](#2-migration-overview)
3. [Phase 0: Project Setup](#phase-0-project-setup-week-1)
4. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure-week-2-3)
5. [Phase 2: Backend Services](#phase-2-backend-services-week-4-5)
6. [Phase 3: Frontend Components](#phase-3-frontend-components-week-6-7)
7. [Phase 4: Data Migration](#phase-4-data-migration-week-8)
8. [Phase 5: Testing & Deployment](#phase-5-testing--deployment-week-9-10)
9. [Task Tracking](#9-task-tracking)
10. [Risk Mitigation](#10-risk-mitigation)

---

## 1. Executive Summary

### Purpose

This roadmap provides a comprehensive, step-by-step plan to migrate Device Inventory from the legacy Docker/OpenSearch architecture to the new Next.js 15 + Vercel platform.

### Timeline Overview

```mermaid
gantt
    title Device Inventory v2 Migration Timeline
    dateFormat YYYY-MM-DD
    section Phase 0: Setup
    Clone & Configure Repo           :p0a, 2026-02-05, 2d
    Restructure Project               :p0b, after p0a, 3d
    
    section Phase 1: Infrastructure
    Database Schema                   :p1a, after p0b, 3d
    Authentication Setup              :p1b, after p1a, 4d
    
    section Phase 2: Backend
    Microsoft Graph Integration       :p2a, after p1b, 5d
    Server Actions                    :p2b, after p2a, 5d
    
    section Phase 3: Frontend
    UI Components                     :p3a, after p2b, 5d
    Dashboard & Device Pages          :p3b, after p3a, 5d
    
    section Phase 4: Migration
    Data Migration Script             :p4a, after p3b, 3d
    Migrate Production Data           :p4b, after p4a, 2d
    
    section Phase 5: Launch
    Testing & QA                      :p5a, after p4b, 5d
    Production Deployment             :p5b, after p5a, 2d
```

**Total Duration:** 10 weeks (50 business days)

### Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| **Zero data loss** | 100% of devices migrated | ⏳ Pending |
| **Performance** | Page load < 2s | ⏳ Pending |
| **Uptime** | 99.9% availability | ⏳ Pending |
| **User adoption** | All users migrated | ⏳ Pending |
| **Cost reduction** | -50% infrastructure cost | ⏳ Pending |

---

## 2. Migration Overview

### Current State vs Target State

```mermaid
flowchart LR
    subgraph Legacy["Legacy System (Current)"]
        Docker[Docker Compose]
        Fetcher[Fetcher Container]
        APITS[api-ts Container]
        OpenSearch[(OpenSearch)]
        Docker --> Fetcher
        Docker --> APITS
        Fetcher --> OpenSearch
        APITS --> OpenSearch
    end
    
    subgraph New["New System (Target)"]
        NextJS[Next.js 15 App]
        ServerActions[Server Actions API]
        Cron[Vercel Cron]
        Postgres[(Vercel Postgres)]
        NextJS --> ServerActions
        NextJS --> Cron
        ServerActions --> Postgres
        Cron --> Postgres
    end
    
    Legacy -.->|Migration| New
    
    style Legacy fill:#ff6b6b
    style New fill:#48dbfb
```

### Key Architecture Changes

| Component | Legacy | New | Migration Action |
|-----------|--------|-----|------------------|
| **Sync Service** | Docker Fetcher container | Vercel Cron + lib/services/sync-service.ts | Port logic, remove Docker |
| **API Layer** | Express.js in api-ts container | Next.js Server Actions in lib/actions/ | Rewrite endpoints as actions |
| **Database** | OpenSearch (document store) | Vercel Postgres (relational) | Migrate data with transformation |
| **Authentication** | Custom JWT | NextAuth.js + Azure AD | Implement OAuth flow |
| **Frontend** | Separate React app | Next.js 15 App Router | Rebuild with Server Components |
| **Deployment** | Docker Compose on VPS | Vercel platform | Git push deployment |

---

## Phase 0: Project Setup (Week 1)

### Task 0.1: Clone Next.js SaaS Starter Template

**Duration:** 2 hours  
**Assignee:** Tech Lead  
**Priority:** Critical

```bash
# Step 1: Clone the Next.js SaaS Starter template
git clone https://github.com/vercel/nextjs-saas-starter.git device-inventory-v2
cd device-inventory-v2

# Step 2: Remove template git history and initialize new repo
rm -rf .git
git init
git add .
git commit -m "Initial commit: Next.js SaaS Starter template"

# Step 3: Create GitHub repository
gh repo create device-inventory-v2 --private --source=. --remote=origin

# Step 4: Push to GitHub
git push -u origin main

# Step 5: Connect to Vercel
vercel link
```

**Deliverables:**
- [ ] GitHub repository created: `your-org/device-inventory-v2`
- [ ] Connected to Vercel project
- [ ] Team members have access

---

### Task 0.2: Restructure Project for Device Inventory

**Duration:** 1 day  
**Assignee:** Tech Lead  
**Priority:** Critical

```bash
# Step 1: Remove template-specific files
rm -rf app/pricing app/blog app/api/stripe components/pricing
rm -f .env.example
cp .env.example.device-inventory .env.example

# Step 2: Create Device Inventory directory structure
mkdir -p lib/services
mkdir -p lib/graph
mkdir -p lib/validation
mkdir -p components/devices
mkdir -p components/dashboard
mkdir -p app/devices/[id]/edit
mkdir -p app/dashboard
mkdir -p app/admin
mkdir -p scripts

# Step 3: Update package.json with Device Inventory metadata
# Edit package.json:
{
  "name": "device-inventory-v2",
  "version": "2.0.0",
  "description": "Device Inventory Management System",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "check": "pnpm lint && pnpm type-check && pnpm test"
  }
}

# Step 4: Install additional dependencies
pnpm add @microsoft/microsoft-graph-client @azure/identity
pnpm add recharts  # For dashboard charts
pnpm add date-fns  # For date formatting
pnpm add @tanstack/react-table  # For device table

# Step 5: Commit changes
git add .
git commit -m "chore: restructure project for Device Inventory"
git push
```

**Deliverables:**
- [ ] Template files removed
- [ ] Device Inventory folder structure created
- [ ] Dependencies installed
- [ ] Changes committed to Git

---

### Task 0.3: Migrate Legacy Codebase Structure

**Duration:** 1 day  
**Assignee:** Backend Developer  
**Priority:** High

**Objective:** Move legacy Fetcher and api-ts code into the new structure for reference during migration.

```bash
# Step 1: Clone legacy repository (for reference)
cd ..
git clone https://github.com/your-org/device-inventory-legacy.git legacy-reference
cd device-inventory-v2

# Step 2: Create legacy reference folder
mkdir -p legacy/fetcher
mkdir -p legacy/api-ts

# Step 3: Copy legacy Fetcher code (for reference)
cp -r ../legacy-reference/fetcher/* legacy/fetcher/
# Main files to reference:
# - fetcher/src/*.ts -> will be refactored to lib/services/sync-service.ts
# - fetcher/src/graph-client.ts (or similar) -> will be refactored to lib/graph/graph-client.ts

# Step 4: Copy legacy api-ts code (for reference)
cp -r ../legacy-reference/api-ts/* legacy/api-ts/
# Main files to reference:
# - api-ts/src/routes/devices.ts -> will be ported to lib/actions/device-actions.ts
# - api-ts/src/routes/users.ts -> will be ported to lib/actions/user-actions.ts
# - api-ts/src/middleware/auth.ts -> will be ported to lib/auth/rbac.ts

# Step 5: Create migration mapping document
cat > legacy/MIGRATION_MAP.md << 'EOF'
# Legacy to New Code Mapping

## Fetcher Container → Vercel Cron + Sync Service

| Legacy File | New File | Status |
|-------------|----------|--------|
| `fetcher/src/*.ts` | `lib/services/sync-service.ts` | ⏳ TODO |
| `fetcher/src/graph-client.ts` (or similar) | `lib/graph/graph-client.ts` | ⏳ TODO |
| `fetcher/src/auth.ts` (or similar) | `lib/graph/auth-provider.ts` | ⏳ TODO |
| `fetcher/cron.sh` | `app/api/cron/sync/route.ts` + `vercel.json` | ⏳ TODO |

## api-ts Container → Server Actions

| Legacy File | New File | Status |
|-------------|----------|--------|
| `api-ts/src/routes/devices.ts` | `lib/actions/device-actions.ts` | ⏳ TODO |
| `api-ts/src/routes/users.ts` | `lib/actions/user-actions.ts` | ⏳ TODO |
| `api-ts/src/routes/sync.ts` | `lib/actions/sync-actions.ts` | ⏳ TODO |
| `api-ts/src/middleware/auth.ts` | `lib/auth/rbac.ts` | ⏳ TODO |
| `api-ts/src/db/opensearch.ts` | `lib/db/drizzle.ts` + `schema.ts` | ⏳ TODO |

## Frontend → Next.js Pages

| Legacy File | New File | Status |
|-------------|----------|--------|
| `frontend/src/pages/DeviceList.tsx` | `app/devices/page.tsx` | ⏳ TODO |
| `frontend/src/pages/DeviceDetail.tsx` | `app/devices/[id]/page.tsx` | ⏳ TODO |
| `frontend/src/pages/Dashboard.tsx` | `app/dashboard/page.tsx` | ⏳ TODO |
| `frontend/src/components/DeviceTable.tsx` | `components/devices/device-table.tsx` | ⏳ TODO |
EOF

# Step 6: Add legacy folder to .gitignore (optional - keep as reference)
echo "# Legacy reference code (keep for migration reference)" >> .gitignore
echo "# legacy/" >> .gitignore

# Step 7: Commit
git add .
git commit -m "chore: add legacy code reference and migration map"
git push
```

**Deliverables:**
- [ ] Legacy code copied to `legacy/` folder for reference
- [ ] Migration mapping document created
- [ ] Team can reference legacy code during migration

---

### Task 0.4: Environment Configuration

**Duration:** 2 hours  
**Assignee:** DevOps/Tech Lead  
**Priority:** Critical

```bash
# Step 1: Create local environment file
cat > .env.local << 'EOF'
# Database
POSTGRES_URL=postgres://user:password@localhost:5432/device_inventory_dev

# Azure AD (create app registration first)
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=

# NextAuth.js (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Cron Security (generate with: openssl rand -base64 32)
CRON_SECRET=

# Debug
DEBUG=true
NODE_ENV=development
EOF

# Step 2: Create environment template for team
cp .env.local .env.example
# Replace actual secrets with placeholders in .env.example

# Step 3: Configure Vercel environment variables
# Go to: vercel.com/{team}/device-inventory-v2/settings/environment-variables
# Add all production secrets

# Or via CLI:
vercel env add AZURE_AD_TENANT_ID production
vercel env add AZURE_AD_CLIENT_ID production
vercel env add AZURE_AD_CLIENT_SECRET production
vercel env add NEXTAUTH_SECRET production
vercel env add CRON_SECRET production
```

**Deliverables:**
- [ ] `.env.local` created with development values
- [ ] `.env.example` committed to Git (no secrets)
- [ ] Vercel environment variables configured
- [ ] Team members can run app locally

---

## Phase 1: Core Infrastructure (Week 2-3)

### Task 1.1: Database Schema Implementation

**Duration:** 3 days  
**Assignee:** Backend Developer  
**Priority:** Critical  
**Reference:** [Document 03: Database Schema Design](./03_Database_Schema_Design.md)

```bash
# Step 1: Define Drizzle schema
# Create: lib/db/schema.ts
# Copy schema from Document 03 (Drizzle ORM section)

# Step 2: Configure Drizzle
# Create: drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL!,
  },
} satisfies Config;

# Step 3: Initialize Drizzle client
# Create: lib/db/drizzle.ts
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

export const db = drizzle(sql, { schema });

# Step 4: Generate migration files
pnpm db:generate

# Step 5: Apply migrations to local database
pnpm db:push

# Step 6: Verify schema
pnpm db:studio
# Opens Drizzle Studio at http://localhost:4983
# Verify all 6 tables exist: users, teams, team_members, devices, activity_logs, sync_logs

# Step 7: Commit
git add .
git commit -m "feat(db): implement database schema with Drizzle ORM"
git push
```

**Deliverables:**
- [ ] `lib/db/schema.ts` created with all 6 tables
- [ ] `lib/db/drizzle.ts` client configured
- [ ] `drizzle.config.ts` configured
- [ ] Migrations generated and applied
- [ ] Schema verified in Drizzle Studio

---

### Task 1.2: Authentication Setup (NextAuth.js + Azure AD)

**Duration:** 4 days  
**Assignee:** Backend Developer  
**Priority:** Critical  
**Reference:** [Document 07: Auth and RBAC Spec](./07_Auth_and_RBAC_Spec.md)

```bash
# Step 1: Create Azure AD app registration
# Go to: portal.azure.com > Azure Active Directory > App registrations
# Create new registration with redirect URI: http://localhost:3000/api/auth/callback/azure-ad

# Step 2: Implement NextAuth.js configuration
# Create: lib/auth/auth-options.ts
# Copy implementation from Document 07 (NextAuth.js Configuration section)

# Step 3: Create auth API route
# Create: app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

# Step 4: Extend NextAuth types
# Create: types/next-auth.d.ts
# Copy type extensions from Document 07

# Step 5: Implement RBAC helpers
# Create: lib/auth/rbac.ts
# Copy implementation from Document 07 (Authorization Helpers section)

# Step 6: Create middleware for route protection
# Create: middleware.ts (root)
# Copy implementation from Document 07 (Middleware Implementation section)

# Step 7: Test authentication locally
pnpm dev
# Navigate to http://localhost:3000/dashboard
# Should redirect to /login
# Click "Sign in with Azure AD"
# Verify login works

# Step 8: Commit
git add .
git commit -m "feat(auth): implement NextAuth.js with Azure AD and RBAC"
git push
```

**Deliverables:**
- [ ] Azure AD app registration created
- [ ] NextAuth.js configured with Azure AD provider
- [ ] RBAC helper functions implemented
- [ ] Middleware protecting routes
- [ ] Local authentication working

---

## Phase 2: Backend Services (Week 4-5)

### Task 2.1: Microsoft Graph API Integration

**Duration:** 5 days  
**Assignee:** Backend Developer  
**Priority:** Critical  
**Reference:** [Document 05: Fetcher to Cron Conversion](./05_Fetcher_to_Cron_Conversion.md)

```bash
# Step 1: Implement Graph API auth provider
# Create: lib/graph/auth-provider.ts
# Copy implementation from Document 05 (Authentication Setup section)

# Step 2: Implement Graph API client wrapper
# Create: lib/graph/graph-client.ts
# Copy implementation from Document 05 (Graph API Client Wrapper section)

# Step 3: Test Graph API connectivity
# Create: scripts/test-graph-api.ts
import { GraphAPIClient } from '@/lib/graph/graph-client';

async function testGraphAPI() {
  const client = new GraphAPIClient();
  const isConnected = await client.testConnection();
  console.log('Graph API connected:', isConnected);
  
  const { devices } = await client.fetchDevicesDelta();
  console.log(`Fetched ${devices.length} devices`);
}

testGraphAPI();

# Run test:
pnpm tsx scripts/test-graph-api.ts

# Step 4: Implement sync service
# Create: lib/services/sync-service.ts
# Copy implementation from Document 05 (Sync Service Implementation section)

# Step 5: Commit
git add .
git commit -m "feat(graph): implement Microsoft Graph API integration"
git push
```

**Deliverables:**
- [ ] Graph API auth provider implemented
- [ ] Graph API client wrapper implemented
- [ ] Graph API connectivity tested successfully
- [ ] Sync service implemented (syncDevices, syncUsers)

---

### Task 2.2: Vercel Cron Setup

**Duration:** 2 days  
**Assignee:** Backend Developer  
**Priority:** High  
**Reference:** [Document 05: Fetcher to Cron Conversion](./05_Fetcher_to_Cron_Conversion.md)

```bash
# Step 1: Configure Vercel Cron
# Create: vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "*/30 * * * *"
    }
  ]
}

# Step 2: Implement cron API route
# Create: app/api/cron/sync/route.ts
# Copy implementation from Document 05 (Cron Route Handler section)

# Step 3: Test cron endpoint locally
curl -X GET http://localhost:3000/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"

# Should return:
# { "success": true, "summary": { ... } }

# Step 4: Commit and deploy to Vercel
git add .
git commit -m "feat(cron): implement Vercel Cron for device sync"
git push

# Vercel will auto-deploy and register the cron job

# Step 5: Verify cron registered in Vercel Dashboard
# Go to: vercel.com/{team}/device-inventory-v2/settings/cron
# Should see: /api/cron/sync running every 30 minutes

# Step 6: Test manual trigger in production
curl -X GET https://device-inventory-v2.vercel.app/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Deliverables:**
- [ ] `vercel.json` configured with cron schedule
- [ ] Cron API route implemented
- [ ] Cron endpoint tested locally
- [ ] Cron job deployed and registered in Vercel

---

### Task 2.3: Server Actions API

**Duration:** 5 days  
**Assignee:** Backend Developer  
**Priority:** Critical  
**Reference:** [Document 06: API Server Actions Spec](./06_API_Server_Actions_Spec.md)

```bash
# Step 1: Create action types
# Create: lib/actions/types.ts
export type ActionResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

# Step 2: Implement device actions
# Create: lib/actions/device-actions.ts
# Implement from Document 06:
# - getDevices (with pagination, filtering, sorting)
# - getDeviceById
# - updateDevice (admin only)
# - decommissionDevice (admin only)

# Step 3: Implement user actions
# Create: lib/actions/user-actions.ts
# Implement from Document 06:
# - getUsers
# - getUserById
# - updateUserRole (admin only)

# Step 4: Implement sync actions
# Create: lib/actions/sync-actions.ts
# Implement from Document 06:
# - triggerManualSync (admin only)
# - getSyncStatus

# Step 5: Implement activity log actions
# Create: lib/actions/activity-actions.ts
# Implement from Document 06:
# - getActivityLogs (admin only)

# Step 6: Implement dashboard actions
# Create: lib/actions/dashboard-actions.ts
# Implement from Document 06:
# - getDashboardMetrics

# Step 7: Create validation schemas
# Create: lib/validation/schemas.ts
# Copy Zod schemas from Document 06 (Validation Schemas section)

# Step 8: Write unit tests
# Create: __tests__/unit/lib/actions/device-actions.test.ts
# Test all device actions with mocked auth and database

# Step 9: Commit
git add .
git commit -m "feat(actions): implement Server Actions API"
git push
```

**Deliverables:**
- [ ] Device actions implemented (4 functions)
- [ ] User actions implemented (3 functions)
- [ ] Sync actions implemented (2 functions)
- [ ] Activity log actions implemented (1 function)
- [ ] Dashboard actions implemented (1 function)
- [ ] Validation schemas created
- [ ] Unit tests passing

---

## Phase 3: Frontend Components (Week 6-7)

### Task 3.1: UI Component Library Setup

**Duration:** 2 days  
**Assignee:** Frontend Developer  
**Priority:** High  
**Reference:** [Document 08: UI/UX Guidelines](./08_UI_UX_Guidelines.md)

```bash
# Step 1: Initialize shadcn/ui
pnpm dlx shadcn-ui@latest init

# Step 2: Install required components
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add card
pnpm dlx shadcn-ui@latest add table
pnpm dlx shadcn-ui@latest add badge
pnpm dlx shadcn-ui@latest add dialog
pnpm dlx shadcn-ui@latest add form
pnpm dlx shadcn-ui@latest add input
pnpm dlx shadcn-ui@latest add select
pnpm dlx shadcn-ui@latest add dropdown-menu
pnpm dlx shadcn-ui@latest add tooltip
pnpm dlx shadcn-ui@latest add alert
pnpm dlx shadcn-ui@latest add skeleton
pnpm dlx shadcn-ui@latest add tabs
pnpm dlx shadcn-ui@latest add avatar

# Step 3: Configure Tailwind theme
# Edit: tailwind.config.ts
# Copy color palette from Document 08 (Design System Overview section)

# Step 4: Create layout components
# Create: components/layout/sidebar.tsx
# Create: components/layout/header.tsx
# Create: components/layout/mobile-nav.tsx
# Copy implementations from Document 08 (Navigation & Layout section)

# Step 5: Update root layout
# Edit: app/layout.tsx
# Add Sidebar and Header components

# Step 6: Test component library
pnpm dev
# Navigate to http://localhost:3000
# Verify sidebar and header render correctly

# Step 7: Commit
git add .
git commit -m "feat(ui): setup shadcn/ui component library and layout"
git push
```

**Deliverables:**
- [ ] shadcn/ui initialized
- [ ] 15+ base components installed
- [ ] Tailwind theme configured with brand colors
- [ ] Sidebar, Header, and MobileNav components created
- [ ] Root layout updated with navigation

---

### Task 3.2: Device List Page

**Duration:** 3 days  
**Assignee:** Frontend Developer  
**Priority:** Critical  
**Reference:** [Document 08: UI/UX Guidelines](./08_UI_UX_Guidelines.md)

```bash
# Step 1: Create device list page
# Create: app/devices/page.tsx
import { getDevices } from '@/lib/actions/device-actions';
import { DeviceTable } from '@/components/devices/device-table';

export default async function DevicesPage() {
  const result = await getDevices({ page: 1, pageSize: 50 });
  
  if (!result.success) {
    return <div>Error loading devices</div>;
  }
  
  return (
    <div>
      <h1>Devices</h1>
      <DeviceTable devices={result.data.devices} />
    </div>
  );
}

# Step 2: Create device table component
# Create: components/devices/device-table.tsx
# Copy implementation from Document 08 (Device List Table section)

# Step 3: Create filter components
# Create: components/devices/compliance-filter.tsx
# Create: components/devices/os-filter.tsx
# Copy implementations from Document 08 (Filter Components section)

# Step 4: Create device actions dropdown
# Create: components/devices/device-actions.tsx
# Copy implementation from Document 08 (Row Actions Component section)

# Step 5: Test device list page
pnpm dev
# Navigate to http://localhost:3000/devices
# Verify table renders with sample data
# Test filtering, sorting, pagination

# Step 6: Commit
git add .
git commit -m "feat(devices): implement device list page with table"
git push
```

**Deliverables:**
- [ ] Device list page created
- [ ] Device table component with TanStack Table
- [ ] Filter components (compliance, OS)
- [ ] Device actions dropdown (view, edit, decommission)
- [ ] Pagination working

---

### Task 3.3: Device Detail Page

**Duration:** 2 days  
**Assignee:** Frontend Developer  
**Priority:** High  
**Reference:** [Document 08: UI/UX Guidelines](./08_UI_UX_Guidelines.md)

```bash
# Step 1: Create device detail page
# Create: app/devices/[id]/page.tsx
# Copy implementation from Document 08 (Device Detail View section)

# Step 2: Create activity history component
# Create: components/devices/activity-history.tsx
# Copy implementation from Document 08 (Activity History Timeline section)

# Step 3: Create device edit page (admin only)
# Create: app/devices/[id]/edit/page.tsx
# Add RBAC check for admin role

# Step 4: Create edit device form
# Create: components/devices/edit-device-form.tsx
# Copy implementation from Document 08 (Forms & Input Patterns section)

# Step 5: Test device detail page
pnpm dev
# Navigate to http://localhost:3000/devices/1
# Verify device info displays
# Verify activity history displays
# Test edit form (as admin)

# Step 6: Commit
git add .
git commit -m "feat(devices): implement device detail and edit pages"
git push
```

**Deliverables:**
- [ ] Device detail page with tabs (Overview, Activity, Settings)
- [ ] Activity history timeline component
- [ ] Device edit page (admin only)
- [ ] Edit form with React Hook Form + Zod validation

---

### Task 3.4: Dashboard Page

**Duration:** 3 days  
**Assignee:** Frontend Developer  
**Priority:** High  
**Reference:** [Document 08: UI/UX Guidelines](./08_UI_UX_Guidelines.md)

```bash
# Step 1: Create dashboard page
# Create: app/dashboard/page.tsx
# Copy implementation from Document 08 (Dashboard Layout section)

# Step 2: Create metric card component
# Create: components/dashboard/metric-card.tsx
# Copy implementation from Document 08 (Metric Card Component section)

# Step 3: Create chart components
# Create: components/dashboard/devices-by-os-chart.tsx
# Copy implementation from Document 08 (Chart Component section)

# Step 4: Create recent activity list
# Create: components/dashboard/recent-activity-list.tsx

# Step 5: Test dashboard
pnpm dev
# Navigate to http://localhost:3000/dashboard
# Verify metric cards show correct numbers
# Verify charts render
# Verify recent activity displays

# Step 6: Commit
git add .
git commit -m "feat(dashboard): implement dashboard with metrics and charts"
git push
```

**Deliverables:**
- [ ] Dashboard page with 4 metric cards
- [ ] Devices by OS pie chart (Recharts)
- [ ] Compliance trend chart
- [ ] Recent activity list
- [ ] Responsive grid layout

---

## Phase 4: Data Migration (Week 8)

### Task 4.1: Data Migration Script

**Duration:** 3 days  
**Assignee:** Backend Developer  
**Priority:** Critical  
**Reference:** [Document 04: Data Migration Strategy](./04_Data_Migration_Strategy.md)

```bash
# Step 1: Create migration script
# Create: scripts/migrate-from-opensearch.ts
# Copy implementation from Document 04 (Migration Script section)

# Step 2: Test migration on sample data
# Export sample data from OpenSearch:
curl -X GET "http://localhost:9200/devices/_search?size=10" > sample-devices.json
curl -X GET "http://localhost:9200/users/_search?size=10" > sample-users.json

# Run migration script:
pnpm tsx scripts/migrate-from-opensearch.ts --dry-run

# Verify output shows correct mapping

# Step 3: Create validation script
# Create: scripts/validate-migration.ts
# Copy implementation from Document 04 (Validation section)

# Step 4: Create rollback script
# Create: scripts/rollback-migration.ts
# Copy implementation from Document 04 (Rollback Strategy section)

# Step 5: Document migration process
# Create: docs/MIGRATION_GUIDE.md

# Step 6: Commit
git add .
git commit -m "feat(migration): implement data migration scripts"
git push
```

**Deliverables:**
- [ ] Migration script from OpenSearch to Postgres
- [ ] Validation script to verify data integrity
- [ ] Rollback script for emergency revert
- [ ] Migration guide documentation
- [ ] Dry-run tested successfully

---

### Task 4.2: Execute Production Migration

**Duration:** 2 days  
**Assignee:** Backend Developer + Tech Lead  
**Priority:** Critical  
**Reference:** [Document 04: Data Migration Strategy](./04_Data_Migration_Strategy.md)

```bash
# Day 1: Parallel Run
# Keep legacy system running
# Run migration script to populate new database
pnpm tsx scripts/migrate-from-opensearch.ts --source=production

# Monitor migration progress:
# - Devices migrated: 5234/5234 ✓
# - Users migrated: 342/342 ✓
# - Duration: 45 minutes

# Run validation:
pnpm tsx scripts/validate-migration.ts

# Compare data:
# - Device count matches: ✓
# - User count matches: ✓
# - Sample devices match: ✓
# - Compliance data preserved: ✓

# Day 2: Cutover
# 1. Announce maintenance window to users
# 2. Stop legacy Docker containers:
docker-compose down

# 3. Update DNS/routing to point to Vercel app
# 4. Monitor new system for 2 hours
# 5. Verify sync jobs running:
curl https://device-inventory.vercel.app/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"

# 6. Check sync_logs table:
psql $POSTGRES_URL -c "SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10;"

# 7. If issues arise, execute rollback:
# pnpm tsx scripts/rollback-migration.ts
# docker-compose up -d  # Restart legacy system
```

**Deliverables:**
- [ ] All devices migrated from OpenSearch to Postgres
- [ ] All users migrated
- [ ] Data validation passed
- [ ] Legacy system shut down
- [ ] New system serving production traffic
- [ ] Rollback plan tested and ready

---

## Phase 5: Testing & Deployment (Week 9-10)

### Task 5.1: Comprehensive Testing

**Duration:** 5 days  
**Assignee:** QA Engineer + Full Team  
**Priority:** Critical  
**Reference:** [Document 09: Developer Handbook](./09_Developer_Handbook.md)

```bash
# Day 1-2: Unit Tests
# Run all unit tests:
pnpm test

# Verify coverage:
pnpm test:coverage
# Target: > 80% coverage

# Day 3: Integration Tests
# Test Server Actions with real database:
pnpm test:integration

# Day 4-5: End-to-End Tests
# Write E2E tests for critical paths:
# Create: __tests__/e2e/device-list.spec.ts
# Create: __tests__/e2e/device-detail.spec.ts
# Create: __tests__/e2e/login-flow.spec.ts
# Create: __tests__/e2e/admin-features.spec.ts

# Run E2E tests:
pnpm test:e2e

# Run with UI for debugging:
pnpm test:e2e:ui

# Manual QA Checklist:
# [ ] Login with Azure AD works
# [ ] Device list displays all devices
# [ ] Filters work (compliance, OS)
# [ ] Sorting works (all columns)
# [ ] Pagination works
# [ ] Device detail page shows correct data
# [ ] Activity history displays
# [ ] Edit device works (admin only)
# [ ] Decommission device works (admin only)
# [ ] Dashboard metrics accurate
# [ ] Charts render correctly
# [ ] Manual sync works (admin only)
# [ ] Sync status displays
# [ ] User list displays
# [ ] Change user role works (admin only)
# [ ] Activity logs display (admin only)
# [ ] Responsive design works (mobile, tablet, desktop)
# [ ] Dark mode works (if implemented)
# [ ] Keyboard navigation works
# [ ] Screen reader compatibility
```

**Deliverables:**
- [ ] Unit tests passing (> 80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing for critical paths
- [ ] Manual QA checklist completed
- [ ] Performance tests passing (Lighthouse score > 90)
- [ ] Accessibility tests passing (WCAG 2.1 AA)

---

### Task 5.2: Production Deployment

**Duration:** 2 days  
**Assignee:** Tech Lead + DevOps  
**Priority:** Critical  
**Reference:** [Document 10: CI/CD Pipeline](./10_CI_CD_Pipeline.md)

```bash
# Day 1: Pre-Deployment
# 1. Final code review
# 2. Merge all feature branches to main
# 3. Verify all tests pass on main branch
# 4. Run security audit:
pnpm audit --production

# 5. Tag release:
git tag -a v2.0.0 -m "Device Inventory v2.0.0 - Initial Release"
git push origin v2.0.0

# 6. Backup production database:
# Vercel Dashboard > Postgres > Backups > Create Backup

# Day 2: Deployment
# 1. Deploy to production (automatic on merge to main)
git push origin main

# 2. Monitor Vercel build:
vercel logs --follow

# 3. Verify deployment:
curl https://device-inventory.vercel.app/api/health

# 4. Smoke tests:
# - Login: ✓
# - Device list: ✓
# - Dashboard: ✓
# - Sync job: ✓

# 5. Monitor for 24 hours:
# - Check Vercel logs every 2 hours
# - Monitor error rate
# - Monitor sync job success rate
# - Monitor user feedback

# 6. Announce launch to organization
# Send email with:
# - New URL: https://device-inventory.vercel.app
# - Key features
# - Known issues (if any)
# - Support contact
```

**Deliverables:**
- [ ] v2.0.0 tagged and pushed to GitHub
- [ ] Production database backed up
- [ ] Deployed to production
- [ ] Smoke tests passed
- [ ] 24-hour monitoring completed
- [ ] Launch announcement sent
- [ ] Legacy system decommissioned

---

## 9. Task Tracking

### Sprint Breakdown

```mermaid
gantt
    title 10-Week Sprint Plan
    dateFormat YYYY-MM-DD
    
    section Sprint 1 (Week 1)
    Project Setup               :s1, 2026-02-05, 5d
    
    section Sprint 2 (Week 2)
    Database Schema             :s2, after s1, 5d
    
    section Sprint 3 (Week 3)
    Authentication              :s3, after s2, 5d
    
    section Sprint 4 (Week 4)
    Graph API Integration       :s4, after s3, 5d
    
    section Sprint 5 (Week 5)
    Server Actions              :s5, after s4, 5d
    
    section Sprint 6 (Week 6)
    UI Components               :s6, after s5, 5d
    
    section Sprint 7 (Week 7)
    Frontend Pages              :s7, after s6, 5d
    
    section Sprint 8 (Week 8)
    Data Migration              :s8, after s7, 5d
    
    section Sprint 9 (Week 9)
    Testing                     :s9, after s8, 5d
    
    section Sprint 10 (Week 10)
    Production Launch           :s10, after s9, 5d
```

### Task Checklist (Summary)

#### Phase 0: Setup ✅
- [ ] 0.1: Clone Next.js SaaS Starter (2h)
- [ ] 0.2: Restructure project (1d)
- [ ] 0.3: Migrate legacy code structure (1d)
- [ ] 0.4: Environment configuration (2h)

#### Phase 1: Infrastructure ✅
- [ ] 1.1: Database schema (3d)
- [ ] 1.2: Authentication setup (4d)

#### Phase 2: Backend ✅
- [ ] 2.1: Graph API integration (5d)
- [ ] 2.2: Vercel Cron setup (2d)
- [ ] 2.3: Server Actions API (5d)

#### Phase 3: Frontend ✅
- [ ] 3.1: UI component library (2d)
- [ ] 3.2: Device list page (3d)
- [ ] 3.3: Device detail page (2d)
- [ ] 3.4: Dashboard page (3d)

#### Phase 4: Migration ✅
- [ ] 4.1: Data migration script (3d)
- [ ] 4.2: Execute production migration (2d)

#### Phase 5: Launch ✅
- [ ] 5.1: Comprehensive testing (5d)
- [ ] 5.2: Production deployment (2d)

**Total Tasks:** 14 major tasks  
**Total Duration:** 50 business days (10 weeks)

---

## 10. Risk Mitigation

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data loss during migration** | Low | Critical | Backup before migration, dry-run first, validation script |
| **Azure AD auth issues** | Medium | High | Test in preview environment, have Azure support contact ready |
| **Graph API rate limiting** | Medium | Medium | Implement exponential backoff, use delta queries |
| **Performance degradation** | Low | High | Load testing before launch, Vercel auto-scales |
| **User adoption resistance** | High | Medium | Training sessions, detailed documentation, support channel |
| **Budget overrun** | Low | Low | Vercel free tier covers initial usage, monitor costs |

### Rollback Plan

If critical issues arise during production deployment:

1. **Immediate Rollback (< 5 minutes)**
   ```bash
   # Option 1: Revert Vercel deployment
   vercel promote <previous-deployment-id>
   
   # Option 2: Restart legacy Docker system
   docker-compose up -d
   ```

2. **Communication**
   - Notify all users via email/Slack
   - Update status page
   - Provide ETA for fix

3. **Root Cause Analysis**
   - Review Vercel logs
   - Check database queries
   - Verify Graph API connectivity
   - Check environment variables

4. **Fix and Redeploy**
   - Apply fix to staging
   - Test thoroughly
   - Redeploy to production

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-05 | Engineering Team | Initial roadmap with all migration tasks |

---

**End of Roadmap** - Ready to begin Phase 0!