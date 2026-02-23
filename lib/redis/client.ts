import Redis from 'ioredis';

// Redis connection
const redisUrl = process.env.REDIS_URL;

let redisInstance: Redis | null = null;

if (redisUrl) {
  try {
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    redisInstance.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redisInstance.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisInstance.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
    });

    redisInstance.on('close', () => {
      console.warn('⚠️  Redis connection closed');
    });

    redisInstance.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  } catch (error) {
    console.warn('⚠️  Failed to initialize Redis:', error);
    redisInstance = null;
  }
} else {
  console.warn('⚠️  REDIS_URL not set - Redis features disabled');
}

// ============================================================================
// Enhanced Redis Client with Metrics Tracking
// ============================================================================

/**
 * Wrapper around Redis client that tracks cache hits/misses
 */
export class RedisClientWithMetrics {
  private client: Redis | null;

  constructor(client: Redis | null) {
    this.client = client;
  }

  /**
   * Get a value and record cache hit/miss
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    
    try {
      const value = await this.client.get(key);
      
      this.recordCacheMetric(value !== null).catch(() => {});
      
      return value;
    } catch {
      return null;
    }
  }

  /**
   * Set a value
   */
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a key
   */
  async del(...keys: string[]): Promise<number> {
    if (!this.client) return 0;
    
    try {
      return await this.client.del(...keys);
    } catch {
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(...keys: string[]): Promise<number> {
    if (!this.client) return 0;
    
    try {
      return await this.client.exists(...keys);
    } catch {
      return 0;
    }
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;
    
    try {
      return await this.client.ttl(key);
    } catch {
      return -2;
    }
  }

  /**
   * Expose original client for direct access
   */
  get raw(): Redis | null {
    return this.client;
  }

  /**
   * Record cache hit/miss metric
   */
  private async recordCacheMetric(isHit: boolean): Promise<void> {
    try {
      const { metricsCollector } = await import('@/lib/monitoring/metrics-collector');
      
      if (isHit) {
        await metricsCollector.recordCacheHit();
      } else {
        await metricsCollector.recordCacheMiss();
      }
    } catch {
      // Silently fail - metrics are not critical
    }
  }
}

// Export enhanced client
export const redisWithMetrics = new RedisClientWithMetrics(redisInstance);

// Export Redis client (may be null)
export const redis = redisInstance;

// Default export
export default redis;
