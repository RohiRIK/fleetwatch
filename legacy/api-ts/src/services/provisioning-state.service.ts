/**
 * Provisioning State Service
 *
 * Manages provisioning session state in Redis for tracking
 * auto-provisioning progress and enabling rollback on failure.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type {
  ProvisioningState,
  ProvisioningStatus,
  CreatedResource,
  ProvisioningError,
  ProvisioningProgress,
  PROVISIONING_KEYS,
  PROVISIONING_STATE_TTL,
  PROVISIONING_STEPS,
} from '../types/provisioning.types';

export class ProvisioningStateService {
  private redis: Redis | null = null;
  private readonly STATE_PREFIX = 'provisioning:';
  private readonly STATE_TTL = 3600; // 1 hour
  private isConnected = false;

  constructor() {}

  /**
   * Initialize Redis connection (reuses existing connection if available)
   */
  async initialize(existingRedis?: Redis): Promise<void> {
    if (existingRedis) {
      this.redis = existingRedis;
      this.isConnected = true;
      console.log('[ProvisioningState] Using existing Redis connection');
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('[ProvisioningState] Max retries reached');
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('[ProvisioningState] Connected to Redis');
      });

      this.redis.on('error', (err) => {
        console.error('[ProvisioningState] Redis error:', err.message);
        this.isConnected = false;
      });

      await this.redis.connect();
    } catch (error) {
      console.error('[ProvisioningState] Failed to connect:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Create a new provisioning session
   */
  async createState(): Promise<string> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const provisioningId = uuidv4();
    const now = Date.now();

    const state: ProvisioningState = {
      provisioningId,
      status: 'pending',
      startedAt: now,
      updatedAt: now,
      currentStep: '',
      completedSteps: [],
      createdResources: [],
    };

    const key = this.STATE_PREFIX + provisioningId;
    await this.redis.setex(key, this.STATE_TTL, JSON.stringify(state));

    console.log(`[ProvisioningState] Created session ${provisioningId}`);
    return provisioningId;
  }

  /**
   * Get provisioning state by ID
   */
  async getState(provisioningId: string): Promise<ProvisioningState | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const key = this.STATE_PREFIX + provisioningId;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as ProvisioningState;
  }

  /**
   * Update provisioning state
   */
  async updateState(
    provisioningId: string,
    updates: Partial<ProvisioningState>
  ): Promise<ProvisioningState | null> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const state = await this.getState(provisioningId);
    if (!state) {
      throw new Error(`Provisioning session ${provisioningId} not found`);
    }

    const updatedState: ProvisioningState = {
      ...state,
      ...updates,
      updatedAt: Date.now(),
    };

    const key = this.STATE_PREFIX + provisioningId;
    await this.redis.setex(key, this.STATE_TTL, JSON.stringify(updatedState));

    return updatedState;
  }

  /**
   * Set provisioning status
   */
  async setStatus(
    provisioningId: string,
    status: ProvisioningStatus
  ): Promise<void> {
    const updates: Partial<ProvisioningState> = { status };

    if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
      updates.completedAt = Date.now();
    }

    await this.updateState(provisioningId, updates);
    console.log(`[ProvisioningState] ${provisioningId} status: ${status}`);
  }

  /**
   * Store authentication details
   */
  async setAuthDetails(
    provisioningId: string,
    tenantId: string,
    adminEmail: string,
    accessToken: string
  ): Promise<void> {
    await this.updateState(provisioningId, {
      status: 'authenticated',
      tenantId,
      adminEmail,
      accessToken,
    });
    console.log(`[ProvisioningState] ${provisioningId} authenticated as ${adminEmail}`);
  }

  /**
   * Update provisioning step with status and message
   */
  async updateStep(
    provisioningId: string,
    stepUpdate: {
      step: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      message?: string;
    }
  ): Promise<void> {
    const state = await this.getState(provisioningId);
    if (!state) {
      throw new Error(`Provisioning session ${provisioningId} not found`);
    }

    const updates: Partial<ProvisioningState> = {
      currentStep: stepUpdate.step,
    };

    // If step is completed, add to completedSteps
    if (stepUpdate.status === 'completed') {
      const completedSteps = [...state.completedSteps];
      if (!completedSteps.includes(stepUpdate.step)) {
        completedSteps.push(stepUpdate.step);
      }
      updates.completedSteps = completedSteps;
    }

    // Update overall status if needed
    if (stepUpdate.status === 'failed') {
      updates.status = 'failed';
    } else if (stepUpdate.step === 'completed' && stepUpdate.status === 'completed') {
      updates.status = 'completed';
    } else if (stepUpdate.status === 'in_progress' && state.status === 'pending') {
      updates.status = 'in_progress';
    }

    await this.updateState(provisioningId, updates);

    console.log(
      `[ProvisioningState] ${provisioningId} step: ${stepUpdate.step} (${stepUpdate.status})${stepUpdate.message ? ' - ' + stepUpdate.message : ''}`
    );
  }

  /**
   * Advance to next step
   */
  async advanceStep(provisioningId: string, stepId: string): Promise<void> {
    const state = await this.getState(provisioningId);
    if (!state) {
      throw new Error(`Provisioning session ${provisioningId} not found`);
    }

    const completedSteps = [...state.completedSteps];
    if (state.currentStep && !completedSteps.includes(state.currentStep)) {
      completedSteps.push(state.currentStep);
    }

    await this.updateState(provisioningId, {
      currentStep: stepId,
      completedSteps,
    });

    console.log(`[ProvisioningState] ${provisioningId} step: ${stepId}`);
  }

  /**
   * Mark current step as completed
   */
  async completeCurrentStep(provisioningId: string): Promise<void> {
    const state = await this.getState(provisioningId);
    if (!state) {
      throw new Error(`Provisioning session ${provisioningId} not found`);
    }

    const completedSteps = [...state.completedSteps];
    if (state.currentStep && !completedSteps.includes(state.currentStep)) {
      completedSteps.push(state.currentStep);
    }

    await this.updateState(provisioningId, { completedSteps });
  }

  /**
   * Add a created resource (for rollback tracking)
   */
  async addCreatedResource(
    provisioningId: string,
    resource: CreatedResource
  ): Promise<void> {
    const state = await this.getState(provisioningId);
    if (!state) {
      throw new Error(`Provisioning session ${provisioningId} not found`);
    }

    const createdResources = [...state.createdResources, resource];
    await this.updateState(provisioningId, { createdResources });

    console.log(
      `[ProvisioningState] ${provisioningId} created resource: ${resource.type}:${resource.name}`
    );
  }

  /**
   * Set error state (accepts either ProvisioningError object or string message)
   */
  async setError(
    provisioningId: string,
    error: ProvisioningError | string
  ): Promise<void> {
    const errorObj: ProvisioningError =
      typeof error === 'string'
        ? {
            step: 'unknown',
            message: error,
            rollbackStatus: 'pending',
            rollbackDetails: [],
          }
        : error;

    await this.updateState(provisioningId, {
      status: 'failed',
      error: errorObj,
      completedAt: Date.now(),
    });

    console.error(
      `[ProvisioningState] ${provisioningId} failed at ${errorObj.step}: ${errorObj.message}`
    );
  }

  /**
   * Store device code temporarily for polling
   */
  async setDeviceCode(
    provisioningId: string,
    deviceCode: string,
    expiresIn: number
  ): Promise<void> {
    if (!this.redis || !this.isConnected) {
      throw new Error('Redis not available');
    }

    const key = `${this.STATE_PREFIX}${provisioningId}:device_code`;
    await this.redis.setex(key, expiresIn, deviceCode);
    console.log(`[ProvisioningState] Stored device code for ${provisioningId}`);
  }

  /**
   * Get stored device code
   */
  async getDeviceCode(provisioningId: string): Promise<string | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    const key = `${this.STATE_PREFIX}${provisioningId}:device_code`;
    return await this.redis.get(key);
  }

  /**
   * Store access token temporarily
   */
  async setAccessToken(
    provisioningId: string,
    accessToken: string,
    expiresIn: number
  ): Promise<void> {
    await this.updateState(provisioningId, { accessToken });
    console.log(`[ProvisioningState] Stored access token for ${provisioningId}`);
  }

  /**
   * Get stored access token
   */
  async getAccessToken(provisioningId: string): Promise<string | null> {
    const state = await this.getState(provisioningId);
    if (!state) {
      return null;
    }
    return state.accessToken || null;
  }

  /**
   * Get progress summary
   */
  async getProgress(provisioningId: string): Promise<ProvisioningProgress | null> {
    const state = await this.getState(provisioningId);
    if (!state) {
      return null;
    }

    const STEPS = [
      'authenticate',
      'create_fetcher_app',
      'create_sso_app',
      'generate_secrets',
      'generate_certificate',
      'upload_certificate',
      'grant_fetcher_permissions',
      'grant_sso_permissions',
      'create_admin_user',
      'write_configuration',
      'verify_configuration',
    ];

    const totalSteps = STEPS.length;
    const completedCount = state.completedSteps.length;
    const percentComplete = Math.round((completedCount / totalSteps) * 100);

    return {
      currentStep: state.currentStep,
      completedSteps: state.completedSteps,
      totalSteps,
      percentComplete,
    };
  }

  /**
   * Clear access token (after use or on cleanup)
   */
  async clearAccessToken(provisioningId: string): Promise<void> {
    await this.updateState(provisioningId, { accessToken: undefined });
  }

  /**
   * Delete provisioning state
   */
  async deleteState(provisioningId: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    await this.redis.del(this.STATE_PREFIX + provisioningId);
    console.log(`[ProvisioningState] Deleted session ${provisioningId}`);
  }

  /**
   * List all active provisioning sessions (for admin)
   */
  async listActiveSessions(): Promise<ProvisioningState[]> {
    if (!this.redis || !this.isConnected) {
      return [];
    }

    const keys = await this.redis.keys(this.STATE_PREFIX + '*');
    const sessions: ProvisioningState[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const state = JSON.parse(data) as ProvisioningState;
        // Don't expose access tokens in listing
        sessions.push({
          ...state,
          accessToken: state.accessToken ? '[REDACTED]' : undefined,
        });
      }
    }

    return sessions;
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      console.log('[ProvisioningState] Connection closed');
    }
  }
}

// Export singleton instance
export const provisioningStateService = new ProvisioningStateService();
