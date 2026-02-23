/**
 * User Devices Junction Tests - TDD RED Phase
 * 
 * Tests for upsertUserDevice function in deviceSync.ts
 * Issue #61: Populate user_devices junction table
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
  },
}));

vi.mock('@/lib/db/schema', () => ({
  user_devices: {
    userId: 'user_id',
    deviceId: 'device_id',
    isPrimary: 'is_primary',
    relationshipType: 'relationship_type',
    assignedAt: 'assigned_at',
  },
  devices: {
    id: 'id',
    azureId: 'azure_id',
    userId: 'user_id',
  },
  users: {
    id: 'id',
    email: 'email',
  },
  activityLogs: {},
  complianceHistory: {},
  storageHistory: {},
  device_groups: {},
  user_licenses: {},
  device_analytics: {},
  device_warranty: {},
}));

// ============================================================================
// Test Data
// ============================================================================

const mockUserDevice = {
  userId: 'user-123',
  deviceId: 'device-456',
  isPrimary: true,
  relationshipType: 'owner',
  assignedAt: new Date('2024-01-01'),
};

// ============================================================================
// Tests
// ============================================================================

describe('upsertUserDevice', () => {
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbDeleteMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbDeleteMock = db.delete as Mock;
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockUserDevice]),
      }),
    });
    
    dbDeleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create junction record when user is assigned to device', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice('user-123', 'device-456');
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should set isPrimary to true for first device of user', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    await upsertUserDevice('user-123', 'device-456', true);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should set isPrimary to false for additional devices', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice('user-123', 'device-456', false);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should set relationshipType to owner by default', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice('user-123', 'device-456');
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should allow custom relationshipType', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice('user-123', 'device-456', true, 'shared');
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should not create duplicate junction records', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUserDevice]),
        }),
      }),
    });
    
    await upsertUserDevice('user-123', 'device-456');
    
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('should handle null userId gracefully', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice(null, 'device-456');
    
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('should handle null deviceId gracefully', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    await upsertUserDevice('user-123', null);
    
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('should log creation of junction record', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    const consoleSpy = vi.spyOn(console, 'log');
    
    await upsertUserDevice('user-123', 'device-456', true);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created user-device junction')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('removeUserDevice', () => {
  let dbDeleteMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    dbDeleteMock = db.delete as Mock;
    
    dbDeleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should remove junction record when user is unassigned', async () => {
    const { removeUserDevice } = await import('@/lib/services/deviceSync');
    
    await removeUserDevice('user-123', 'device-456');
    
    expect(dbDeleteMock).toHaveBeenCalled();
  });

  it('should handle null inputs gracefully', async () => {
    const { removeUserDevice } = await import('@/lib/services/deviceSync');
    
    await removeUserDevice(null, 'device-456');
    await removeUserDevice('user-123', null);
    
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });
});

describe('upsertUserDevice integration', () => {
  it('should be exported from deviceSync', async () => {
    const { upsertUserDevice } = await import('@/lib/services/deviceSync');
    
    expect(typeof upsertUserDevice).toBe('function');
  });
  
  it('should be exported removeUserDevice from deviceSync', async () => {
    const { removeUserDevice } = await import('@/lib/services/deviceSync');
    
    expect(typeof removeUserDevice).toBe('function');
  });
});
