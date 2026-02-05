/**
 * Redis Session Management Service
 *
 * Handles session storage, retrieval, and lifecycle management
 * using Redis as the backend store for SSO authentication.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  upn: string;
  tenantId: string;
  roles?: string[];
}

export interface Session {
  id: string;
  userId: string;
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: number;
  createdAt: number;
  lastAccessed: number;
}

export class RedisSessionService {
  private redis: Redis | null = null;
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly DEFAULT_TTL: number;
  private isConnected = false;

  constructor() {
    this.DEFAULT_TTL = parseInt(process.env.SESSION_MAX_AGE || '86400000') / 1000;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('[RedisSession] Max retries reached, giving up');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('[RedisSession] Connected to Redis');
      });

      this.redis.on('error', (err) => {
        console.error('[RedisSession] Redis error:', err.message);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        console.log('[RedisSession] Redis connection closed');
      });

      await this.redis.connect();
    } catch (error) {
      console.error('[RedisSession] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Get the underlying Redis client for sharing with other services
   */
  getClient(): Redis | null {
    return this.redis;
  }

  /**
   * Create a new session
   */
  async createSession(
    user: SessionUser,
    accessToken: string,
    refreshToken?: string,
    tokenExpiry?: number
  ): Promise<string> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const sessionId = uuidv4();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      userId: user.id,
      user,
      accessToken,
      refreshToken,
      tokenExpiry: tokenExpiry || now + this.DEFAULT_TTL * 1000,
      createdAt: now,
      lastAccessed: now,
    };

    const key = this.SESSION_PREFIX + sessionId;
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(session));

    // Track user sessions for multi-device support
    await this.redis.sadd(this.USER_SESSIONS_PREFIX + user.id, sessionId);

    console.log(`[RedisSession] Created session ${sessionId} for user ${user.email}`);
    return sessionId;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const key = this.SESSION_PREFIX + sessionId;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const session: Session = JSON.parse(data);

    // Update last accessed time
    session.lastAccessed = Date.now();
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(session));

    return session;
  }

  /**
   * Delete session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    const session = await this.getSession(sessionId);

    if (session) {
      // Remove from user sessions set
      await this.redis.srem(
        this.USER_SESSIONS_PREFIX + session.userId,
        sessionId
      );
    }

    await this.redis.del(this.SESSION_PREFIX + sessionId);
    console.log(`[RedisSession] Deleted session ${sessionId}`);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    const sessionIds = await this.redis.smembers(
      this.USER_SESSIONS_PREFIX + userId
    );

    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => this.SESSION_PREFIX + id);
      await this.redis.del(...keys);
      await this.redis.del(this.USER_SESSIONS_PREFIX + userId);
      console.log(`[RedisSession] Deleted ${sessionIds.length} sessions for user ${userId}`);
    }
  }

  /**
   * Update session tokens (for refresh)
   */
  async updateSessionTokens(
    sessionId: string,
    accessToken: string,
    refreshToken?: string,
    tokenExpiry?: number
  ): Promise<void> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    session.accessToken = accessToken;
    if (refreshToken) {
      session.refreshToken = refreshToken;
    }
    if (tokenExpiry) {
      session.tokenExpiry = tokenExpiry;
    }

    const key = this.SESSION_PREFIX + sessionId;
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(session));
  }

  /**
   * Check Redis health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session count (for monitoring)
   */
  async getSessionCount(): Promise<number> {
    if (!this.redis || !this.isConnected) {
      return 0;
    }

    const keys = await this.redis.keys(this.SESSION_PREFIX + '*');
    return keys.length;
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      console.log('[RedisSession] Connection closed');
    }
  }
}

// Export singleton instance
export const redisSessionService = new RedisSessionService();
