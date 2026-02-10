/**
 * RBAC Tests
 * Tests for role-based access control
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Session } from 'next-auth';

// Mock the session module
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

// Mock the database module
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('RBAC', () => {
  let getSessionMock: Mock;
  let dbSelectMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    const { db } = await import('@/lib/db/drizzle');
    getSessionMock = getSession as Mock;
    dbSelectMock = db.select as Mock;
    
    // Setup default db mock chain
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  describe('isSuperadmin', () => {
    it('should return true for emergency admin email', async () => {
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue({
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
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue({
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
      const { isSuperadmin } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue(null);

      const result = await isSuperadmin();
      expect(result).toBe(false);
    });
  });

  describe('requireSuperadmin', () => {
    it('should return session for superadmin', async () => {
      const { requireSuperadmin } = await import('@/lib/auth/rbac');
      
      const mockSession = {
        user: {
          email: 'admin@device-inventory.local',
          id: '123',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      };

      getSessionMock.mockResolvedValue(mockSession);

      const result = await requireSuperadmin();
      expect(result).toEqual(mockSession);
    });

    it('should throw error for non-superadmin', async () => {
      const { requireSuperadmin } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue({
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
      const { getCurrentUserRole } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue({
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
      const { getCurrentUserRole } = await import('@/lib/auth/rbac');
      
      getSessionMock.mockResolvedValue({
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
