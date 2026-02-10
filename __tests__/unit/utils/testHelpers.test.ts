import { describe, it, expect } from 'vitest';
import {
  createMockDevice,
  createMockUser,
  createMockSession,
  waitFor,
  mockFetchResponse,
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
