/**
 * Health Check API Route
 * GET /api/health
 * 
 * Returns the health status of all system services
 * Accessible to superadmins only
 */

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/auth/rbac";
import { db } from "@/lib/db/drizzle";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { SystemHealth, ServiceHealth, ServiceStatus } from "@/lib/monitoring/types";
import { log } from "@/lib/logger/logger";

// ============================================================================
// Service Health Checkers
// ============================================================================

async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Simple query to check database connectivity
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - startTime;
    
    return {
      status: latency < 100 ? "healthy" : "degraded",
      latency,
      message: latency < 100 ? "Database responding normally" : "Database responding slowly",
      lastChecked: new Date(),
      details: {
        connectionPool: "active",
      },
    };
  } catch (error) {
    log.error("Database health check failed", {
      context: "HealthCheck",
      error: error as Error,
    });
    
    return {
      status: "down",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Database connection failed",
      lastChecked: new Date(),
    };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Ping Redis
    await redis.ping();
    
    const latency = Date.now() - startTime;
    
    return {
      status: latency < 50 ? "healthy" : "degraded",
      latency,
      message: latency < 50 ? "Redis responding normally" : "Redis responding slowly",
      lastChecked: new Date(),
      details: {
        connected: redis.status === "ready",
      },
    };
  } catch (error) {
    log.error("Redis health check failed", {
      context: "HealthCheck",
      error: error as Error,
    });
    
    return {
      status: "down",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Redis connection failed",
      lastChecked: new Date(),
    };
  }
}

async function checkGraphApi(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Check if Graph API credentials are configured
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;
    
    if (!tenantId || !clientId || !clientSecret) {
      return {
        status: "unknown",
        message: "Microsoft Entra ID credentials not configured",
        lastChecked: new Date(),
      };
    }
    
    // Create credential and client
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken("https://graph.microsoft.com/.default");
          return token.token;
        },
      },
    });
    
    // Simple API call to check connectivity
    await client.api("/organization").select("id,displayName").top(1).get();
    
    const latency = Date.now() - startTime;
    
    return {
      status: latency < 500 ? "healthy" : "degraded",
      latency,
      message: latency < 500 ? "Graph API responding normally" : "Graph API responding slowly",
      lastChecked: new Date(),
      details: {
        endpoint: "https://graph.microsoft.com/v1.0",
      },
    };
  } catch (error) {
    log.error("Graph API health check failed", {
      context: "HealthCheck",
      error: error as Error,
    });
    
    return {
      status: "down",
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : "Graph API connection failed",
      lastChecked: new Date(),
    };
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET() {
  try {
    // Check authorization
    await requireSuperadmin();
    
    // Run all health checks in parallel
    const [database, redis, graphApi] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkGraphApi(),
    ]);
    
    // Determine overall status
    let overall: ServiceStatus = "healthy";
    
    if (
      database.status === "down" ||
      redis.status === "down" ||
      graphApi.status === "down"
    ) {
      overall = "down";
    } else if (
      database.status === "degraded" ||
      redis.status === "degraded" ||
      graphApi.status === "degraded"
    ) {
      overall = "degraded";
    }
    
    const health: SystemHealth = {
      overall,
      services: {
        database,
        redis,
        graphApi,
      },
      timestamp: new Date(),
    };
    
    log.info("Health check completed", {
      context: "HealthCheck",
      metadata: {
        overall,
        database: database.status,
        redis: redis.status,
        graphApi: graphApi.status,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json(
        { success: false, error: error.message, timestamp: new Date() },
        { status: 403 }
      );
    }
    
    log.error("Health check route error", {
      context: "HealthCheck",
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
