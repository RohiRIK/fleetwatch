/**
 * Management Intents Tests - TDD
 * 
 * Tests for management intents functions in graph/client.ts
 * Phase 5: Intune Graph API Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGet = vi.fn();
const mockApi = vi.fn(() => ({ get: mockGet }));

vi.mock('@/lib/graph/client', () => ({
  getGraphClient: vi.fn(() => ({
    api: mockApi,
  })),
}));

import { getManagementIntents } from '@/lib/graph/client';

describe('getManagementIntents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch management intents', async () => {
    const mockIntents = [
      { id: 'intent-1', displayName: 'Security Baseline', templateId: 'security' },
      { id: 'intent-2', displayName: 'Device Configuration', templateId: 'config' },
    ];
    mockGet.mockResolvedValue({ value: mockIntents });
    
    const result = await getManagementIntents();
    
    expect(result).toHaveLength(2);
    expect(mockApi).toHaveBeenCalledWith('/deviceManagement/intents');
  });

  it('should return empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('API Error'));
    
    const result = await getManagementIntents();
    
    expect(result).toHaveLength(0);
  });
});
