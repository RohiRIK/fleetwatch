/**
 * Settings Catalog Tests - TDD
 * 
 * Tests for settings catalog functions in graph/client.ts
 * Phase 4: Intune Graph API Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGet = vi.fn();
const mockApi = vi.fn(() => ({ get: mockGet }));

vi.mock('@/lib/graph/client', () => ({
  getGraphClient: vi.fn(() => ({
    api: mockApi,
  })),
}));

import { getSettingsCatalog } from '@/lib/graph/client';

describe('getSettingsCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch settings catalog', async () => {
    const mockSettings = [
      { id: 'setting-1', name: 'Device Lock', category: 'security' },
      { id: 'setting-2', name: 'Password Length', category: 'password' },
    ];
    mockGet.mockResolvedValue({ value: mockSettings });
    
    const result = await getSettingsCatalog();
    
    expect(result).toHaveLength(2);
    expect(mockApi).toHaveBeenCalledWith('/deviceManagement/configurationSettingsCatalog');
  });

  it('should return empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('API Error'));
    
    const result = await getSettingsCatalog();
    
    expect(result).toHaveLength(0);
  });
});
