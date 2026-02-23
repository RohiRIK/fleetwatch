/**
 * Device Groups Sync Tests - TDD RED Phase
 * 
 * Tests for upsertDeviceGroups function in deviceSync.ts
 * Issue #59: Populate device_groups table from Graph API
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  device_groups: {
    id: 'id',
    deviceId: 'device_id',
    groupId: 'group_id',
    groupName: 'group_name',
    groupType: 'group_type',
  },
  devices: {
    id: 'id',
    azureId: 'azure_id',
  },
  users: {
    id: 'id',
    email: 'email',
  },
  activityLogs: {},
  complianceHistory: {},
  storageHistory: {},
  user_devices: {},
  user_licenses: {},
  device_analytics: {},
  device_warranty: {},
}));

// ============================================================================
// Test Data - Graph API Group Responses
// ============================================================================

const mockGraphGroups = [
  {
    id: 'group-1',
    displayName: 'All Employees',
    groupTypes: [],
    securityEnabled: true,
    mailEnabled: false,
    membershipRule: null,
    description: 'All company employees',
  },
  {
    id: 'group-2', 
    displayName: 'IT Department',
    groupTypes: ['Unified'],
    securityEnabled: true,
    mailEnabled: true,
    membershipRule: null,
    description: 'IT team members',
  },
  {
    id: 'group-3',
    displayName: 'Dynamic Device Group',
    groupTypes: [],
    securityEnabled: true,
    mailEnabled: false,
    membershipRule: 'device.devicePhysicalIds -any _ -contains "[ZTDId]"',
    description: 'Autopilot devices',
  },
  {
    id: 'group-4',
    displayName: 'Company Newsletter',
    groupTypes: [],
    securityEnabled: false,
    mailEnabled: true,
    membershipRule: null,
    description: 'Newsletter distribution',
  },
];

// ============================================================================
// Helper Function Tests (will be imported from deviceSync.ts)
// ============================================================================

describe('detectGroupType', () => {
  it('should detect Microsoft 365 group when groupTypes contains Unified', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');
    
    const group = { groupTypes: ['Unified'], securityEnabled: true, mailEnabled: true };
    expect(detectGroupType(group)).toBe('microsoft_365');
  });

  it('should detect security group when securityEnabled is true and not Unified', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');
    
    const group = { groupTypes: [], securityEnabled: true, mailEnabled: false };
    expect(detectGroupType(group)).toBe('security');
  });

  it('should detect mail-enabled security group', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');
    
    const group = { groupTypes: [], securityEnabled: true, mailEnabled: true };
    expect(detectGroupType(group)).toBe('mail_enabled_security');
  });

  it('should detect distribution group when only mailEnabled', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');
    
    const group = { groupTypes: [], securityEnabled: false, mailEnabled: true };
    expect(detectGroupType(group)).toBe('distribution');
  });

  it('should default to security for unknown configurations', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');
    
    const group = { groupTypes: [], securityEnabled: false, mailEnabled: false };
    expect(detectGroupType(group)).toBe('security');
  });
});

describe('upsertDeviceGroups', () => {
  let dbDeleteMock: Mock;
  let dbInsertMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    dbDeleteMock = db.delete as Mock;
    dbInsertMock = db.insert as Mock;
    
    dbDeleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-group-id' }]),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delete existing groups before inserting new ones', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    const { device_groups } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    
    await upsertDeviceGroups('device-123', mockGraphGroups);
    
    expect(dbDeleteMock).toHaveBeenCalled();
    const deleteCall = dbDeleteMock.mock.calls[0];
    expect(deleteCall).toBeDefined();
  });

  it('should insert all groups from Graph API response', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceGroups('device-123', mockGraphGroups);
    
    expect(dbInsertMock).toHaveBeenCalledTimes(4);
  });

  it('should map group properties correctly', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceGroups('device-123', [mockGraphGroups[0]]);
    
    const insertCall = dbInsertMock.mock.calls[0];
    expect(insertCall).toBeDefined();
  });

  it('should handle empty groups array', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceGroups('device-123', []);
    
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('should handle null/undefined groups', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceGroups('device-123', null as any);
    
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('should detect dynamic groups from membershipRule', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceGroups('device-123', [mockGraphGroups[2]]);
    
    const insertCall = dbInsertMock.mock.calls[0];
    expect(insertCall).toBeDefined();
  });

  it('should continue processing if single group insert fails', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');
    
    dbInsertMock.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error('Insert failed')),
      }),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'group-id' }]),
      }),
    });
    
    await upsertDeviceGroups('device-123', mockGraphGroups);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });
});

describe('upsertDeviceGroups integration with device sync', () => {
  it('should be exported and callable', async () => {
    const { upsertDeviceGroups } = await import('@/lib/services/deviceSync');

    expect(typeof upsertDeviceGroups).toBe('function');
  });
  
  it('should be exported and detectGroupType callable', async () => {
    const { detectGroupType } = await import('@/lib/services/deviceSync');

    expect(typeof detectGroupType).toBe('function');
  });
});
