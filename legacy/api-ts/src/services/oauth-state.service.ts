/**
 * OAuth State Management Service
 *
 * Manages OAuth state tokens for CSRF protection during Azure App Registration flow.
 * Stores state tokens in memory with TTL (10 minutes).
 */

import crypto from 'crypto';

interface StateEntry {
  state: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export class OAuthStateManager {
  private states: Map<string, StateEntry>;
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.states = new Map();

    // Clean up expired states every minute
    setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);
  }

  /**
   * Generate new state token for OAuth flow
   *
   * @param metadata - Optional metadata to store with state
   * @returns State token (64-char hex string)
   */
  generateState(metadata?: Record<string, any>): string {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const entry: StateEntry = {
      state,
      createdAt: now,
      expiresAt: now + this.TTL_MS,
      metadata
    };

    this.states.set(state, entry);

    return state;
  }

  /**
   * Validate state token
   *
   * @param state - State token to validate
   * @returns True if valid and not expired, false otherwise
   */
  validateState(state: string): boolean {
    const entry = this.states.get(state);

    if (!entry) {
      return false; // State not found
    }

    if (Date.now() > entry.expiresAt) {
      this.states.delete(state);
      return false; // Expired
    }

    return true;
  }

  /**
   * Consume state token (one-time use)
   *
   * @param state - State token to consume
   * @returns Metadata if valid, null if invalid/expired
   */
  consumeState(state: string): Record<string, any> | null {
    const entry = this.states.get(state);

    if (!entry) {
      return null; // State not found
    }

    if (Date.now() > entry.expiresAt) {
      this.states.delete(state);
      return null; // Expired
    }

    // Remove state (one-time use)
    this.states.delete(state);

    return entry.metadata || {};
  }

  /**
   * Clean up expired states
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [state, entry] of this.states.entries()) {
      if (now > entry.expiresAt) {
        this.states.delete(state);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[OAuthStateManager] Cleaned up ${cleanedCount} expired states`);
    }
  }

  /**
   * Get current state count (for monitoring)
   */
  getStateCount(): number {
    return this.states.size;
  }

  /**
   * Clear all states (for testing)
   */
  clearAll(): void {
    this.states.clear();
  }
}

// Export singleton instance
export const oauthStateManager = new OAuthStateManager();
