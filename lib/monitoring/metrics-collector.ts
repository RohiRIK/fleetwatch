/**
 * Metrics Collector
 * Collects and aggregates performance metrics (response times, cache stats, request counts)
 * Supports both in-memory and Redis storage for Vercel compatibility
 */

import {
  RequestMetric,
  PerformanceMetrics,
  MetricsCollectorConfig,
} from "@/lib/monitoring/types";
import { redis } from "@/lib/redis/client";

// Conditional logger import - only available in Node.js runtime (not Edge)
// In Edge Runtime, fall back to console methods
const log =
  typeof window === "undefined" && typeof setImmediate !== "undefined"
    ? require("@/lib/logger/logger").log
    : {
        error: (message: string, options?: Record<string, unknown>) => 
          console.error(`[ERROR] ${message}`, options || {}),
        http: (message: string, options?: Record<string, unknown>) => 
          console.log(`[HTTP] ${message}`, options || {}),
        info: (message: string, options?: Record<string, unknown>) => 
          console.info(`[INFO] ${message}`, options || {}),
      };

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  enabled: true,
  storageType: process.env.VERCEL ? "redis" : "memory",
  retentionMinutes: 60, // Keep metrics for 1 hour
  maxSamples: 1000, // Maximum samples in memory
};

// ============================================================================
// In-Memory Storage
// ============================================================================

class InMemoryMetricsStore {
  private requests: RequestMetric[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private maxSamples: number;

  constructor(maxSamples = 1000) {
    this.maxSamples = maxSamples;
  }

  addRequest(metric: RequestMetric) {
    this.requests.push(metric);

    // Keep only recent samples
    if (this.requests.length > this.maxSamples) {
      this.requests.shift();
    }
  }

  recordCacheHit() {
    this.cacheHits++;
  }

  recordCacheMiss() {
    this.cacheMisses++;
  }

  getRequests(minutes: number): RequestMetric[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.requests.filter((r) => r.timestamp >= cutoff);
  }

  getCacheStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  clear() {
    this.requests = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// Singleton instance
const memoryStore = new InMemoryMetricsStore(DEFAULT_CONFIG.maxSamples);

// ============================================================================
// Redis Storage Functions
// ============================================================================

const REDIS_KEYS = {
  requests: "metrics:requests",
  cacheHits: "metrics:cache:hits",
  cacheMisses: "metrics:cache:misses",
};

async function addRequestToRedis(metric: RequestMetric): Promise<void> {
  if (!redis) return;
  
  try {
    const ttl = DEFAULT_CONFIG.retentionMinutes * 60; // Convert to seconds

    // Store as sorted set with timestamp as score
    await redis.zadd(
      REDIS_KEYS.requests,
      metric.timestamp.getTime(),
      JSON.stringify(metric)
    );

    // Set expiry on the key
    await redis.expire(REDIS_KEYS.requests, ttl);

    // Trim old entries
    const cutoff = Date.now() - DEFAULT_CONFIG.retentionMinutes * 60 * 1000;
    await redis.zremrangebyscore(REDIS_KEYS.requests, "-inf", cutoff);
  } catch (error) {
    try {
      log.error("Failed to store request metric in Redis", {
        context: "MetricsCollector",
        error: error as Error,
      });
    } catch {
      console.error("Failed to store request metric in Redis", error);
    }
  }
}

async function getRequestsFromRedis(minutes: number): Promise<RequestMetric[]> {
  if (!redis) return [];
  
  try {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const records = await redis.zrangebyscore(
      REDIS_KEYS.requests,
      cutoff,
      "+inf"
    );

    return records.map((r) => {
      const parsed = JSON.parse(r);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  } catch (error) {
    log.error("Failed to fetch request metrics from Redis", {
      context: "MetricsCollector",
      error: error as Error,
    });
    return [];
  }
}

async function recordCacheHitInRedis(): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.incr(REDIS_KEYS.cacheHits);
  } catch (error) {
    log.error("Failed to record cache hit in Redis", {
      context: "MetricsCollector",
      error: error as Error,
    });
  }
}

async function recordCacheMissInRedis(): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.incr(REDIS_KEYS.cacheMisses);
  } catch (error) {
    log.error("Failed to record cache miss in Redis", {
      context: "MetricsCollector",
      error: error as Error,
    });
  }
}

async function getCacheStatsFromRedis(): Promise<{ hits: number; misses: number }> {
  if (!redis) return { hits: 0, misses: 0 };
  
  try {
    const [hits, misses] = await Promise.all([
      redis.get(REDIS_KEYS.cacheHits),
      redis.get(REDIS_KEYS.cacheMisses),
    ]);

    return {
      hits: parseInt(hits || "0", 10),
      misses: parseInt(misses || "0", 10),
    };
  } catch (error) {
    log.error("Failed to fetch cache stats from Redis", {
      context: "MetricsCollector",
      error: error as Error,
    });
    return { hits: 0, misses: 0 };
  }
}

// ============================================================================
// Metrics Collector Class
// ============================================================================

class MetricsCollector {
  private config: MetricsCollectorConfig;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a request metric
   */
  async recordRequest(metric: RequestMetric): Promise<void> {
    if (!this.config.enabled) return;

    if (this.config.storageType === "redis") {
      await addRequestToRedis(metric);
    } else {
      memoryStore.addRequest(metric);
    }

    // Safe logging - with debug output to trace failures
    try {
      console.log('[DEBUG MetricsCollector] Attempting to log HTTP request:', {
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode,
        duration: metric.duration
      });
      
      log.http(`${metric.method} ${metric.path} - ${metric.statusCode} (${metric.duration}ms)`, {
        context: "MetricsCollector",
        metadata: {
          duration: metric.duration,
          statusCode: metric.statusCode,
          userId: metric.userId,
        },
      });
      
      console.log('[DEBUG MetricsCollector] HTTP log successful');
    } catch (error) {
      console.error('[ERROR MetricsCollector] Failed to log HTTP request:', error);
    }
  }

