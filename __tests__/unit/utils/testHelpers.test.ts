import { describe, it, expect } from 'vitest';
import {
  createMockDevice,
  createMockUser,
  createMockSession,
  waitFor,
  mockFetchResponse,
  createMockDeviceGroup,
  createMockUserLicense,
  createMockUserDevice,
  createMockDeviceAnalytics,
  createMockDeviceWarranty,
} from '@/__tests__/utils/testHelpers';

describe('Test Helpers', () => {
  describe('createMockDevice', () => {
    it('should create a device with default values', () => {
      const device = createMockDevice();
      expect(device.id).toBe('device-123');
      expect(device.deviceName).toBe('Test Device');
      expect(device.isCompliant).toBe(true);
    });

    it('should allow overriding default values', () => {
      const device = createMockDevice({
        deviceName: 'Custom Device',
        isCompliant: false,
      });
      expect(device.deviceName).toBe('Custom Device');
      expect(device.isCompliant).toBe(false);
    });
  });

  describe('createMockUser', () => {
    it('should create a user with default values', () => {
      const user = createMockUser();
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    it('should allow overriding default values', () => {
      const user = createMockUser({
        email: 'custom@example.com',
        name: 'Custom User',
      });
      expect(user.email).toBe('custom@example.com');
      expect(user.name).toBe('Custom User');
    });
  });

  describe('createMockSession', () => {
    it('should create a session with default user', () => {
      const session = createMockSession();
      expect(session.user.id).toBe('user-123');
      expect(session.user.email).toBe('test@example.com');
      expect(session.expires).toBeDefined();
    });

    it('should allow overriding user data', () => {
      const session = createMockSession({
        user: { email: 'admin@example.com' },
      });
      expect(session.user.email).toBe('admin@example.com');
    });
  });

  describe('waitFor', () => {
    it('should resolve when condition becomes true', async () => {
      let value = false;
      setTimeout(() => {
        value = true;
      }, 100);

      await waitFor(() => value);
      expect(value).toBe(true);
    });

    it('should timeout if condition never becomes true', async () => {
      await expect(
        waitFor(() => false, 100)
      ).rejects.toThrow('Timeout waiting for condition');
    });
  });

  describe('mockFetchResponse', () => {
    it('should create a successful fetch response', async () => {
      const data = { message: 'success' };
      const response = await mockFetchResponse(data);

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toEqual(data);
    });

    it('should create a failed fetch response', async () => {
      const response = await mockFetchResponse(
        { error: 'Not found' },
        false,
        404
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});

describe('Phase 3 Test Helpers', () => {
  describe('createMockDeviceGroup', () => {
    it('should create a device group with default values', () => {
      const group = createMockDeviceGroup();
      expect(group.id).toBe('group-123');
      expect(group.groupName).toBe('Test Security Group');
      expect(group.groupType).toBe('security');
    });

    it('should allow overriding default values', () => {
      const group = createMockDeviceGroup({
        groupName: 'Custom Group',
        groupType: 'microsoft_365',
        isDynamic: true,
      });
      expect(group.groupName).toBe('Custom Group');
      expect(group.groupType).toBe('microsoft_365');
      expect(group.isDynamic).toBe(true);
    });
  });

  describe('createMockUserLicense', () => {
    it('should create a user license with default values', () => {
      const license = createMockUserLicense();
      expect(license.id).toBe('license-123');
      expect(license.skuPartNumber).toBe('ENTERPRISEPACK');
      expect(license.capabilityStatus).toBe('enabled');
      expect(license.servicePlans).toHaveLength(1);
    });

    it('should allow overriding default values', () => {
      const license = createMockUserLicense({
        skuPartNumber: 'ENTERPRISEPREMIUM',
        capabilityStatus: 'warning',
      });
      expect(license.skuPartNumber).toBe('ENTERPRISEPREMIUM');
      expect(license.capabilityStatus).toBe('warning');
    });
  });

  describe('createMockUserDevice', () => {
    it('should create a user-device junction with default values', () => {
      const userDevice = createMockUserDevice();
      expect(userDevice.userId).toBe('user-123');
      expect(userDevice.deviceId).toBe('device-123');
      expect(userDevice.isPrimary).toBe(true);
      expect(userDevice.relationshipType).toBe('owner');
    });

    it('should allow overriding default values', () => {
      const userDevice = createMockUserDevice({
        isPrimary: false,
        relationshipType: 'shared',
      });
      expect(userDevice.isPrimary).toBe(false);
      expect(userDevice.relationshipType).toBe('shared');
    });
  });

  describe('createMockDeviceAnalytics', () => {
    it('should create device analytics with default values', () => {
      const analytics = createMockDeviceAnalytics();
      expect(analytics.id).toBe('analytics-123');
      expect(analytics.overallScore).toBe(85);
      expect(analytics.startupScore).toBe(90);
      expect(analytics.healthStatus).toBe('healthy');
    });

    it('should allow overriding default values', () => {
      const analytics = createMockDeviceAnalytics({
        overallScore: 50,
        healthStatus: 'needs_attention',
        blueScreenCount: 3,
      });
      expect(analytics.overallScore).toBe(50);
      expect(analytics.healthStatus).toBe('needs_attention');
      expect(analytics.blueScreenCount).toBe(3);
    });
  });

  describe('createMockDeviceWarranty', () => {
    it('should create device warranty with default values', () => {
      const warranty = createMockDeviceWarranty();
      expect(warranty.id).toBe('warranty-123');
      expect(warranty.status).toBe('active');
      expect(warranty.inWarranty).toBe(true);
      expect(warranty.vendor).toBe('Dell Technologies');
    });

    it('should allow overriding default values', () => {
      const warranty = createMockDeviceWarranty({
        status: 'expired',
        inWarranty: false,
        vendor: 'HP Inc.',
      });
      expect(warranty.status).toBe('expired');
      expect(warranty.inWarranty).toBe(false);
      expect(warranty.vendor).toBe('HP Inc.');
    });

    it('should calculate daysRemaining based on endDate', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const warranty = createMockDeviceWarranty({
        endDate: futureDate,
      });
      
      expect(warranty.daysRemaining).toBeGreaterThan(300);
      expect(warranty.inWarranty).toBe(true);
    });
  });
});
