/**
 * BitLocker Recovery Keys Tests - TDD
 * 
 * Tests for getBitLockerRecoveryKeys in graph/client.ts
 * Phase 1: Intune Graph API Enhancements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the graph client module
const mockPost = vi.fn();
const mockApi = vi.fn(() => ({ post: mockPost }));

vi.mock('@/lib/graph/client', () => ({
  getGraphClient: vi.fn(() => ({
    api: mockApi,
  })),
}));

import { getBitLockerRecoveryKeys } from '@/lib/graph/client';

describe('getBitLockerRecoveryKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct Graph API endpoint for device', async () => {
    mockPost.mockResolvedValue({ value: [] });
    
    await getBitLockerRecoveryKeys('device-123');
    
    expect(mockApi).toHaveBeenCalledWith(
      '/deviceManagement/managedDevices/device-123/getBitLockerRecoveryKeys'
    );
    expect(mockPost).toHaveBeenCalledWith({});
  });

  it('should return array of recovery keys', async () => {
    const mockKeys = [
      { id: 'key-1', key: '12345', volumeType: 'OperatingSystemVolume' },
      { id: 'key-2', key: '67890', volumeType: 'FixedDataVolume' },
    ];
    mockPost.mockResolvedValue({ value: mockKeys });
    
    const result = await getBitLockerRecoveryKeys('device-123');
    
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('key-1');
    expect(result[0].volumeType).toBe('OperatingSystemVolume');
  });

  it('should return empty array when no recovery keys', async () => {
    mockPost.mockResolvedValue({ value: [] });
    
    const result = await getBitLockerRecoveryKeys('device-no-keys');
    
    expect(result).toHaveLength(0);
  });

  it('should handle Graph API errors gracefully', async () => {
    mockPost.mockRejectedValue(new Error('Graph API error'));
    
    const result = await getBitLockerRecoveryKeys('device-error');
    
    expect(result).toHaveLength(0);
  });
});
