/**
 * Local User Service
 *
 * Manages local user accounts stored in Redis as a backup
 * authentication method when Microsoft SSO is unavailable.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import type {
  LocalUser,
  LocalUserPublic,
  CreateLocalUserInput,
  LocalAuthResult,
  PasswordValidationResult,
  LocalUserConfig,
  LOCAL_USER_KEYS,
} from '../types/local-user.types';

export class LocalUserService {
  private redis: Redis | null = null;
  private readonly USER_PREFIX = 'local_user:';
  private readonly EMAIL_INDEX_PREFIX = 'local_user:email:';
  private isConnected = false;
  private config: LocalUserConfig;

  constructor() {
    this.config = {
      minPasswordLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      enabled: process.env.LOCAL_AUTH_ENABLED !== 'false',
    };
  }

  /**
   * Initialize Redis connection (can reuse existing connection)
   */
  async initialize(existingRedis?: Redis): Promise<void> {
    if (existingRedis) {
      this.redis = existingRedis;
      this.isConnected = true;
      console.log('[LocalUser] Using existing Redis connection');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('[LocalUser] Max retries reached');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('[LocalUser] Connected to Redis');
      });

      this.redis.on('error', (err) => {
        console.error('[LocalUser] Redis error:', err.message);
        this.isConnected = false;
      });

      await this.redis.connect();
    } catch (error) {
      console.error('[LocalUser] Failed to connect:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null && this.config.enabled;
  }

  /**
   * Check if local auth is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < this.config.minPasswordLength) {
      errors.push(`Password must be at least ${this.config.minPasswordLength} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verify a password against a hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Convert LocalUser to LocalUserPublic (remove sensitive fields)
   */
  private toPublic(user: LocalUser): LocalUserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  /**
   * Create a new local user
   */
  async createUser(input: CreateLocalUserInput): Promise<LocalUserPublic> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    // Validate password
    const passwordValidation = this.validatePassword(input.password);
    if (!passwordValidation.valid) {
      throw new Error(`Invalid password: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if email already exists
    const existingId = await this.redis.get(this.EMAIL_INDEX_PREFIX + input.email.toLowerCase());
    if (existingId) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const userId = uuidv4();
    const now = Date.now();
    const passwordHash = await this.hashPassword(input.password);

    const user: LocalUser = {
      id: userId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash,
      role: input.role,
      createdAt: now,
      isActive: true,
    };

    // Store user
    const userKey = this.USER_PREFIX + userId;
    await this.redis.set(userKey, JSON.stringify(user));

    // Create email index
    await this.redis.set(this.EMAIL_INDEX_PREFIX + user.email, userId);

    console.log(`[LocalUser] Created user ${user.email} (${userId}) with role ${user.role}`);
    return this.toPublic(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<LocalUserPublic | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      return null;
    }

    const user = JSON.parse(data) as LocalUser;
    return this.toPublic(user);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<LocalUserPublic | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const userId = await this.redis.get(this.EMAIL_INDEX_PREFIX + email.toLowerCase());
    if (!userId) {
      return null;
    }

    return this.getUserById(userId);
  }

  /**
   * Get full user (with password hash) - internal use only
   */
  private async getFullUser(email: string): Promise<LocalUser | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const userId = await this.redis.get(this.EMAIL_INDEX_PREFIX + email.toLowerCase());
    if (!userId) {
      return null;
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as LocalUser;
  }

  /**
   * Validate credentials and return user if valid
   */
  async validateCredentials(email: string, password: string): Promise<LocalAuthResult> {
    if (!this.redis || !this.isConnected) {
      return { success: false, error: 'Service unavailable' };
    }

    const user = await this.getFullUser(email);
    if (!user) {
      // Don't reveal if email exists
      return { success: false, error: 'Invalid credentials' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Account is disabled' };
    }

    const passwordValid = await this.verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Update last login
    await this.updateLastLogin(user.id);

    return {
      success: true,
      user: this.toPublic(user),
    };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      return;
    }

    const user = JSON.parse(data) as LocalUser;
    user.lastLogin = Date.now();

    await this.redis.set(this.USER_PREFIX + userId, JSON.stringify(user));
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    // Validate new password
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(`Invalid password: ${passwordValidation.errors.join(', ')}`);
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      throw new Error('User not found');
    }

    const user = JSON.parse(data) as LocalUser;
    user.passwordHash = await this.hashPassword(newPassword);

    await this.redis.set(this.USER_PREFIX + userId, JSON.stringify(user));
    console.log(`[LocalUser] Updated password for user ${userId}`);
  }

  /**
   * Update user details (not password)
   */
  async updateUser(
    userId: string,
    updates: Partial<Pick<LocalUser, 'displayName' | 'role' | 'isActive'>>
  ): Promise<LocalUserPublic> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      throw new Error('User not found');
    }

    const user = JSON.parse(data) as LocalUser;
    Object.assign(user, updates);

    await this.redis.set(this.USER_PREFIX + userId, JSON.stringify(user));
    console.log(`[LocalUser] Updated user ${userId}`);

    return this.toPublic(user);
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    const data = await this.redis.get(this.USER_PREFIX + userId);
    if (!data) {
      return;
    }

    const user = JSON.parse(data) as LocalUser;

    // Delete user and email index
    await this.redis.del(this.USER_PREFIX + userId);
    await this.redis.del(this.EMAIL_INDEX_PREFIX + user.email);

    console.log(`[LocalUser] Deleted user ${user.email} (${userId})`);
  }

  /**
   * List all users (for admin)
   */
  async listUsers(): Promise<LocalUserPublic[]> {
    if (!this.redis || !this.isConnected) {
      return [];
    }

    const keys = await this.redis.keys(this.USER_PREFIX + '*');
    const users: LocalUserPublic[] = [];

    for (const key of keys) {
      // Skip email index keys
      if (key.includes(':email:')) continue;

      const data = await this.redis.get(key);
      if (data) {
        const user = JSON.parse(data) as LocalUser;
        users.push(this.toPublic(user));
      }
    }

    // Sort by creation date (newest first)
    return users.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Count total users
   */
  async countUsers(): Promise<number> {
    if (!this.redis || !this.isConnected) {
      return 0;
    }

    const keys = await this.redis.keys(this.USER_PREFIX + '*');
    // Filter out email index keys
    return keys.filter((k) => !k.includes(':email:')).length;
  }

  /**
   * Check if any admin user exists
   */
  async hasAnyAdmin(): Promise<boolean> {
    const users = await this.listUsers();
    return users.some((u) => u.role === 'admin' && u.isActive);
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      console.log('[LocalUser] Connection closed');
    }
  }
}

// Export singleton instance
export const localUserService = new LocalUserService();
