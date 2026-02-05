# Document 09: Developer Handbook

**Version:** 1.0  
**Last Updated:** February 5, 2026  
**Author:** Engineering Team  
**Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Getting Started](#2-getting-started)
3. [Project Structure](#3-project-structure)
4. [Development Workflow](#4-development-workflow)
5. [Code Quality Standards](#5-code-quality-standards)
6. [Performance Best Practices](#6-performance-best-practices)
7. [Testing Guide](#7-testing-guide)
8. [Debugging](#8-debugging)
9. [Git Workflow](#9-git-workflow)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Executive Summary

### Purpose

This handbook serves as the definitive guide for developers working on Device Inventory v2. It covers setup, workflows, standards, and best practices to ensure consistent, high-quality code.

### Technology Stack

```mermaid
flowchart TD
    Frontend[Frontend Layer] --> NextJS[Next.js 15 App Router]
    Frontend --> React[React 19 Server Components]
    Frontend --> Tailwind[Tailwind CSS + shadcn/ui]
    
    Backend[Backend Layer] --> ServerActions[Server Actions]
    Backend --> Auth[NextAuth.js]
    Backend --> Cron[Vercel Cron]
    
    Data[Data Layer] --> Postgres[(Vercel Postgres)]
    Data --> Drizzle[Drizzle ORM]
    Data --> Graph[Microsoft Graph API]
    
    DevTools[Developer Tools] --> TypeScript[TypeScript 5.3]
    DevTools --> ESLint[ESLint + Prettier]
    DevTools --> Vitest[Vitest + Playwright]
    DevTools --> pnpm[pnpm Package Manager]
    
    Deployment[Deployment] --> Vercel[Vercel Platform]
    
    style NextJS fill:#48dbfb
    style Postgres fill:#5f27cd
    style Vercel fill:#00d2d3
```

### Key Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **Server-First** | Default to Server Components, use Client Components sparingly | `'use client'` only when needed |
| **Type Safety** | Strict TypeScript, Zod validation, end-to-end types | No `any` types allowed |
| **Performance** | Sub-2s initial load, instant interactions | Follow Vercel best practices |
| **Accessibility** | WCAG 2.1 AA compliance | All interactive elements keyboard accessible |
| **Maintainability** | Clear naming, comprehensive docs, modular code | Functions < 50 lines |

---

## 2. Getting Started

### Prerequisites

```bash
# Required software versions
Node.js: 18.17 or higher (LTS recommended)
pnpm: 8.0 or higher
Git: 2.30 or higher

# Recommended IDE
VS Code with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Prisma/Drizzle (for schema syntax)
```

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/device-inventory-v2.git
cd device-inventory-v2

# 2. Install dependencies (uses pnpm for faster installs)
pnpm install

# 3. Copy environment template
cp .env.example .env.local

# 4. Configure environment variables
# Edit .env.local with your Azure AD and database credentials
# See "Environment Variables" section for required values

# 5. Generate database client
pnpm db:generate

# 6. Run database migrations
pnpm db:push

# 7. Seed database with sample data (optional)
pnpm db:seed

# 8. Start development server
pnpm dev

# 9. Open browser
# Navigate to http://localhost:3000
```

### Environment Variables

```bash
# .env.local (required for local development)

# Database
POSTGRES_URL=postgres://user:password@localhost:5432/device_inventory

# Azure AD (create app registration in Azure Portal)
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret

# NextAuth.js (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Cron Security (generate with: openssl rand -base64 32)
CRON_SECRET=your-cron-secret

# Optional: Enable debug logs
DEBUG=true
```

### Verify Setup

```bash
# Run health checks
pnpm check

# Expected output:
# ✓ Node.js version: 20.11.0
# ✓ pnpm version: 8.15.0
# ✓ TypeScript: compiles without errors
# ✓ Database: connection successful
# ✓ Environment variables: all required vars present
```

---

## 3. Project Structure

### Directory Layout

```
device-inventory-v2/
├── app/                          # Next.js 15 App Router
│   ├── (auth)/                   # Auth route group (no layout)
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   └── 403/
│   │       └── page.tsx          # Forbidden page
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts      # NextAuth.js handler
│   │   └── cron/
│   │       └── sync/
│   │           └── route.ts      # Vercel Cron endpoint
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard page
│   ├── devices/
│   │   ├── page.tsx              # Device list page
│   │   └── [id]/
│   │       ├── page.tsx          # Device detail page
│   │       └── edit/
│   │           └── page.tsx      # Device edit page (admin only)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── metric-card.tsx
│   │   └── devices-by-os-chart.tsx
│   ├── devices/                  # Device-specific components
│   │   ├── device-table.tsx
│   │   ├── device-actions.tsx
│   │   └── edit-device-form.tsx
│   └── layout/                   # Layout components
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── mobile-nav.tsx
│
├── lib/                          # Shared utilities and logic
│   ├── actions/                  # Server Actions (API layer)
│   │   ├── device-actions.ts     # Device CRUD operations
│   │   ├── user-actions.ts       # User management
│   │   ├── sync-actions.ts       # Sync triggers
│   │   └── types.ts              # Shared action types
│   ├── auth/                     # Authentication
│   │   ├── auth-options.ts       # NextAuth.js config
│   │   └── rbac.ts               # RBAC helper functions
│   ├── db/                       # Database
│   │   ├── drizzle.ts            # Drizzle client
│   │   └── schema.ts             # Drizzle schema definitions
│   ├── graph/                    # Microsoft Graph API
│   │   ├── auth-provider.ts      # Azure AD auth
│   │   └── graph-client.ts       # Graph API wrapper
│   ├── services/                 # Business logic
│   │   └── sync-service.ts       # Device/user sync service
│   ├── utils/                    # Utility functions
│   │   ├── date.ts               # Date formatting
│   │   ├── retry.ts              # Retry with backoff
│   │   └── cn.ts                 # Class name merger
│   └── validation/               # Validation schemas
│       └── schemas.ts            # Zod schemas
│
├── hooks/                        # Custom React hooks
│   └── useRole.ts                # Role-based access hook
│
├── types/                        # TypeScript types
│   ├── models.ts                 # Data model types
│   └── next-auth.d.ts            # NextAuth.js type extensions
│
├── public/                       # Static assets
│   ├── favicon.ico
│   └── images/
│
├── __tests__/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                         # Documentation
│   ├── 01_Master_PRD.md
│   ├── 02_System_Architecture.md
│   └── ...
│
├── scripts/                      # Utility scripts
│   ├── seed.ts                   # Database seeding
│   └── migrate.ts                # Migration helpers
│
├── .env.example                  # Environment template
├── .eslintrc.json                # ESLint config
├── .prettierrc                   # Prettier config
├── drizzle.config.ts             # Drizzle ORM config
├── middleware.ts                 # Next.js middleware (auth)
├── next.config.js                # Next.js config
├── package.json                  # Dependencies
├── tailwind.config.ts            # Tailwind CSS config
├── tsconfig.json                 # TypeScript config
└── vercel.json                   # Vercel config (cron)
```

### Key Directories Explained

#### `/app` - Next.js App Router

- **Route Groups**: `(auth)` group excludes sidebar/header layout
- **File Conventions**:
  - `page.tsx` - Page component (publicly accessible route)
  - `layout.tsx` - Shared layout for route segment
  - `loading.tsx` - Loading UI (automatic Suspense boundary)
  - `error.tsx` - Error UI (automatic Error Boundary)
  - `route.ts` - API route handler

#### `/lib/actions` - Server Actions

- All Server Actions (backend API)
- Must include `'use server'` directive
- Return standardized `ActionResponse<T>` type
- Include auth/RBAC checks

#### `/components` - React Components

- `/ui` - shadcn/ui base components (never modify directly)
- Feature folders (`/dashboard`, `/devices`) - feature-specific components
- `/layout` - App-wide layout components

---

## 4. Development Workflow

### Daily Development Flow

```mermaid
flowchart LR
    Start[Start Day] --> Pull[git pull main]
    Pull --> Branch[Create feature branch]
    Branch --> Code[Write code]
    Code --> Test[Run tests]
    Test --> Commit[Commit changes]
    Commit --> PR[Open Pull Request]
    PR --> Review[Code review]
    Review --> Merge[Merge to main]
    Merge --> Deploy[Auto-deploy to Vercel]
    
    style Code fill:#48dbfb
    style Deploy fill:#00d2d3
```

### Common Commands

```bash
# Development
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Build for production
pnpm start            # Start production server (after build)

# Database
pnpm db:generate      # Generate Drizzle client from schema
pnpm db:push          # Push schema changes to database
pnpm db:studio        # Open Drizzle Studio (visual DB editor)
pnpm db:seed          # Seed database with sample data

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Auto-fix ESLint errors
pnpm format           # Run Prettier
pnpm type-check       # TypeScript type checking

# Testing
pnpm test             # Run unit tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run end-to-end tests (Playwright)
pnpm test:coverage    # Generate coverage report

# All-in-one checks (run before committing)
pnpm check            # Run lint + type-check + tests
```

### Hot Reload (Fast Refresh)

Next.js supports Fast Refresh for instant feedback:

```typescript
// Changes to components are reflected immediately (< 1s)
export function DeviceCard({ device }: { device: Device }) {
  return (
    <div>
      {/* Edit this JSX, save, see instant update */}
      <h3>{device.name}</h3>
    </div>
  );
}

// Changes to Server Actions require manual refresh
'use server';
export async function getDevices() {
  // Edit this function, save, REFRESH BROWSER to see changes
}
```

---

## 5. Code Quality Standards

### TypeScript Standards

#### Strict Mode (Enforced)

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### Type Best Practices

```typescript
// ❌ Bad: Using 'any'
function processDevice(device: any) {
  return device.name.toUpperCase();
}

// ✅ Good: Explicit types
function processDevice(device: Device) {
  return device.name.toUpperCase();
}

// ❌ Bad: Type assertion without validation
const device = data as Device;

// ✅ Good: Zod validation + inferred type
const DeviceSchema = z.object({ name: z.string() });
const device = DeviceSchema.parse(data); // Throws if invalid

// ❌ Bad: Optional chaining everywhere (hides real issues)
const name = device?.user?.name?.toUpperCase();

// ✅ Good: Handle null explicitly
const name = device.user
  ? device.user.name.toUpperCase()
  : 'Unassigned';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Components** | PascalCase | `DeviceTable`, `MetricCard` |
| **Functions** | camelCase | `getDevices`, `formatDate` |
| **Variables** | camelCase | `deviceList`, `isAdmin` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE`, `DEFAULT_ROLE` |
| **Types/Interfaces** | PascalCase | `Device`, `ActionResponse<T>` |
| **Files (components)** | kebab-case | `device-table.tsx`, `metric-card.tsx` |
| **Files (utilities)** | kebab-case | `auth-options.ts`, `graph-client.ts` |

### ESLint Rules

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "react/jsx-key": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 6. Performance Best Practices

### Critical Performance Rules (from Vercel)

#### 1. Avoid Barrel Imports

```typescript
// ❌ Bad: Barrel imports increase bundle size
import { Button, Card, Badge } from '@/components/ui';

// ✅ Good: Direct imports (tree-shakeable)
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

#### 2. Use Dynamic Imports for Heavy Components

```typescript
// ❌ Bad: Loads chart library on initial page load
import { DevicesByOSChart } from '@/components/dashboard/devices-by-os-chart';

// ✅ Good: Load chart library only when needed
import dynamic from 'next/dynamic';

const DevicesByOSChart = dynamic(
  () => import('@/components/dashboard/devices-by-os-chart'),
  { loading: () => <Skeleton /> }
);
```

#### 3. Parallelize Data Fetching

```typescript
// ❌ Bad: Sequential fetches (waterfall)
async function DashboardPage() {
  const devices = await getDevices();
  const users = await getUsers();
  const metrics = await getMetrics();
  // Total time: fetch1 + fetch2 + fetch3
}

// ✅ Good: Parallel fetches
async function DashboardPage() {
  const [devices, users, metrics] = await Promise.all([
    getDevices(),
    getUsers(),
    getMetrics(),
  ]);
  // Total time: max(fetch1, fetch2, fetch3)
}
```

#### 4. Minimize Server Component Props

```typescript
// ❌ Bad: Pass entire large object to Client Component
<DeviceTable devices={devices} /> // devices = 5000 items

// ✅ Good: Pass only required data
<DeviceTable
  deviceCount={devices.length}
  topDevices={devices.slice(0, 10)}
/>
```

#### 5. Use React.cache() for Deduplication

```typescript
// lib/actions/device-actions.ts

import { cache } from 'react';

// Without cache: Multiple calls fetch data multiple times
export async function getDevices() {
  return db.select().from(devices);
}

// With cache: Multiple calls in same request return cached result
export const getDevices = cache(async () => {
  return db.select().from(devices);
});

// Usage: Both calls use same data (only 1 DB query)
const devices1 = await getDevices();
const devices2 = await getDevices();
```

### Performance Checklist

- [ ] Bundle size < 100 KB (first load JS)
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] First Input Delay (FID) < 100ms
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] Images optimized (Next.js Image component)
- [ ] Fonts optimized (next/font)
- [ ] No client-side data fetching on initial load
- [ ] Server Components by default

---

## 7. Testing Guide

### Testing Strategy

```mermaid
flowchart TD
    Tests[Test Suite] --> Unit[Unit Tests]
    Tests --> Integration[Integration Tests]
    Tests --> E2E[End-to-End Tests]
    
    Unit --> Actions[Server Actions]
    Unit --> Utils[Utility Functions]
    Unit --> Components[Component Logic]
    
    Integration --> API[API Routes]
    Integration --> Database[Database Queries]
    Integration --> Auth[Authentication Flow]
    
    E2E --> UserFlows[User Flows]
    E2E --> Critical[Critical Paths]
    
    style Unit fill:#48dbfb
    style Integration fill:#feca57
    style E2E fill:#5f27cd
```

### Unit Tests (Vitest)

```typescript
// __tests__/unit/lib/utils/date.test.ts

import { describe, it, expect } from 'vitest';
import { formatDate } from '@/lib/utils/date';

describe('formatDate', () => {
  it('should format date as MM/DD/YYYY', () => {
    const date = new Date('2026-02-05T12:00:00Z');
    expect(formatDate(date)).toBe('02/05/2026');
  });

  it('should handle invalid date', () => {
    expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
  });
});
```

### Integration Tests (Vitest + Database)

```typescript
// __tests__/integration/lib/actions/device-actions.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDevices, updateDevice } from '@/lib/actions/device-actions';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';

describe('Device Actions', () => {
  beforeAll(async () => {
    // Seed test database
    await db.insert(devices).values({
      intuneId: 'test-device-1',
      name: 'Test Device',
      operatingSystem: 'Windows',
      complianceStatus: 'compliant',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(devices).where(eq(devices.intuneId, 'test-device-1'));
  });

  it('should fetch devices', async () => {
    const result = await getDevices({ page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    expect(result.data.devices).toHaveLength(1);
  });

  it('should update device', async () => {
    const result = await updateDevice({
      deviceId: 1,
      updates: { name: 'Updated Name' },
    });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Updated Name');
  });
});
```

### End-to-End Tests (Playwright)

```typescript
// __tests__/e2e/device-list.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Device List', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.click('button:has-text("Sign in with Azure AD")');
    // ... handle Azure AD login flow
  });

  test('should display device list', async ({ page }) => {
    await page.goto('/devices');

    // Check table is visible
    await expect(page.locator('table')).toBeVisible();

    // Check at least one device row
    await expect(page.locator('tbody tr')).toHaveCount({ min: 1 });
  });

  test('should filter devices by compliance status', async ({ page }) => {
    await page.goto('/devices');

    // Select "Compliant" filter
    await page.selectOption('select[aria-label="Compliance Status"]', 'compliant');

    // Wait for table to update
    await page.waitForTimeout(500);

    // Check all visible badges are green
    const badges = await page.locator('span:has-text("Compliant")').count();
    expect(badges).toBeGreaterThan(0);
  });

  test('should open device detail modal', async ({ page }) => {
    await page.goto('/devices');

    // Click first device row
    await page.click('tbody tr:first-child');

    // Check modal is visible
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('h2:has-text("Device Details")')).toBeVisible();
  });
});
```

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode (re-run on file changes)
pnpm test:watch

# Run specific test file
pnpm test device-actions.test.ts

# Run tests with coverage
pnpm test:coverage

# Run E2E tests (headless)
pnpm test:e2e

# Run E2E tests with UI (debugging)
pnpm test:e2e:ui
```

---

## 8. Debugging

### VS Code Debug Configuration

```json
// .vscode/launch.json

{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Debugging Server Actions

```typescript
// lib/actions/device-actions.ts

'use server';

export async function getDevices() {
  console.log('getDevices called'); // Logs appear in terminal (not browser)
  
  const devices = await db.select().from(devices);
  console.log('Fetched devices:', devices.length);
  
  return { success: true, data: devices };
}
```

### Debugging Client Components

```typescript
'use client';

export function DeviceTable({ devices }: { devices: Device[] }) {
  console.log('DeviceTable rendered with', devices.length, 'devices'); // Logs in browser console
  
  useEffect(() => {
    console.log('DeviceTable mounted');
  }, []);
  
  return <table>...</table>;
}
```

### Network Request Debugging

```bash
# Enable verbose logging for Graph API calls
DEBUG=true pnpm dev

# Logs will show:
# [Graph API] GET /deviceManagement/managedDevices/delta
# [Graph API] Response: 200 OK (5000 devices)
```

---

## 9. Git Workflow

### Branch Naming

```bash
# Feature branches
feature/device-filtering
feature/user-management

# Bug fixes
bugfix/device-table-pagination
bugfix/auth-redirect-loop

# Hotfixes (production bugs)
hotfix/sync-job-timeout
```

### Commit Message Format

```bash
# Format: <type>(<scope>): <subject>

# Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Code style changes (formatting, no logic change)
refactor: Code refactoring (no feature change)
test:     Adding or updating tests
chore:    Build process, dependencies, etc.

# Examples:
feat(devices): add compliance status filter
fix(auth): resolve redirect loop on login
docs(readme): update setup instructions
refactor(actions): extract common RBAC checks
test(devices): add device-table unit tests
```

### Pull Request Template

````markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Commented complex code
- [ ] Documentation updated
- [ ] No new warnings
````

### Pre-Commit Hooks (Husky)

```json
// package.json

{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm lint-staged",
      "pre-push": "pnpm check"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

---

## 10. Troubleshooting

### Common Issues

#### Issue: "Module not found" error

```bash
# Error: Cannot find module '@/components/ui/button'

# Solution: Clear Next.js cache
rm -rf .next
pnpm dev
```

#### Issue: Database connection fails

```bash
# Error: Connection refused to postgres://...

# Solution: Verify POSTGRES_URL in .env.local
# Check database is running (if local):
docker ps  # Should show postgres container

# Test connection manually:
psql $POSTGRES_URL -c "SELECT 1"
```

#### Issue: Azure AD login fails

```bash
# Error: AADSTS50011 Redirect URI mismatch

# Solution: Add redirect URI to Azure AD app registration
# Go to: Azure Portal > App Registrations > Your App > Authentication
# Add: http://localhost:3000/api/auth/callback/azure-ad
```

#### Issue: Server Action returns stale data

```bash
# Problem: Changes not reflected after updating device

# Solution: Use router.refresh() to revalidate
import { useRouter } from 'next/navigation';

const router = useRouter();
await updateDevice(deviceId, updates);
router.refresh(); // Triggers server re-render
```

#### Issue: Type errors after updating schema

```bash
# Error: Property 'newField' does not exist on type 'Device'

# Solution: Regenerate Drizzle client
pnpm db:generate
# Restart TypeScript server in VS Code: Cmd+Shift+P > "Restart TS Server"
```

### Performance Issues

#### Slow page load

```bash
# Debug bundle size
pnpm build
# Check output for large chunks

# Analyze bundle
pnpm add -D @next/bundle-analyzer
# Update next.config.js:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({...});

# Run analysis
ANALYZE=true pnpm build
```

#### Slow database queries

```typescript
// Enable query logging
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';

export const db = drizzle(sql, {
  logger: true, // Logs all SQL queries
});

// Check slow queries in Vercel Postgres dashboard
// https://vercel.com/{team}/{project}/stores/postgres
```

---

## Appendix A: Quick Reference

### File Naming Cheatsheet

| File Type | Naming | Example |
|-----------|--------|---------|
| **Page** | `page.tsx` | `app/devices/page.tsx` |
| **Layout** | `layout.tsx` | `app/layout.tsx` |
| **Component** | `kebab-case.tsx` | `device-table.tsx` |
| **Server Action** | `*-actions.ts` | `device-actions.ts` |
| **Utility** | `kebab-case.ts` | `auth-options.ts` |
| **Type** | `*.d.ts` or `.ts` | `next-auth.d.ts`, `models.ts` |
| **Test** | `*.test.ts` | `device-actions.test.ts` |

### Keyboard Shortcuts (VS Code)

| Action | Shortcut |
|--------|----------|
| **Command Palette** | Cmd+Shift+P |
| **Quick Open** | Cmd+P |
| **Go to Definition** | F12 |
| **Find All References** | Shift+F12 |
| **Rename Symbol** | F2 |
| **Format Document** | Shift+Alt+F |
| **Toggle Terminal** | Ctrl+` |

---

## Appendix B: Useful Resources

### Documentation Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Microsoft Graph API Reference](https://learn.microsoft.com/en-us/graph/api/overview)

### Internal Documentation

- [01_Master_PRD.md](./01_Master_PRD.md) - Product requirements
- [02_System_Architecture.md](./02_System_Architecture.md) - Architecture overview
- [03_Database_Schema_Design.md](./03_Database_Schema_Design.md) - Database schema
- [06_API_Server_Actions_Spec.md](./06_API_Server_Actions_Spec.md) - API reference
- [08_UI_UX_Guidelines.md](./08_UI_UX_Guidelines.md) - UI component guide

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-05 | Engineering Team | Initial production-ready document |

---

**Next Document:** [10_CI_CD_Pipeline.md](./10_CI_CD_Pipeline.md)