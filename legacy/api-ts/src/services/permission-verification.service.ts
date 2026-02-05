/**
 * Permission Verification Service
 * 
 * Tests each required Microsoft Graph permission by making actual API calls.
 * Helps detect propagation delays and missing grants during onboarding.
 */

import Redis from 'ioredis';
import { microsoftGraphClient } from './microsoft-graph.service';
import { PERMISSION_TEST_ENDPOINTS } from '../config/permission-test-endpoints';

export interface PermissionTestResult {
  permission_id: string;
  permission_name: string;
  status: 'granted' | 'pending' | 'denied' | 'rate_limited' | 'error';
  tested_at: string;
  test_endpoint: string;
  error: string | null;
}

export interface PermissionReport {
  verified_at: string;
  total_permissions: number;
  granted: number;
  failed: number;
  results: PermissionTestResult[];
}

export class PermissionVerificationService {
  private redis: Redis | null = null;
  private readonly CACHE_KEY_PREFIX = 'permissions:verification:';
  private readonly CACHE_TTL = 900; // 15 minutes

  constructor(redisClient?: Redis | null) {
    if (redisClient) {
      this.redis = redisClient;
    }
  }

  /**
   * Verify all required permissions for the fetcher app
   */
  async verifyAllPermissions(): Promise<PermissionReport> {
    const clientId = process.env.CLIENT_ID;
    const tenantId = process.env.TENANT_ID;

    if (!clientId || !tenantId) {
      throw new Error('System not configured: CLIENT_ID or TENANT_ID missing');
    }

    // Check cache first (hourly rotation via timestamp)
    const hourKey = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    const cacheKey = `${this.CACHE_KEY_PREFIX}${clientId}:${hourKey}`;
    
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        console.log('[PermissionVerification] Returning cached report');
        return JSON.parse(cached);
      }
    }

    console.log('[PermissionVerification] Starting full permission verification...');
    
    // Get app-only token for the fetcher app
    // We assume the cert is available in the expected path
    const tokenResponse = await microsoftGraphClient.getAppOnlyToken();
    const accessToken = tokenResponse.access_token;

    const results: PermissionTestResult[] = [];
    
    // Test each permission endpoint
    for (const [id, config] of Object.entries(PERMISSION_TEST_ENDPOINTS)) {
      const result = await this.testPermission(id, config.name, config.endpoint, config.method, accessToken);
      results.push(result);
    }

    const report: PermissionReport = {
      verified_at: new Date().toISOString(),
      total_permissions: results.length,
      granted: results.filter(r => r.status === 'granted').length,
      failed: results.filter(r => r.status !== 'granted').length,
      results
    };

    // Store in cache
    if (this.redis) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(report));
    }

    return report;
  }

  /**
   * Test a specific permission by making a Graph API call
   */
  private async testPermission(
    id: string,
    name: string,
    endpoint: string,
    method: string,
    accessToken: string
  ): Promise<PermissionTestResult> {
    const baseUrl = 'https://graph.microsoft.com';
    const url = `${baseUrl}${endpoint}`;
    
    const result: PermissionTestResult = {
      permission_id: id,
      permission_name: name,
      status: 'error',
      tested_at: new Date().toISOString(),
      test_endpoint: `${method} ${endpoint}`,
      error: null
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ConsistencyLevel': 'eventual' // Helps with some directory/group queries
        }
      });

      if (response.ok) {
        result.status = 'granted';
      } else {
        const errorData = (await response.json().catch(() => ({}))) as any;
        const errorCode = errorData.error?.code;
        const errorMessage = errorData.error?.message;

        if (errorCode === 'Forbidden' || errorCode === 'Authorization_RequestDenied') {
          // Check if it's likely a propagation delay or a hard denial
          // "Insufficient privileges" is usually a hard denial or missing grant
          result.status = 'denied';
          result.error = errorMessage || 'Access Denied';
        } else if (response.status === 429) {
          result.status = 'rate_limited';
          result.error = 'Throttled by Microsoft Graph';
        } else {
          result.status = 'error';
          result.error = `${errorCode}: ${errorMessage}` || `HTTP ${response.status}`;
        }
      }
    } catch (err) {
      result.status = 'error';
      result.error = err instanceof Error ? err.message : 'Network error';
    }

    return result;
  }
}