  /**
   * Record a cache hit
   */
  async recordCacheHit(): Promise<void> {
    if (!this.config.enabled) return;

    if (this.config.storageType === "redis") {
      await recordCacheHitInRedis();
    } else {
      memoryStore.recordCacheHit();
    }
  }

  /**
   * Record a cache miss
   */
  async recordCacheMiss(): Promise<void> {
    if (!this.config.enabled) return;

    if (this.config.storageType === "redis") {
      await recordCacheMissInRedis();
    } else {
      memoryStore.recordCacheMiss();
    }
  }

  /**
   * Calculate performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const requests =
      this.config.storageType === "redis"
        ? await getRequestsFromRedis(this.config.retentionMinutes)
        : memoryStore.getRequests(this.config.retentionMinutes);

    const cacheStats =
      this.config.storageType === "redis"
        ? await getCacheStatsFromRedis()
        : memoryStore.getCacheStats();

    // Calculate response time percentiles
    const durations = requests.map((r) => r.duration).sort((a, b) => a - b);
    const total = durations.length;

    const p50 = total > 0 ? durations[Math.floor(total * 0.5)] : 0;
    const p95 = total > 0 ? durations[Math.floor(total * 0.95)] : 0;
    const p99 = total > 0 ? durations[Math.floor(total * 0.99)] : 0;
    const avg = total > 0 ? durations.reduce((a, b) => a + b, 0) / total : 0;
    const min = total > 0 ? durations[0] : 0;
    const max = total > 0 ? durations[total - 1] : 0;

    // Calculate request stats
    const successful = requests.filter(
      (r) => r.statusCode >= 200 && r.statusCode < 400
    ).length;
    const failed = requests.filter((r) => r.statusCode >= 400).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Calculate cache stats
    const totalCacheRequests = cacheStats.hits + cacheStats.misses;
    const hitRate =
      totalCacheRequests > 0
        ? (cacheStats.hits / totalCacheRequests) * 100
        : 0;
    const missRate =
      totalCacheRequests > 0
        ? (cacheStats.misses / totalCacheRequests) * 100
        : 0;

    return {
      responseTime: {
        p50,
        p95,
        p99,
        avg,
        min,
        max,
      },
      cache: {
        hitRate,
        missRate,
        totalHits: cacheStats.hits,
        totalMisses: cacheStats.misses,
      },
      requests: {
        total,
        successful,
        failed,
        successRate,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Clear all metrics
   */
  async clearMetrics(): Promise<void> {
    if (this.config.storageType === "redis") {
      if (!redis) return;
      
      try {
        await redis.del(
          REDIS_KEYS.requests,
          REDIS_KEYS.cacheHits,
          REDIS_KEYS.cacheMisses
        );
      } catch (error) {
        log.error("Failed to clear metrics from Redis", {
          context: "MetricsCollector",
          error: error as Error,
        });
      }
    } else {
      memoryStore.clear();
    }

    log.info("Metrics cleared", { context: "MetricsCollector" });
  }

  /**
   * Get configuration
   */
  getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const metricsCollector = new MetricsCollector();
export default metricsCollector;
