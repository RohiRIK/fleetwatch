/**
 * Monitoring Errors API Route
 * GET /api/monitoring/errors
 * 
 * Fetches recent errors from Sentry
 * Accessible to ADMIN and SUPERADMIN only
 */

import { NextResponse } from "next/server";
import { protectRouteWithPermission } from "@/lib/auth/api-rbac";
import { fetchSentryIssues } from "@/lib/monitoring/sentry";
import { log } from "@/lib/logger/logger";

export async function GET(request: Request) {
  // Protect route - require 'view_monitoring' permission (ADMIN or SUPERADMIN)
  const { error } = await protectRouteWithPermission('view_monitoring');
  if (error) return error;

  try {
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const status = (searchParams.get("status") as "resolved" | "unresolved" | "ignored") || "unresolved";
    const query = searchParams.get("query") || "";
    
    // Fetch Sentry issues
    const issues = await fetchSentryIssues({
      limit,
      status,
      query,
    });
    
    log.info("Sentry errors fetched", {
      context: "MonitoringErrors",
      metadata: {
        total: issues.total,
        status,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: issues,
      timestamp: new Date(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, timestamp: new Date() },
        { status: 403 }
      );
    }
    
    log.error("Monitoring errors API error", {
      context: "MonitoringErrors",
      error: error as Error,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}
