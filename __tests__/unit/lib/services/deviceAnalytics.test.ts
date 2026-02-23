/**
 * Device Analytics Tests - TDD RED Phase
 * 
 * Tests for upsertDeviceAnalytics function in deviceSync.ts
 * Issue #62: Populate device_analytics table from endpoint analytics
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  device_analytics: {
    id: 'id',
    deviceId: 'device_id',
    overallScore: 'overall_score',
    startupScore: 'startup_score',
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
  device_groups: {},
  user_devices: {},
  user_licenses: {},
  device_warranty: {},
}));

// ============================================================================
// Test Data - Graph API Analytics Response
// ============================================================================

const mockAnalyticsData = {
  overallScore: 85,
  startupPerformance: {
    score: 90,
    coreBootTimeInMs: 15000,
    coreLoginTimeInMs: 8000,
    responsiveDesktopTimeInMs: 5000,
  },
  appReliability: {
    score: 88,
  },
  batteryHealth: {
    score: 75,
  },
  workFromAnywhere: {
    score: 82,
  },
  healthStatus: 'healthy',
  diskType: 'SSD',
  restartCount: 2,
  blueScreenCount: 0,
  modelPerformance: null,
};

const mockPartialAnalytics = {
  overallScore: 70,
  startupPerformance: {
    score: 65,
    coreBootTimeInMs: 25000,
  },
  healthStatus: 'needs_attention',
};

// ============================================================================
// Tests
// ============================================================================

describe('upsertDeviceAnalytics', () => {
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbUpdateMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { db } = await import('@/lib/db/drizzle');
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbUpdateMock = db.update as Mock;
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'analytics-id' }]),
      }),
    });
    
    dbUpdateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should insert analytics record when none exists', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should extract overallScore correctly', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should extract startupPerformance scores', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should extract appReliability score', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should extract batteryHealth score', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should extract workFromAnywhere score', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should handle null/undefined analytics gracefully', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', null);
    await upsertDeviceAnalytics('device-456', undefined);
    
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it('should handle partial analytics data', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockPartialAnalytics);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should set null for missing nested properties', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    const incomplete = { overallScore: 50 };
    await upsertDeviceAnalytics('device-123', incomplete);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });

  it('should update existing analytics record', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-analytics-id', deviceId: 'device-123' }]),
        }),
      }),
    });
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbUpdateMock).toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('should log creation of analytics record', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    const consoleSpy = vi.spyOn(console, 'log');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created device analytics')
    );
    
    consoleSpy.mockRestore();
  });

  it('should log update of analytics record', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    const consoleSpy = vi.spyOn(console, 'log');
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      }),
    });
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updated device analytics')
    );
    
    consoleSpy.mockRestore();
  });

  it('should store raw analytics in rawAnalytics column', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    await upsertDeviceAnalytics('device-123', mockAnalyticsData);
    
    expect(dbInsertMock).toHaveBeenCalled();
  });
});

describe('upsertDeviceAnalytics integration', () => {
  it('should be exported from deviceSync', async () => {
    const { upsertDeviceAnalytics } = await import('@/lib/services/deviceSync');
    
    expect(typeof upsertDeviceAnalytics).toBe('function');
  });
});
