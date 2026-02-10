/**
 * Role-Based Access Control (RBAC) Utilities
 * Simple role system for monitoring access
 */

import { getSession } from "@/lib/auth/session";

// ============================================================================
// Configuration
// ============================================================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@device-inventory.local";

// ============================================================================
// Role Checking Functions
// ============================================================================

/**
 * Check if the current user is a superadmin
 * Currently based on emergency admin email, can be extended with role field
 */
export async function isSuperadmin(): Promise<boolean> {
  const session = await getSession();
  
  if (!session?.user?.email) {
    return false;
  }

  // Check if user is the emergency admin
  return session.user.email === ADMIN_EMAIL;
}

/**
 * Require superadmin access - throws if not authorized
 * Use this in API routes and server actions
 */
export async function requireSuperadmin() {
  const isAdmin = await isSuperadmin();
  
  if (!isAdmin) {
    throw new Error(
      "Forbidden: Superadmin access required for this resource"
    );
  }

  return await getSession();
}

/**
 * Get current user role
 * Returns "superadmin" for emergency admin, "user" for everyone else
 */
export async function getCurrentUserRole(): Promise<"superadmin" | "user"> {
  const isAdmin = await isSuperadmin();
  return isAdmin ? "superadmin" : "user";
}
