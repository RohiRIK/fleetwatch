import Redis from 'ioredis';

// Redis connection
const redisUrl = process.env.REDIS_URL!;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}

// Create Redis client with retry strategy
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
});

// Redis error handling
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis ready to accept commands');
});

redis.on('close', () => {
  console.warn('⚠️  Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// ============================================================================
// Enhanced Redis Client with Metrics Tracking
// ============================================================================

/**
 * Wrapper around Redis client that tracks cache hits/misses
 */
export class RedisClientWithMetrics {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  /**
   * Get a value and record cache hit/miss
   */
  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key);
    
    // Record metrics asynchronously
    this.recordCacheMetric(value !== null).catch((error) => {
      console.error('[Redis] Failed to record cache metric:', error);
    });
    
    return value;
  }

  /**
   * Set a value
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return await this.client.setex(key, ttl, value);
    }
    return await this.client.set(key, value);
  }

  /**
   * Delete a key
   */
  async del(...keys: string[]): Promise<number> {
    return await this.client.del(...keys);
  }

  /**
   * Check if key exists
   */
  async exists(...keys: string[]): Promise<number> {
    return await this.client.exists(...keys);
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Expose original client for direct access
   */
  get raw(): Redis {
    return this.client;
  }

  /**
   * Record cache hit/miss metric
   */
  private async recordCacheMetric(isHit: boolean): Promise<void> {
    try {
      // Dynamically import to avoid circular dependencies
      const { metricsCollector } = await import('@/lib/monitoring/metrics-collector');
      
      if (isHit) {
        await metricsCollector.recordCacheHit();
      } else {
        await metricsCollector.recordCacheMiss();
      }
    } catch (error) {
      // Silently fail - metrics are not critical
      // Don't log to avoid noise
    }
  }
}

// Export enhanced client
export const redisWithMetrics = new RedisClientWithMetrics(redis);

// Export Redis client
export default redis;
