/**
 * Role-Based Access Control (RBAC) Utilities
 * 3-tier role system: VIEWER, ADMIN, SUPERADMIN
 */

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type UserRole = "VIEWER" | "ADMIN" | "SUPERADMIN";

export const PERMISSIONS = {
  VIEWER: {
    view_devices: true,
    view_users: true,
    view_analytics: true,
    view_compliance: true,
    export_data: false,
    manage_devices: false,
    manage_users: false,
    manage_settings: false,
    trigger_sync: false,
    view_monitoring: false,
  },
  ADMIN: {
    view_devices: true,
    view_users: true,
    view_analytics: true,
    view_compliance: true,
    export_data: true,
    manage_devices: true,
    manage_users: false, // Cannot manage users
    manage_settings: true,
    trigger_sync: true,
    view_monitoring: true,
  },
  SUPERADMIN: {
    view_devices: true,
    view_users: true,
    view_analytics: true,
    view_compliance: true,
    export_data: true,
    manage_devices: true,
    manage_users: true, // Can manage users and roles
    manage_settings: true,
    trigger_sync: true,
    view_monitoring: true,
  },
} as const;

// ============================================================================
// Configuration
// ============================================================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@device-inventory.local";

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get user from database with role
 */
async function getUserWithRole(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
}

/**
 * Get current user role from database
 */
export async function getCurrentUserRole(): Promise<UserRole> {
  const session = await getSession();
  
  if (!session?.user?.email) {
    return "VIEWER";
  }

  // Emergency admin fallback
  if (session.user.email === ADMIN_EMAIL) {
    return "SUPERADMIN";
  }

  const user = await getUserWithRole(session.user.email);
  return (user?.role as UserRole) || "VIEWER";
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  return userRole === role;
}

/**
 * Check if user has minimum role level
 * SUPERADMIN > ADMIN > VIEWER
 */
export async function hasMinRole(minRole: UserRole): Promise<boolean> {
  const userRole = await getCurrentUserRole();
  
  const roleHierarchy: Record<UserRole, number> = {
    VIEWER: 1,
    ADMIN: 2,
    SUPERADMIN: 3,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  permission: keyof typeof PERMISSIONS.VIEWER
): Promise<boolean> {
  const role = await getCurrentUserRole();
  return PERMISSIONS[role][permission];
}

// ============================================================================
// Role-Specific Checks
// ============================================================================

export async function isViewer(): Promise<boolean> {
  return hasRole("VIEWER");
}

export async function isAdmin(): Promise<boolean> {
  return hasMinRole("ADMIN");
}

export async function isSuperadmin(): Promise<boolean> {
  return hasRole("SUPERADMIN");
}

// ============================================================================
// Authorization Guards (throws if unauthorized)
// ============================================================================

/**
 * Require viewer role or higher
 */
export async function requireViewer() {
  const hasAccess = await hasMinRole("VIEWER");
  
  if (!hasAccess) {
    throw new Error("Forbidden: Viewer access required");
  }

  return await getSession();
}

/**
 * Require admin role or higher
 */
export async function requireAdmin() {
  const hasAccess = await hasMinRole("ADMIN");
  
  if (!hasAccess) {
    throw new Error("Forbidden: Admin access required");
  }

  return await getSession();
}

/**
 * Require superadmin role
 */
export async function requireSuperadmin() {
  const hasAccess = await isSuperadmin();
  
  if (!hasAccess) {
    throw new Error("Forbidden: Superadmin access required");
  }

  return await getSession();
}

/**
 * Require specific permission
 */
export async function requirePermission(
  permission: keyof typeof PERMISSIONS.VIEWER
) {
  const hasAccess = await hasPermission(permission);
  
  if (!hasAccess) {
    throw new Error(`Forbidden: ${permission} permission required`);
  }

  return await getSession();
}

// ============================================================================
// User Management (Superadmin only)
// ============================================================================

/**
 * Update user role (Superadmin only)
 */
export async function updateUserRole(userId: string, newRole: UserRole) {
  await requireSuperadmin();
  
  await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
