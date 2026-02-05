import { redisSessionService } from './redis-session.service';
import type { CoreMessage } from '../types/ai.types';

/**
 * Service for managing per-user chat history in Redis.
 * Supports rolling buffers (max 100) and 7-day TTL.
 */
export class ChatHistoryService {
  private readonly KEY_PREFIX = 'chat:';
  private readonly MAX_MESSAGES = 100;
  private readonly TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(private redisClient?: any) {}

  /**
   * Get the Redis client, falling back to the session service.
   */
  private getClient() {
    return this.redisClient || redisSessionService.getClient();
  }

  /**
   * Get the Redis key for a specific user and tenant.
   */
  private getHistoryKey(tenantId: string, userId: string): string {
    return `${this.KEY_PREFIX}${tenantId}:${userId}`;
  }

  /**
   * Save a message to the user's history.
   * Serializes the message to JSON and appends to a Redis list.
   */
  async saveMessage(tenantId: string, userId: string, message: CoreMessage): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;

    const key = this.getHistoryKey(tenantId, userId);
    const serialized = JSON.stringify(message);

    // Atomic: push, trim, and update expiry
    await redis
      .multi()
      .rpush(key, serialized)
      .ltrim(key, -this.MAX_MESSAGES, -1)
      .expire(key, this.TTL_SECONDS)
      .exec();
  }

  /**
   * Retrieve the complete chat history for a user.
   */
  async getHistory(tenantId: string, userId: string): Promise<CoreMessage[]> {
    const redis = this.getClient();
    if (!redis) return [];

    const key = this.getHistoryKey(tenantId, userId);
    const rawMessages = await redis.lrange(key, 0, -1);

    return rawMessages.map((raw: string) => JSON.parse(raw) as CoreMessage);
  }

  /**
   * Retrieve a sliding window of the most recent messages.
   */
  async getSlidingWindow(tenantId: string, userId: string, count: number = 20): Promise<CoreMessage[]> {
    const redis = this.getClient();
    if (!redis) return [];

    const key = this.getHistoryKey(tenantId, userId);
    const rawMessages = await redis.lrange(key, -count, -1);

    return rawMessages.map((raw: string) => JSON.parse(raw) as CoreMessage);
  }

  /**
   * Clear all chat history for a user.
   */
  async clearHistory(tenantId: string, userId: string): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;

    const key = this.getHistoryKey(tenantId, userId);
    await redis.del(key);
  }
}

export const chatHistoryService = new ChatHistoryService();
