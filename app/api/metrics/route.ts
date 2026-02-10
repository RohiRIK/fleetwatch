/**
 * Metrics API Route
 * GET /api/metrics
 * 
 * Returns performance metrics (response times, cache stats, request stats)
 * Accessible to superadmins only
 */

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/auth/rbac";
import { metricsCollector } from "@/lib/monitoring/metrics-collector";
import { log } from "@/lib/logger/logger";

export async function GET() {
  try {
    // Check authorization
    await requireSuperadmin();
    
    // Get metrics from collector
    const metrics = await metricsCollector.getMetrics();
    
    log.info("Metrics retrieved", {
      context: "MetricsAPI",
      metadata: {
        totalRequests: metrics.requests.total,
        successRate: metrics.requests.successRate,
        avgResponseTime: metrics.responseTime.avg,
        cacheHitRate: metrics.cache.hitRate,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, timestamp: new Date() },
        { status: 403 }
      );
    }
    
    log.error("Metrics API error", {
      context: "MetricsAPI",
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
