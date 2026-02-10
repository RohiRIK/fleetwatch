# Role-Based Access Control (RBAC) System

## Overview

FleetWatch implements a **3-tier role-based access control system** to ensure proper authorization and security.

## Roles

### 🔵 VIEWER (Level 1)
**Description:** Read-only access to view data  
**Use Case:** Team members who need to monitor devices but not make changes

**Permissions:**
- ✅ View devices
- ✅ View users
- ✅ View analytics
- ✅ View compliance reports
- ❌ Export data
- ❌ Manage devices
- ❌ Manage users
- ❌ Manage settings
- ❌ Trigger sync
- ❌ View monitoring dashboard

---

### 🟡 ADMIN (Level 2)
**Description:** Full device management access  
**Use Case:** IT administrators who manage devices and settings

**Permissions:**
- ✅ View devices
- ✅ View users
- ✅ View analytics
- ✅ View compliance reports
- ✅ Export data (CSV/PDF)
- ✅ Manage devices
- ✅ Manage settings
- ✅ Trigger manual sync
- ✅ View monitoring dashboard
- ❌ Manage users **Cannot assign/change roles**

---

### 🔴 SUPERADMIN (Level 3)
**Description:** System administrator with full access  
**Use Case:** System owners and technical leads

**Permissions:**
- ✅ All ADMIN permissions
- ✅ Manage users
- ✅ Assign/change user roles
- ✅ Full system access

---

## Implementation

### Database Schema

```sql
-- User role enum
CREATE TYPE user_role AS ENUM('VIEWER', 'ADMIN', 'SUPERADMIN');

-- Users table
ALTER TABLE users ADD COLUMN role user_role DEFAULT 'VIEWER' NOT NULL;
```

### Usage in Code

#### Server-side Protection

```typescript
// In API routes
import { protectRouteWithRole } from '@/lib/auth/api-rbac';

export async function POST(request: NextRequest) {
  // Require ADMIN or higher
  const { error, session, role } = await protectRouteWithRole('ADMIN');
  if (error) return error;
  
  // Your logic here
}
```

```typescript
// With specific permissions
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

export async function DELETE(request: NextRequest) {
  // Require specific permission
  const { error } = await protectRouteWithPermission('manage_devices');
  if (error) return error;
  
  // Your logic here
}
```

#### Middleware Protection

Routes are automatically protected by middleware based on configuration:

```typescript
// middleware.ts
const ROUTE_ACCESS = {
  viewer: ['/dashboard', '/inventory', '/devices', '/analytics', '/compliance'],
  admin: ['/admin/settings', '/admin/monitoring'],
  superadmin: ['/users', '/admin/users'],
};
```

#### Client-side Checks

```typescript
import { getCurrentUserRole, hasPermission } from '@/lib/auth/rbac';

// Check role
const role = await getCurrentUserRole();
if (role === 'SUPERADMIN') {
  // Show admin controls
}

// Check permission
const canExport = await hasPermission('export_data');
if (canExport) {
  // Show export button
}
```

---

## Permission Matrix

| Permission | VIEWER | ADMIN | SUPERADMIN |
|------------|--------|-------|------------|
| `view_devices` | ✅ | ✅ | ✅ |
| `view_users` | ✅ | ✅ | ✅ |
| `view_analytics` | ✅ | ✅ | ✅ |
| `view_compliance` | ✅ | ✅ | ✅ |
| `export_data` | ❌ | ✅ | ✅ |
| `manage_devices` | ❌ | ✅ | ✅ |
| `manage_users` | ❌ | ❌ | ✅ |
| `manage_settings` | ❌ | ✅ | ✅ |
| `trigger_sync` | ❌ | ✅ | ✅ |
| `view_monitoring` | ❌ | ✅ | ✅ |

---

## Protected Routes

### Frontend Routes (Middleware)

| Route Pattern | Minimum Role | Purpose |
|---------------|--------------|---------|
| `/login`, `/admin-login` | Public | Authentication |
| `/dashboard` | VIEWER | Main dashboard |
| `/inventory` | VIEWER | Device inventory |
| `/devices/*` | VIEWER | Device details |
| `/analytics` | VIEWER | Analytics & reports |
| `/compliance` | VIEWER | Compliance tracking |
| `/admin/settings` | ADMIN | System settings |
| `/admin/monitoring` | ADMIN | Monitoring dashboard |
| `/users` | SUPERADMIN | User management |
| `/admin/users` | SUPERADMIN | Advanced user admin |

