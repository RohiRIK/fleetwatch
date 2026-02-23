/**
 * App Protection Policies Tests - TDD
 * 
 * Tests for app protection policy functions in graph/client.ts
 * Phase 3: Intune Graph API Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the graph client module
const mockGet = vi.fn();
const mockApi = vi.fn(() => ({ get: mockGet }));

vi.mock('@/lib/graph/client', () => ({
  getGraphClient: vi.fn(() => ({
    api: mockApi,
  })),
}));

import { getAppProtectionPolicies, getAppProtectionPolicy } from '@/lib/graph/client';

describe('getAppProtectionPolicies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all app protection policies', async () => {
    const mockPolicies = [
      { id: 'policy-1', displayName: 'iOS Policy', platform: 'ios' },
      { id: 'policy-2', displayName: 'Android Policy', platform: 'android' },
    ];
    mockGet.mockResolvedValue({ value: mockPolicies });
    
    const result = await getAppProtectionPolicies();
    
    expect(result).toHaveLength(2);
    expect(result[0].displayName).toBe('iOS Policy');
    expect(mockApi).toHaveBeenCalledWith('/deviceAppManagement/iosManagedAppProtections');
  });

  it('should return empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('API Error'));
    
    const result = await getAppProtectionPolicies();
    
    expect(result).toHaveLength(0);
  });
});

describe('getAppProtectionPolicy', () => {
  it('should fetch single policy by ID', async () => {
    const mockPolicy = { id: 'policy-1', displayName: 'iOS Policy' };
    mockGet.mockResolvedValue(mockPolicy);
    
    const result = await getAppProtectionPolicy('policy-1');
    
    expect(result.displayName).toBe('iOS Policy');
    expect(mockApi).toHaveBeenCalledWith('/deviceAppManagement/iosManagedAppProtections/policy-1');
  });

  it('should return null on error', async () => {
    mockGet.mockRejectedValue(new Error('Not found'));
    
    const result = await getAppProtectionPolicy('invalid-id');
    
    expect(result).toBeNull();
  });
});
