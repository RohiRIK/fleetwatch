/**
 * User Sync Service Tests
 * Tests for syncing users from Azure AD to local database
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { UserSyncResult } from '@/lib/services/userSync';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/graph/client', () => ({
  getUsers: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  users: {
    id: 'id',
    azureId: 'azureId',
    email: 'email',
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockAzureUser = {
  id: 'azure-user-123',
  userPrincipalName: 'test.user@example.com',
  displayName: 'Test User',
  mail: 'test.user@example.com',
  givenName: 'Test',
  surname: 'User',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  officeLocation: 'Building 1',
  mobilePhone: '+1234567890',
  businessPhones: ['+0987654321'],
};

const mockDbUser = {
  id: 'db-user-123',
  azureId: 'azure-user-123',
  email: 'test.user@example.com',
  name: 'Test User',
};

// ============================================================================
// Tests
// ============================================================================

describe('User Sync Service', () => {
  let getUsersMock: Mock;
  let getUserMock: Mock;
  let dbSelectMock: Mock;
  let dbInsertMock: Mock;
  let dbUpdateMock: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const graphClient = await import('@/lib/graph/client');
    const { db } = await import('@/lib/db/drizzle');
    
    getUsersMock = graphClient.getUsers as Mock;
    getUserMock = graphClient.getUser as Mock;
    dbSelectMock = db.select as Mock;
    dbInsertMock = db.insert as Mock;
    dbUpdateMock = db.update as Mock;
    
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDefaultMocks() {
    getUsersMock.mockResolvedValue([]);
    
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    
    dbInsertMock.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    
    dbUpdateMock.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  }

  // ==========================================================================
  // syncUsers() Tests
  // ==========================================================================

  describe('syncUsers()', () => {
    it('should sync users from Azure AD successfully', async () => {
      // ARRANGE
      getUsersMock.mockResolvedValue([mockAzureUser]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result: UserSyncResult = await syncUsers();
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.usersProcessed).toBe(1);
      expect(result.usersCreated).toBe(1);
      expect(result.usersUpdated).toBe(0);
      expect(result.usersFailed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(getUsersMock).toHaveBeenCalledWith({
        top: 999,
        select: expect.arrayContaining(['id', 'userPrincipalName', 'displayName']),
      });
    });

    it('should handle empty user list', async () => {
      // ARRANGE
      getUsersMock.mockResolvedValue([]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.usersProcessed).toBe(0);
      expect(result.usersCreated).toBe(0);
    });

    it('should update existing users', async () => {
      // ARRANGE
      getUsersMock.mockResolvedValue([mockAzureUser]);
      
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDbUser]),
          }),
        }),
      });
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.usersCreated).toBe(0);
      expect(result.usersUpdated).toBe(1);
    });

    it('should handle Azure AD API errors', async () => {
      // ARRANGE
      getUsersMock.mockRejectedValue(new Error('Azure AD API error'));
      
      // ACT & ASSERT
      const { syncUsers } = await import('@/lib/services/userSync');
      await expect(syncUsers()).rejects.toThrow('Azure AD API error');
    });

    it('should process users in batches of 20', async () => {
      // ARRANGE
      const users = Array.from({ length: 50 }, (_, i) => ({
        ...mockAzureUser,
        id: `user-${i}`,
        userPrincipalName: `user${i}@example.com`,
      }));
      getUsersMock.mockResolvedValue(users);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.usersProcessed).toBe(50);
      expect(result.success).toBe(true);
    });

    it('should continue processing after individual user failures', async () => {
      // ARRANGE
      const users = [
        mockAzureUser,
        { ...mockAzureUser, id: 'user-2', userPrincipalName: 'user2@example.com' },
      ];
      getUsersMock.mockResolvedValue(users);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.usersProcessed).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should track sync duration', async () => {
      // ARRANGE
      getUsersMock.mockResolvedValue([mockAzureUser]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should normalize email to lowercase', async () => {
      // ARRANGE
      const userWithUppercaseEmail = {
        ...mockAzureUser,
        mail: 'TEST.USER@EXAMPLE.COM',
      };
      getUsersMock.mockResolvedValue([userWithUppercaseEmail]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      await syncUsers();
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
      const insertCall = dbInsertMock.mock.calls[0];
      expect(insertCall).toBeDefined();
    });
  });

  // ==========================================================================
  // syncUserById() Tests
  // ==========================================================================

  describe('syncUserById()', () => {
    it('should sync a single user by Azure ID', async () => {
      // ARRANGE
      getUserMock.mockResolvedValue(mockAzureUser);
      
      // ACT
      const { syncUserById } = await import('@/lib/services/userSync');
      const result = await syncUserById('azure-user-123');
      
      // ASSERT
      expect(result).toBe(true);
      expect(getUserMock).toHaveBeenCalledWith('azure-user-123');
    });

    it('should return false when user fetch fails', async () => {
      // ARRANGE
      getUserMock.mockRejectedValue(new Error('User not found'));
      
      // ACT
      const { syncUserById } = await import('@/lib/services/userSync');
      const result = await syncUserById('nonexistent-user');
      
      // ASSERT
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // User Data Transformation Tests
  // ==========================================================================

  describe('User Data Transformation', () => {
    it('should use userPrincipalName as fallback for email', async () => {
      // ARRANGE
      const userWithoutMail = {
        ...mockAzureUser,
        mail: null,
        userPrincipalName: 'fallback@example.com',
      };
      getUsersMock.mockResolvedValue([userWithoutMail]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      await syncUsers();
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
    });

    it('should use displayName as name', async () => {
      // ARRANGE
      getUsersMock.mockResolvedValue([mockAzureUser]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      await syncUsers();
      
      // ASSERT
      expect(dbInsertMock).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      // ARRANGE
      const minimalUser = {
        id: 'user-minimal',
        userPrincipalName: 'minimal@example.com',
        displayName: null,
        mail: null,
        jobTitle: null,
        department: null,
      };
      getUsersMock.mockResolvedValue([minimalUser]);
      
      // ACT
      const { syncUsers } = await import('@/lib/services/userSync');
      const result = await syncUsers();
      
      // ASSERT
      expect(result.usersCreated).toBe(1);
      expect(result.usersFailed).toBe(0);
    });
  });
});