### API Routes

| Endpoint | Method | Minimum Role/Permission | Purpose |
|----------|--------|------------------------|---------|
| `/api/devices` | GET | VIEWER | List devices |
| `/api/devices` | POST | `manage_devices` | Create device |
| `/api/devices/[id]` | DELETE | `manage_devices` | Delete device |
| `/api/users` | GET | SUPERADMIN | List users |
| `/api/users/[id]/role` | PATCH | SUPERADMIN | Update user role |
| `/api/cron/sync-devices` | POST | `trigger_sync` | Manual sync |
| `/api/monitoring/errors` | GET | `view_monitoring` | View errors |

---

## Role Assignment

### Initial Setup

On first deployment, create a SUPERADMIN user using the emergency admin:

```bash
# Set in environment variables
ADMIN_EMAIL=admin@yourcompany.com
```

This user will automatically have SUPERADMIN role and can assign roles to other users.

### Managing Roles (SUPERADMIN only)

#### Via UI
1. Navigate to `/users`
2. Find the user
3. Click on their role badge dropdown
4. Select new role (VIEWER, ADMIN, or SUPERADMIN)

#### Via API
```bash
curl -X PATCH https://your-domain.com/api/users/{userId}/role \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

#### Via Database
```sql
UPDATE users 
SET role = 'ADMIN', updated_at = NOW() 
WHERE email = 'user@example.com';
```

---

## Security Considerations

### ✅ Best Practices

1. **Principle of Least Privilege**: Start users as VIEWER, promote as needed
2. **Regular Audits**: Review user roles quarterly
3. **Separation of Duties**: Admins cannot manage users (only SUPERADMIN)
4. **Audit Logging**: All role changes are logged in `activity_logs`
5. **Self-Protection**: SUPERADMIN cannot demote themselves

### 🚫 Anti-Patterns

- ❌ Making everyone ADMIN "for convenience"
- ❌ Sharing SUPERADMIN credentials
- ❌ Hard-coding role checks in UI without API protection
- ❌ Bypassing middleware with direct API calls

---

## Testing

Run RBAC tests:

```bash
bun test __tests__/unit/lib/auth/rbac.integration.test.ts
```

Tests cover:
- Permission matrix validation
- Role hierarchy
- Authorization guards
- Permission consistency

---

## Migration Guide

### From Previous System

The system previously used email-based admin checking. Migration steps:

1. Run migration: `bun run drizzle-kit push`
2. All existing users will default to `VIEWER` role
3. Emergency admin (from `ADMIN_EMAIL`) automatically gets `SUPERADMIN`
4. Manually promote trusted users to `ADMIN` or `SUPERADMIN`

### Database Migration

```sql
-- Auto-generated migration: drizzle/0004_clean_swarm.sql
CREATE TYPE "public"."user_role" AS ENUM('VIEWER', 'ADMIN', 'SUPERADMIN');
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'VIEWER' NOT NULL;
```

---

## Troubleshooting

### User Can't Access Expected Routes

1. Check user role: `SELECT email, role FROM users WHERE email = 'user@example.com';`
2. Verify middleware configuration in `middleware.ts`
3. Check browser console for 403 errors
4. Clear session cookies and re-login

### "Insufficient Permissions" Error

1. Verify user has correct role for the action
2. Check permission matrix (see above)
3. Review API route protection in code
4. Check Sentry for detailed error logs

### Role Changes Not Taking Effect

1. User must log out and log back in
2. Session caches role - force refresh by clearing session
3. Verify database update: `SELECT * FROM users WHERE id = '{userId}';`

---

## Future Enhancements

Planned improvements:

- [ ] Custom role creation (beyond 3 tiers)
- [ ] Permission granularity (per-device, per-department)
- [ ] Role-based email notifications
- [ ] Temporary role elevation
- [ ] Audit log UI for role changes
- [ ] Bulk role assignment
- [ ] Role templates

---

## Related Documentation

- `lib/auth/rbac.ts` - Core RBAC logic
- `lib/auth/api-rbac.ts` - API protection helpers
- `middleware.ts` - Route protection
- `components/auth/RoleBadge.tsx` - Role UI component
- `__tests__/unit/lib/auth/rbac.integration.test.ts` - Tests

---

**Last Updated:** 2026-02-10  
**Version:** 1.0.0
