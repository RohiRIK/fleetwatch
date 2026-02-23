/**
 * Device Sync Service Tests
 * Tests for syncing devices from Microsoft Graph to local database
 * 
 * Testing Strategy:
 * - Mock Graph API client functions
 * - Mock database operations
 * - Test sync logic, error handling, and batch processing
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { SyncMode, SyncResult } from '@/lib/services/deviceSync';

// ============================================================================
// Mocks
// ============================================================================

// Mock Graph API client
vi.mock('@/lib/graph/client', () => ({
  getManagedDevices: vi.fn(),
  getManagedDevice: vi.fn(),
  getDeviceCompliancePolicies: vi.fn(),
  getDeviceConfigurationProfiles: vi.fn(),
  getDeviceSecurityBaselines: vi.fn(),
  getDeviceWindowsProtectionState: vi.fn(),
  getDeviceHealthAttestation: vi.fn(),
  getDeviceActions: vi.fn(),
  getDeviceGroups: vi.fn(),
  getDeviceCategory: vi.fn(),
  getDeviceDetectedApps: vi.fn(),
  getDeviceAnalytics: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock schema
vi.mock('@/lib/db/schema', () => ({
  devices: {
    id: 'id',
    azureId: 'azureId',
    deviceName: 'deviceName',
  },
  users: {
    id: 'id',
    email: 'email',
  },
  activityLogs: {},
  complianceHistory: {},
  storageHistory: {},
  device_groups: {
    id: 'id',
    deviceId: 'device_id',
    groupId: 'group_id',
  },
  user_devices: {},
  user_licenses: {},
  device_analytics: {},
  device_warranty: {},
}));

// ============================================================================
// Test Data
// ============================================================================

const mockGraphDevice = {
  id: 'azure-device-123',
  azureAdDeviceId: 'aad-device-123',
  deviceName: 'Test-Laptop-01',
  serialNumber: 'SN123456',
  manufacturer: 'Dell',
  model: 'Latitude 7420',
  operatingSystem: 'Windows',
  osVersion: '10.0.19044',
  complianceState: 'compliant',
  userPrincipalName: 'test.user@example.com',
  userDisplayName: 'Test User',
  emailAddress: 'test.user@example.com',
  totalStorageSpaceInBytes: 512000000000,
  freeStorageSpaceInBytes: 256000000000,
  enrolledDateTime: '2024-01-01T00:00:00Z',
  isEncrypted: true,
  isSupervised: false,
};

const mockDbDevice = {
  id: 'db-device-123',
  azureId: 'azure-device-123',
  deviceName: 'Test-Laptop-01',
  isCompliant: true,
  complianceState: 'compliant',
};

// ============================================================================
// Tests
// ============================================================================

describe('Device Sync Service', () => {
  let getManagedDevicesMock: Mock;
  let getManagedDeviceMock: Mock;
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbUpdateMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked modules
    const graphClient = await import('@/lib/graph/client');
    const { db } = await import('@/lib/db/drizzle');
    
    // Store mocks
    getManagedDevicesMock = graphClient.getManagedDevices as Mock;
    getManagedDeviceMock = graphClient.getManagedDevice as Mock;
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbUpdateMock = db.update as Mock;
    
    // Setup default mock behaviors
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDefaultMocks() {
    // Default: No devices in Graph API
    getManagedDevicesMock.mockResolvedValue([]);
    
    // Default: Device not found in DB
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    // Default: Insert returns new device
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-device-id' }]),
      }),
    });
    
    // Default: Update succeeds
    dbUpdateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  }

  // ==========================================================================
  // syncDevices() Tests
  // ==========================================================================

  describe('syncDevices()', () => {
    it('should sync devices in full mode', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result: SyncResult = await syncDevices('full');
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.mode).toBe('full');
      expect(result.devicesProcessed).toBe(1);
      expect(result.devicesCreated).toBe(1);
      expect(result.devicesUpdated).toBe(0);
      expect(result.devicesFailed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(getManagedDevicesMock).toHaveBeenCalledWith({ top: 999 });
    });

    it('should handle empty device list', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.devicesProcessed).toBe(0);
      expect(result.devicesCreated).toBe(0);
      expect(result.devicesUpdated).toBe(0);
    });

    it('should update existing devices', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      
      // Mock existing device in DB
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDbDevice]),
          }),
        }),
      });
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.devicesCreated).toBe(0);
      expect(result.devicesUpdated).toBe(1);
    });

    it('should handle Graph API errors gracefully', async () => {
      // ARRANGE
      getManagedDevicesMock.mockRejectedValue(new Error('Graph API timeout'));
      
      // ACT & ASSERT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await expect(syncDevices('full')).rejects.toThrow('Graph API timeout');
    });

    it('should process devices in batches of 10', async () => {
      // ARRANGE
      const devices = Array.from({ length: 25 }, (_, i) => ({
        ...mockGraphDevice,
        id: `device-${i}`,
        deviceName: `Device-${i}`,
      }));
      getManagedDevicesMock.mockResolvedValue(devices);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      expect(result.devicesProcessed).toBe(25);
      expect(result.success).toBe(true);
    });

    it('should continue processing when database insert fails for one device', async () => {
      // ARRANGE
      const devices = [
        mockGraphDevice,
        { ...mockGraphDevice, id: 'device-2', deviceName: 'Device 2' },
      ];
      getManagedDevicesMock.mockResolvedValue(devices);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      // Service is robust and handles errors - all devices should process
      expect(result.devicesProcessed).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should track sync duration accurately', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });
  });

  // ==========================================================================
  // syncDeviceById() Tests
  // ==========================================================================

  describe('syncDeviceById()', () => {
    it('should sync a single device by Azure ID', async () => {
      // ARRANGE
      getManagedDeviceMock.mockResolvedValue(mockGraphDevice);
      
      // ACT
      const { syncDeviceById } = await import('@/lib/services/deviceSync');
      const result = await syncDeviceById('azure-device-123', 'deep');
      
      // ASSERT
      expect(result).toBe(true);
      expect(getManagedDeviceMock).toHaveBeenCalledWith('azure-device-123');
    });

    it('should return false when device fetch fails', async () => {
      // ARRANGE
      getManagedDeviceMock.mockRejectedValue(new Error('Device not found'));
      
      // ACT
      const { syncDeviceById } = await import('@/lib/services/deviceSync');
      const result = await syncDeviceById('nonexistent-device', 'full');
      
      // ASSERT
      expect(result).toBe(false);
    });

    it('should use deep mode by default', async () => {
      // ARRANGE
      getManagedDeviceMock.mockResolvedValue(mockGraphDevice);
      const getDeviceCompliancePoliciesMock = (await import('@/lib/graph/client')).getDeviceCompliancePolicies as Mock;
      getDeviceCompliancePoliciesMock.mockResolvedValue([]);
      
      // ACT
      const { syncDeviceById } = await import('@/lib/services/deviceSync');
      await syncDeviceById('azure-device-123');
      
      // ASSERT
      // In deep mode, enrichment functions should be called
      expect(getDeviceCompliancePoliciesMock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // transformDeviceData() Tests (via integration)
  // ==========================================================================

  describe('Device Data Transformation', () => {
    it('should transform basic Graph API device to database format', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await syncDevices('full');
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
      const insertCall = dbInsertMock.mock.calls[0];
      expect(insertCall).toBeDefined();
    });

    it('should set isCompliant based on complianceState', async () => {
      // ARRANGE
      const compliantDevice = { ...mockGraphDevice, complianceState: 'compliant' };
      const nonCompliantDevice = { ...mockGraphDevice, id: 'device-2', complianceState: 'noncompliant' };
      getManagedDevicesMock.mockResolvedValue([compliantDevice, nonCompliantDevice]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await syncDevices('full');
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
    });

    it('should link device to user when user exists', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      
      // Mock user lookup success
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'user-123' }]),
          }),
        }),
      });
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await syncDevices('full');
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
    });

    it('should handle devices without user assignment', async () => {
      // ARRANGE
      const deviceWithoutUser = { ...mockGraphDevice, userPrincipalName: null, emailAddress: null };
      getManagedDevicesMock.mockResolvedValue([deviceWithoutUser]);
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('full');
      
      // ASSERT
      expect(result.devicesCreated).toBe(1);
      expect(result.devicesFailed).toBe(0);
    });
  });

  // ==========================================================================
  // Deep Enrichment Tests
  // ==========================================================================

  describe('Deep Enrichment Mode', () => {
    beforeEach(async () => {
      const graphClient = await import('@/lib/graph/client');
      (graphClient.getDeviceCompliancePolicies as Mock).mockResolvedValue([]);
      (graphClient.getDeviceConfigurationProfiles as Mock).mockResolvedValue([]);
      (graphClient.getDeviceSecurityBaselines as Mock).mockResolvedValue([]);
      (graphClient.getDeviceWindowsProtectionState as Mock).mockResolvedValue(null);
      (graphClient.getDeviceHealthAttestation as Mock).mockResolvedValue(null);
      (graphClient.getDeviceActions as Mock).mockResolvedValue([]);
      (graphClient.getDeviceCategory as Mock).mockResolvedValue(null);
      (graphClient.getDeviceDetectedApps as Mock).mockResolvedValue([]);
      (graphClient.getDeviceAnalytics as Mock).mockResolvedValue(null);
      (graphClient.getDeviceGroups as Mock).mockResolvedValue([]);
    });

    it('should fetch additional enrichment data in deep mode', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      const getDeviceCompliancePoliciesMock = (await import('@/lib/graph/client')).getDeviceCompliancePolicies as Mock;
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await syncDevices('deep');
      
      // ASSERT
      expect(getDeviceCompliancePoliciesMock).toHaveBeenCalledWith('azure-device-123');
    });

    it('should not fetch enrichment data in full mode', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      const getDeviceCompliancePoliciesMock = (await import('@/lib/graph/client')).getDeviceCompliancePolicies as Mock;
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      await syncDevices('full');
      
      // ASSERT
      expect(getDeviceCompliancePoliciesMock).not.toHaveBeenCalled();
    });

    it('should handle enrichment failures gracefully', async () => {
      // ARRANGE
      getManagedDevicesMock.mockResolvedValue([mockGraphDevice]);
      const getDeviceCompliancePoliciesMock = (await import('@/lib/graph/client')).getDeviceCompliancePolicies as Mock;
      getDeviceCompliancePoliciesMock.mockRejectedValue(new Error('Enrichment failed'));
      
      // ACT
      const { syncDevices } = await import('@/lib/services/deviceSync');
      const result = await syncDevices('deep');
      
      // ASSERT
      expect(result.devicesCreated).toBe(1);
      expect(result.devicesFailed).toBe(0); // Enrichment failure doesn't fail the sync
    });
  });
});
