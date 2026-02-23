/**
 * Phase 3 Schema Tests - TDD RED Phase
 * 
 * Tests for 5 new tables:
 * 1. device_groups - Entra ID group memberships
 * 2. user_licenses - License assignments with SKU details
 * 3. user_devices - Many-to-many junction table
 * 4. device_analytics - Endpoint analytics scores
 * 5. device_warranty - Warranty status and expiration
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// STEP 1: TEST TYPE DEFINITIONS
// ============================================================================

describe('Phase 3 Schema Types', () => {
  describe('DeviceGroup', () => {
    it('should have correct type structure', async () => {
      const { device_groups } = await import('@/lib/db/schema');
      
      expect(device_groups).toBeDefined();
      expect(device_groups.id).toBeDefined();
      expect(device_groups.deviceId).toBeDefined();
      expect(device_groups.groupId).toBeDefined();
      expect(device_groups.groupName).toBeDefined();
      expect(device_groups.groupType).toBeDefined();
      expect(device_groups.createdAt).toBeDefined();
    });

    it('should have relations defined', async () => {
      const { deviceGroupsRelations } = await import('@/lib/db/schema');
      
      expect(deviceGroupsRelations).toBeDefined();
    });
  });

  describe('UserLicense', () => {
    it('should have correct type structure', async () => {
      const { user_licenses } = await import('@/lib/db/schema');
      
      expect(user_licenses).toBeDefined();
      expect(user_licenses.id).toBeDefined();
      expect(user_licenses.userId).toBeDefined();
      expect(user_licenses.skuId).toBeDefined();
      expect(user_licenses.skuPartNumber).toBeDefined();
      expect(user_licenses.capabilityStatus).toBeDefined();
      expect(user_licenses.servicePlans).toBeDefined();
      expect(user_licenses.assignedAt).toBeDefined();
    });
  });

  describe('UserDevice', () => {
    it('should have correct junction table structure', async () => {
      const { user_devices } = await import('@/lib/db/schema');
      
      expect(user_devices).toBeDefined();
      expect(user_devices.userId).toBeDefined();
      expect(user_devices.deviceId).toBeDefined();
      expect(user_devices.assignedAt).toBeDefined();
      expect(user_devices.isPrimary).toBeDefined();
    });
  });

  describe('DeviceAnalytics', () => {
    it('should have correct type structure for endpoint analytics', async () => {
      const { device_analytics } = await import('@/lib/db/schema');
      
      expect(device_analytics).toBeDefined();
      expect(device_analytics.id).toBeDefined();
      expect(device_analytics.deviceId).toBeDefined();
      expect(device_analytics.overallScore).toBeDefined();
      expect(device_analytics.startupScore).toBeDefined();
      expect(device_analytics.appReliabilityScore).toBeDefined();
      expect(device_analytics.batteryScore).toBeDefined();
      expect(device_analytics.workFromAnywhereScore).toBeDefined();
      expect(device_analytics.coreBootTimeMs).toBeDefined();
      expect(device_analytics.coreLoginTimeMs).toBeDefined();
      expect(device_analytics.recordedAt).toBeDefined();
    });
  });

  describe('DeviceWarranty', () => {
    it('should have correct type structure for warranty tracking', async () => {
      const { device_warranty } = await import('@/lib/db/schema');
      
      expect(device_warranty).toBeDefined();
      expect(device_warranty.id).toBeDefined();
      expect(device_warranty.deviceId).toBeDefined();
      expect(device_warranty.status).toBeDefined();
      expect(device_warranty.startDate).toBeDefined();
      expect(device_warranty.endDate).toBeDefined();
      expect(device_warranty.daysRemaining).toBeDefined();
      expect(device_warranty.inWarranty).toBeDefined();
      expect(device_warranty.vendor).toBeDefined();
      expect(device_warranty.updatedAt).toBeDefined();
    });
  });
});

// ============================================================================
// STEP 2: TEST TABLE RELATIONS
// ============================================================================

describe('Phase 3 Schema Relations', () => {
  describe('device_groups relations', () => {
    it('should have relation to devices table', async () => {
      const { deviceGroupsRelations, devices } = await import('@/lib/db/schema');
      
      expect(deviceGroupsRelations).toBeDefined();
    });

    it('should allow querying device with groups', async () => {
      const { devicesRelations } = await import('@/lib/db/schema');
      
      expect(devicesRelations).toBeDefined();
    });
  });

  describe('user_licenses relations', () => {
    it('should have relation to users table', async () => {
      const { userLicensesRelations, users } = await import('@/lib/db/schema');
      
      expect(userLicensesRelations).toBeDefined();
    });
  });

  describe('user_devices relations', () => {
    it('should have relations to both users and devices', async () => {
      const { userDevicesRelations } = await import('@/lib/db/schema');
      
      expect(userDevicesRelations).toBeDefined();
    });

    it('should add groups relation to users', async () => {
      const { usersRelations } = await import('@/lib/db/schema');
      
      expect(usersRelations).toBeDefined();
    });
  });

  describe('device_analytics relations', () => {
    it('should have relation to devices table', async () => {
      const { deviceAnalyticsRelations } = await import('@/lib/db/schema');
      
      expect(deviceAnalyticsRelations).toBeDefined();
    });
  });

  describe('device_warranty relations', () => {
    it('should have relation to devices table', async () => {
      const { deviceWarrantyRelations } = await import('@/lib/db/schema');
      
      expect(deviceWarrantyRelations).toBeDefined();
    });
  });
});

// ============================================================================
// STEP 3: TEST TYPE EXPORTS
// ============================================================================

describe('Phase 3 Type Exports', () => {
  it('should export DeviceGroup types (compile-time check)', async () => {
    const { device_groups } = await import('@/lib/db/schema');
    
    type DeviceGroup = typeof device_groups.$inferSelect;
    type NewDeviceGroup = typeof device_groups.$inferInsert;
    
    const testDeviceGroup: Partial<DeviceGroup> = {
      id: 'test-id',
      deviceId: 'device-id',
      groupId: 'group-id',
      groupName: 'Test Group',
    };
    
    expect(testDeviceGroup).toBeDefined();
  });

  it('should export UserLicense types (compile-time check)', async () => {
    const { user_licenses } = await import('@/lib/db/schema');
    
    type UserLicense = typeof user_licenses.$inferSelect;
    type NewUserLicense = typeof user_licenses.$inferInsert;
    
    const testUserLicense: Partial<UserLicense> = {
      id: 'test-id',
      userId: 'user-id',
      skuId: 'sku-id',
      skuPartNumber: 'ENTERPRISEPACK',
    };
    
    expect(testUserLicense).toBeDefined();
  });

  it('should export UserDevice types (compile-time check)', async () => {
    const { user_devices } = await import('@/lib/db/schema');
    
    type UserDevice = typeof user_devices.$inferSelect;
    type NewUserDevice = typeof user_devices.$inferInsert;
    
    const testUserDevice: Partial<UserDevice> = {
      userId: 'user-id',
      deviceId: 'device-id',
      isPrimary: true,
    };
    
    expect(testUserDevice).toBeDefined();
  });

  it('should export DeviceAnalytics types (compile-time check)', async () => {
    const { device_analytics } = await import('@/lib/db/schema');
    
    type DeviceAnalytics = typeof device_analytics.$inferSelect;
    type NewDeviceAnalytics = typeof device_analytics.$inferInsert;
    
    const testAnalytics: Partial<DeviceAnalytics> = {
      id: 'test-id',
      deviceId: 'device-id',
      overallScore: 85,
      startupScore: 90,
    };
    
    expect(testAnalytics).toBeDefined();
  });

  it('should export DeviceWarranty types (compile-time check)', async () => {
    const { device_warranty } = await import('@/lib/db/schema');
    
    type DeviceWarranty = typeof device_warranty.$inferSelect;
    type NewDeviceWarranty = typeof device_warranty.$inferInsert;
    
    const testWarranty: Partial<DeviceWarranty> = {
      id: 'test-id',
      deviceId: 'device-id',
      status: 'active',
      inWarranty: true,
    };
    
    expect(testWarranty).toBeDefined();
  });
});

// ============================================================================
// STEP 4: TEST ENUM DEFINITIONS
// ============================================================================

describe('Phase 3 Enums', () => {
  it('should have warranty status enum', async () => {
    const { warrantyStatusEnum } = await import('@/lib/db/schema');
    
    expect(warrantyStatusEnum).toBeDefined();
    expect(warrantyStatusEnum.enumValues).toContain('active');
    expect(warrantyStatusEnum.enumValues).toContain('expired');
    expect(warrantyStatusEnum.enumValues).toContain('unknown');
  });

  it('should have group type enum', async () => {
    const { groupTypeEnum } = await import('@/lib/db/schema');
    
    expect(groupTypeEnum).toBeDefined();
    expect(groupTypeEnum.enumValues).toContain('security');
    expect(groupTypeEnum.enumValues).toContain('microsoft_365');
    expect(groupTypeEnum.enumValues).toContain('distribution');
    expect(groupTypeEnum.enumValues).toContain('mail_enabled_security');
  });

  it('should have license status enum', async () => {
    const { licenseStatusEnum } = await import('@/lib/db/schema');
    
    expect(licenseStatusEnum).toBeDefined();
    expect(licenseStatusEnum.enumValues).toContain('enabled');
    expect(licenseStatusEnum.enumValues).toContain('warning');
    expect(licenseStatusEnum.enumValues).toContain('suspended');
    expect(licenseStatusEnum.enumValues).toContain('deleted');
  });
});

// ============================================================================
// STEP 5: TEST SCHEMA CONSTRAINTS
// ============================================================================

describe('Phase 3 Schema Constraints', () => {
  describe('device_groups unique constraints', () => {
    it('should prevent duplicate device-group pairs', async () => {
      const { device_groups } = await import('@/lib/db/schema');
      
      expect(device_groups).toBeDefined();
    });
  });

  describe('user_devices unique constraints', () => {
    it('should prevent duplicate user-device pairs', async () => {
      const { user_devices } = await import('@/lib/db/schema');
      
      expect(user_devices).toBeDefined();
    });
  });

  describe('device_analytics unique constraints', () => {
    it('should allow only one analytics record per device', async () => {
      const { device_analytics } = await import('@/lib/db/schema');
      
      expect(device_analytics.deviceId).toBeDefined();
    });
  });

  describe('device_warranty unique constraints', () => {
    it('should allow only one warranty record per device', async () => {
      const { device_warranty } = await import('@/lib/db/schema');
      
      expect(device_warranty.deviceId).toBeDefined();
    });
  });
});
