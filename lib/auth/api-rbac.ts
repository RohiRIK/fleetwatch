/**
 * API Route RBAC Protection Utilities
 * Use these helpers to protect API routes with role-based access control
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getCurrentUserRole,
  hasMinRole,
  hasPermission,
  type UserRole,
} from "@/lib/auth/rbac";

/**
 * Protect API route - requires authentication
 * Returns user session if authenticated, or 401 error response
 */
export async function protectRoute() {
  const session = await getSession();

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Protect API route with minimum role requirement
 * Returns user session if authorized, or error response
 */
export async function protectRouteWithRole(minRole: UserRole) {
  const { error, session } = await protectRoute();

  if (error) return { error, session, role: null };

  const hasAccess = await hasMinRole(minRole);

  if (!hasAccess) {
    const userRole = await getCurrentUserRole();
    return {
      error: NextResponse.json(
        {
          error: "Forbidden",
          message: `${minRole} role required. Your role: ${userRole}`,
        },
        { status: 403 }
      ),
      session: null,
      role: userRole,
    };
  }

  const role = await getCurrentUserRole();
  return { error: null, session, role };
}

/**
 * Protect API route with specific permission
 * Returns user session if authorized, or error response
 */
export async function protectRouteWithPermission(
  permission: Parameters<typeof hasPermission>[0]
) {
  const { error, session } = await protectRoute();

  if (error) return { error, session, role: null };

  const hasAccess = await hasPermission(permission);

  if (!hasAccess) {
    const role = await getCurrentUserRole();
    return {
      error: NextResponse.json(
        {
          error: "Forbidden",
          message: `Permission '${permission}' required. Your role: ${role}`,
        },
        { status: 403 }
      ),
      session: null,
      role,
    };
  }

  const role = await getCurrentUserRole();
  return { error: null, session, role };
}

/**
 * Usage examples:
 * 
 * // Basic auth protection
 * export async function GET() {
 *   const { error, session } = await protectRoute();
 *   if (error) return error;
 *   // ... your route logic
 * }
 * 
 * // Require ADMIN role
 * export async function POST() {
 *   const { error, session, role } = await protectRouteWithRole("ADMIN");
 *   if (error) return error;
 *   // ... your route logic
 * }
 * 
 * // Require specific permission
 * export async function DELETE() {
 *   const { error, session, role } = await protectRouteWithPermission("manage_devices");
 *   if (error) return error;
 *   // ... your route logic
 * }
 */
