/**
 * RBAC Tests
 * Tests for role-based access control
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the session module
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

describe('RBAC', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('isSuperadmin', () => {
    it('should return true for emergency admin email', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue({
        user: {
          email: 'admin@device-inventory.local',
          id: '123',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await isSuperadmin();
      expect(result).toBe(true);
    });

    it('should return false for regular users', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue({
        user: {
          email: 'user@example.com',
          id: '456',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const result = await isSuperadmin();
      expect(result).toBe(false);
    });

    it('should return false when no session exists', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue(null);

      const result = await isSuperadmin();
      expect(result).toBe(false);
    });
  });

  describe('requireSuperadmin', () => {
    it('should return session for superadmin', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireSuperadmin } = await import('@/lib/auth/rbac');
      
      const mockSession = {
        user: {
          email: 'admin@device-inventory.local',
          id: '123',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      vi.mocked(getSession).mockResolvedValue(mockSession);

      const result = await requireSuperadmin();
      expect(result).toEqual(mockSession);
    });

    it('should throw error for non-superadmin', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireSuperadmin } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue({
        user: {
          email: 'user@example.com',
          id: '456',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      await expect(requireSuperadmin()).rejects.toThrow('Forbidden');
    });
  });

  describe('getCurrentUserRole', () => {
    it('should return "superadmin" for admin user', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getCurrentUserRole } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue({
        user: {
          email: 'admin@device-inventory.local',
          id: '123',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const role = await getCurrentUserRole();
      expect(role).toBe('superadmin');
    });

    it('should return "user" for regular user', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { getCurrentUserRole } = await import('@/lib/auth/rbac');
      
      vi.mocked(getSession).mockResolvedValue({
        user: {
          email: 'user@example.com',
          id: '456',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const role = await getCurrentUserRole();
      expect(role).toBe('user');
    });
  });
});
