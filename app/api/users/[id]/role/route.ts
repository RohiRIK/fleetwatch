/**
 * User Role Management API
 * PATCH /api/users/[id]/role
 * 
 * Update user role - SUPERADMIN only
 */

import { NextRequest, NextResponse } from "next/server";
import { protectRouteWithRole } from "@/lib/auth/api-rbac";
import { updateUserRole } from "@/lib/auth/rbac";
import { log } from "@/lib/logger/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protect route - only SUPERADMIN can update roles
  const { error, session } = await protectRouteWithRole("SUPERADMIN");
  if (error) return error;

  try {
    const { role } = await request.json();
    const userId = params.id;

    // Validate role
    if (!["VIEWER", "ADMIN", "SUPERADMIN"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be VIEWER, ADMIN, or SUPERADMIN" },
        { status: 400 }
      );
    }

    // Prevent self-demotion from SUPERADMIN
    if (session?.user?.id === userId && role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Cannot change your own role from SUPERADMIN" },
        { status: 403 }
      );
    }

    // Update role
    await updateUserRole(userId, role);

    log.info("User role updated", {
      context: "UserRoleManagement",
      metadata: {
        userId,
        newRole: role,
        updatedBy: session?.user?.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User role updated to ${role}`,
    });
  } catch (error) {
    log.error("Failed to update user role", {
      context: "UserRoleManagement",
      error: error as Error,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update role",
      },
      { status: 500 }
    );
  }
}
