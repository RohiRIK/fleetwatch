/**
 * Device Enrollment Details Tests - TDD
 * 
 * Tests for enrollment data in graph/client.ts
 * Phase 2: Intune Graph API Enhancements
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

import { getManagedDevice } from '@/lib/graph/client';

describe('getManagedDevice - enrollment details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return enrollmentType from Graph API', async () => {
    const mockDevice = {
      id: 'device-123',
      displayName: 'Test Device',
      enrollmentType: 'userEnrollment',
      enrollmentTime: '2024-01-15T10:30:00Z',
      rootCertificateExpiryDateTime: '2025-01-15T10:30:00Z',
    };
    mockGet.mockResolvedValue(mockDevice);
    
    const result = await getManagedDevice('device-123');
    
    expect(result.enrollmentType).toBe('userEnrollment');
    expect(result.enrollmentTime).toBe('2024-01-15T10:30:00Z');
  });

  it('should return deviceEnrollmentManager type', async () => {
    const mockDevice = {
      id: 'device-456',
      enrollmentType: 'deviceEnrollmentManager',
    };
    mockGet.mockResolvedValue(mockDevice);
    
    const result = await getManagedDevice('device-456');
    
    expect(result.enrollmentType).toBe('deviceEnrollmentManager');
  });

  it('should return appleBulkWithUser for DEP enrollments', async () => {
    const mockDevice = {
      id: 'device-789',
      enrollmentType: 'appleBulkWithUser',
    };
    mockGet.mockResolvedValue(mockDevice);
    
    const result = await getManagedDevice('device-789');
    
    expect(result.enrollmentType).toBe('appleBulkWithUser');
  });
});
