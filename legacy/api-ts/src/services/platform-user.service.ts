/**
 * Platform User Service
 * 
 * Manages users with login access to the platform.
 * Stores user metadata and roles in OpenSearch.
 */

import type { Client } from '@opensearch-project/opensearch';
import { INDICES } from '../config/opensearch';

export interface PlatformUser {
  id: string;
  email: string;
  displayName: string;
  upn: string;
  tenantId: string;
  source: 'local' | 'sso';
  role: 'admin' | 'viewer' | 'analyst';
  isActive: boolean;
  lastLogin?: number;
  createdAt: number;
  updatedAt: number;
}

export class PlatformUserService {
  constructor(private client: Client) {}

  /**
   * Sync an SSO user to the platform users index
   */
  async syncSSOUser(user: {
    id: string;
    email: string;
    displayName: string;
    upn: string;
    tenantId: string;
  }): Promise<void> {
    const now = Date.now();
    
    // Check if user exists
    let existing = await this.getUserById(user.id);

    if (existing) {
      // Update last login
      await this.client.update({
        index: INDICES.PLATFORM_USERS,
        id: user.id,
        body: {
          doc: {
            lastLogin: now,
            updatedAt: now,
            displayName: user.displayName, // Update just in case it changed in Azure
            email: user.email
          }
        }
      });
    } else {
      // Create new platform user
      // If this is the first user, make them admin
      const totalUsers = await this.countUsers();
      const role = totalUsers === 0 ? 'admin' : 'viewer';

      const newUser: PlatformUser = {
        ...user,
        source: 'sso',
        role: role as any,
        isActive: true,
        lastLogin: now,
        createdAt: now,
        updatedAt: now
      };

      await this.client.index({
        index: INDICES.PLATFORM_USERS,
        id: user.id,
        body: newUser,
        refresh: true
      });
    }
  }

  /**
   * Get platform user by ID
   */
  async getUserById(id: string): Promise<PlatformUser | null> {
    try {
      const response = await this.client.get({
        index: INDICES.PLATFORM_USERS,
        id
      });
      return response.body._source as PlatformUser;
    } catch (e) {
      return null;
    }
  }

  /**
   * List all platform users
   */
  async listUsers(query: any = {}): Promise<PlatformUser[]> {
    const response = await this.client.search({
      index: INDICES.PLATFORM_USERS,
      body: {
        query: query.search ? {
          multi_match: {
            query: query.search,
            fields: ['displayName', 'email', 'upn']
          }
        } : { match_all: {} },
        sort: [{ createdAt: 'desc' }],
        size: 1000
      }
    });

    return response.body.hits.hits.map((h: any) => h._source);
  }

  /**
   * Count total platform users
   */
  async countUsers(): Promise<number> {
    try {
      const response = await this.client.count({
        index: INDICES.PLATFORM_USERS
      });
      return response.body.count;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Update user role
   */
  async updateRole(id: string, role: string): Promise<void> {
    await this.client.update({
      index: INDICES.PLATFORM_USERS,
      id,
      body: {
        doc: {
          role,
          updatedAt: Date.now()
        }
      },
      refresh: true
    });
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    await this.client.delete({
      index: INDICES.PLATFORM_USERS,
      id,
      refresh: true
    });
  }
}

// Singleton placeholder (will be initialized in index.ts)
export let platformUserService: PlatformUserService;

export function initializePlatformUserService(client: Client) {
  platformUserService = new PlatformUserService(client);
  return platformUserService;
}
