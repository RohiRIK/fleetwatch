/**
 * License Sync Tests - TDD RED Phase
 * 
 * Tests for licenseSync.ts service
 * Issue #60: Add License Sync Service for user_licenses table
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  users: {
    id: 'id',
    azureId: 'azure_id',
    email: 'email',
  },
  user_licenses: {
    id: 'id',
    userId: 'user_id',
    skuId: 'sku_id',
    skuPartNumber: 'sku_part_number',
  },
  devices: {},
  activityLogs: {},
  complianceHistory: {},
  storageHistory: {},
  device_groups: {},
  user_devices: {},
  device_analytics: {},
  device_warranty: {},
}));

vi.mock('@/lib/graph/client', () => ({
  getUserLicenseDetails: vi.fn(),
}));

// ============================================================================
// Test Data - Graph API License Response
// ============================================================================

const mockLicenseDetails = [
  {
    id: 'license-1',
    skuId: 'c5928f49-12ba-4539-94e3-8f2d6f3d4a5b',
    skuPartNumber: 'ENTERPRISEPACK',
    skuDescription: 'Microsoft 365 E3',
    servicePlans: [
      {
        servicePlanId: 'efb87515-9630-414e-86d1-16994e926277',
        servicePlanName: 'EXCHANGE_S_ENTERPRISE',
        provisioningStatus: 'Success',
        appliesTo: 'User',
      },
      {
        servicePlanId: '3e53e760-7621-41ec-a0d8-16996e926277',
        servicePlanName: 'SHAREPOINTWAC',
        provisioningStatus: 'Success',
        appliesTo: 'User',
      },
    ],
    capabilityStatus: 'Enabled',
    assignedBy: 'admin@contoso.com',
    assignedOn: '2024-01-15T00:00:00Z',
  },
  {
    id: 'license-2',
    skuId: 'b07c0536-c0c1-4d9f-ad81-5f2c0d3e4a5b',
    skuPartNumber: 'FLOW_FREE',
    skuDescription: 'Microsoft Power Automate Free',
    servicePlans: [],
    capabilityStatus: 'Enabled',
  },
];

const mockEmptyLicenses: never[] = [];

// ============================================================================
// Tests
// ============================================================================

describe('syncUserLicenses', () => {
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbDeleteMock: Mock;
  let getUserLicenseDetailsMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    const graph = await import('@/lib/graph/client');
    
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbDeleteMock = db.delete as Mock;
    getUserLicenseDetailsMock = graph.getUserLicenseDetails as Mock;
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'license-id' }]),
        }),
      }),
    });
    
    dbDeleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch license details from Graph API', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockResolvedValue(mockLicenseDetails);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(getUserLicenseDetailsMock).toHaveBeenCalledWith('azure-user-123');
  });

  it('should insert license records for each license', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockResolvedValue(mockLicenseDetails);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(dbInsertMock).toHaveBeenCalledTimes(2);
  });

  it('should map license data correctly', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockResolvedValue(mockLicenseDetails);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should handle empty license array', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockResolvedValue(mockEmptyLicenses);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('should handle Graph API errors gracefully', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockRejectedValue(new Error('API Error'));
    
    await expect(syncUserLicenses('azure-user-123', 'user-123')).rejects.toThrow('API Error');
  });

  it('should map service plans to JSONB', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    getUserLicenseDetailsMock.mockResolvedValue(mockLicenseDetails);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should log successful sync', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    const consoleSpy = vi.spyOn(console, 'log');
    getUserLicenseDetailsMock.mockResolvedValue(mockLicenseDetails);
    
    await syncUserLicenses('azure-user-123', 'user-123');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Synced')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('syncAllUserLicenses', () => {
  it('should export syncAllUserLicenses function', async () => {
    const { syncAllUserLicenses } = await import('@/lib/services/licenseSync');
    expect(typeof syncAllUserLicenses).toBe('function');
  });
});

describe('licenseSync service exports', () => {
  it('should export syncUserLicenses function', async () => {
    const { syncUserLicenses } = await import('@/lib/services/licenseSync');
    
    expect(typeof syncUserLicenses).toBe('function');
  });
  
  it('should export syncAllUserLicenses function', async () => {
    const { syncAllUserLicenses } = await import('@/lib/services/licenseSync');
    
    expect(typeof syncAllUserLicenses).toBe('function');
  });
});
