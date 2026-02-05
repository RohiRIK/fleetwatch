/**
 * Integration Service
 * 
 * Manages third-party integrations and API keys.
 */

import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface Integration {
  id: string;
  name: string;
  type: 'siem';
  apiKeyHash: string;
  salt: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsed?: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export class IntegrationService {
  constructor(private client: Client) {}

  /**
   * Generate a new API key and store its hash with a unique salt.
   */
  async createSIEMIntegration(name: string, createdBy: string): Promise<{ integration: Integration; cleartextKey: string }> {
    const id = uuidv4();
    const cleartextKey = `di_${randomBytes(24).toString('hex')}`; // Prefix with di_ for device inventory
    const salt = randomBytes(16).toString('hex');
    const apiKeyHash = this.hashKey(cleartextKey, salt);
    const keyPrefix = cleartextKey.substring(0, 7); // First 7 chars including di_
    const now = Date.now();

    const integration: Integration = {
      id,
      name,
      type: 'siem',
      apiKeyHash,
      salt,
      keyPrefix,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy
    };

    await this.client.index({
      index: INDICES.INTEGRATIONS,
      id,
      body: integration,
      refresh: true
    });

    return { integration, cleartextKey };
  }

  /**
   * Validate an API key by searching for its prefix and then verifying the salted hash.
   */
  async validateKey(cleartextKey: string): Promise<Integration | null> {
    if (!cleartextKey || cleartextKey.length < 10) return null;
    
    const keyPrefix = cleartextKey.substring(0, 7);

    const response = await this.client.search({
      index: INDICES.INTEGRATIONS,
      body: {
        query: {
          bool: {
            must: [
              { term: { keyPrefix } },
              { term: { isActive: true } }
            ]
          }
        }
      }
    });

    if (response.body.hits.total.value === 0) {
      return null;
    }

    // There might be multiple integrations with the same prefix (unlikely but possible)
    // We check each one
    for (const hit of response.body.hits.hits) {
      const integration = hit._source as Integration;
      
      const inputHash = this.hashKey(cleartextKey, integration.salt);
      
      // Use timingSafeEqual to prevent timing attacks
      const match = timingSafeEqual(
        Buffer.from(integration.apiKeyHash, 'hex'),
        Buffer.from(inputHash, 'hex')
      );

      if (match) {
        // Update last used timestamp (background async)
        this.updateLastUsed(integration.id).catch(err => 
          console.error(`[IntegrationService] Failed to update lastUsed for ${integration.id}:`, err)
        );
        return integration;
      }
    }

    return null;
  }

  /**
   * List all integrations
   */
  async listIntegrations(): Promise<Integration[]> {
    const response = await this.client.search({
      index: INDICES.INTEGRATIONS,
      body: {
        query: { match_all: {} },
        sort: [{ createdAt: 'desc' }]
      }
    });

    return response.body.hits.hits.map((h: any) => h._source);
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id: string): Promise<void> {
    await this.client.delete({
      index: INDICES.INTEGRATIONS,
      id,
      refresh: true
    });
  }

  /**
   * Toggle integration status
   */
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.client.update({
      index: INDICES.INTEGRATIONS,
      id,
      body: {
        doc: {
          isActive,
          updatedAt: Date.now()
        }
      },
      refresh: true
    });
  }

  private hashKey(key: string, salt: string): string {
    // Using scrypt for salted hashing (CPU/Memory intensive to slow down brute force)
    return scryptSync(key, salt, 32).toString('hex');
  }

  private async updateLastUsed(id: string): Promise<void> {
    await this.client.update({
      index: INDICES.INTEGRATIONS,
      id,
      body: {
        doc: {
          lastUsed: Date.now()
        }
      }
    });
  }
}

// Singleton placeholder
export let integrationService: IntegrationService;

export function initializeIntegrationService(client: Client) {
  integrationService = new IntegrationService(client);
  return integrationService;
}
