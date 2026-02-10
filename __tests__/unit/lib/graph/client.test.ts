/**
 * Graph API Client Tests
 * Tests for Microsoft Graph API interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockGraphClient = {
  api: vi.fn(),
};

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: vi.fn(() => mockGraphClient),
  },
}));

vi.mock('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials', () => ({
  TokenCredentialAuthenticationProvider: vi.fn(),
}));

vi.mock('@azure/identity', () => ({
  ClientSecretCredential: vi.fn(),
}));

// ============================================================================
// Tests
// ============================================================================

describe('Graph API Client', () => {
  let apiMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock chain
    apiMock = vi.fn();
    mockGraphClient.api = apiMock;
    
    // Set environment variables
    process.env.AZURE_AD_TENANT_ID = 'test-tenant';
    process.env.AZURE_AD_CLIENT_ID = 'test-client';
    process.env.AZURE_AD_CLIENT_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupApiMockChain(returnValue: any) {
    const chain = {
      top: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderby: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(returnValue),
    };
    apiMock.mockReturnValue(chain);
    return chain;
  }

  // ==========================================================================
  // getGraphClient() Tests
  // ==========================================================================

  describe('getGraphClient()', () => {
    it('should create a Graph client with credentials', async () => {
      // ACT
      const { getGraphClient } = await import('@/lib/graph/client');
      const client = getGraphClient();
      
      // ASSERT
      expect(client).toBeDefined();
    });

    it('should return singleton instance on subsequent calls', async () => {
      // ACT
      const { getGraphClient } = await import('@/lib/graph/client');
      const client1 = getGraphClient();
      const client2 = getGraphClient();
      
      // ASSERT
      expect(client1).toBe(client2);
    });

    it('should throw error when credentials are missing', async () => {
      // ARRANGE
      delete process.env.AZURE_AD_TENANT_ID;
      
      // Reset module to force re-initialization
      vi.resetModules();
      
      // ACT & ASSERT
      const { getGraphClient } = await import('@/lib/graph/client');
      expect(() => getGraphClient()).toThrow('Missing Azure AD credentials');
    });
  });

  // ==========================================================================
  // getManagedDevices() Tests
  // ==========================================================================

  describe('getManagedDevices()', () => {
    it('should fetch devices with default options', async () => {
      // ARRANGE
      const mockDevices = [{ id: 'device-1', deviceName: 'Test Device' }];
      setupApiMockChain({ value: mockDevices });
      
      // ACT
      const { getManagedDevices } = await import('@/lib/graph/client');
      const result = await getManagedDevices({ top: 100 });
      
      // ASSERT
      expect(result).toEqual(mockDevices);
      expect(apiMock).toHaveBeenCalledWith('/deviceManagement/managedDevices');
    });

    it('should apply query options correctly', async () => {
      // ARRANGE
      const chain = setupApiMockChain({ value: [] });
      
      // ACT
      const { getManagedDevices } = await import('@/lib/graph/client');
      await getManagedDevices({
        top: 50,
        skip: 10,
        filter: "complianceState eq 'compliant'",
        select: ['id', 'deviceName'],
        orderby: 'deviceName',
      });
      
      // ASSERT
      expect(chain.top).toHaveBeenCalledWith(50);
      expect(chain.skip).toHaveBeenCalledWith(10);
      expect(chain.filter).toHaveBeenCalledWith("complianceState eq 'compliant'");
      expect(chain.select).toHaveBeenCalledWith('id,deviceName');
      expect(chain.orderby).toHaveBeenCalledWith('deviceName');
    });

    it('should handle API errors gracefully', async () => {
      // ARRANGE
      setupApiMockChain({ value: [] }).get.mockRejectedValue(new Error('API Error'));
      
      // ACT & ASSERT
      const { getManagedDevices } = await import('@/lib/graph/client');
      await expect(getManagedDevices({ top: 100 })).rejects.toThrow(
        'Failed to fetch devices from Microsoft Graph'
      );
    });
  });

  // ==========================================================================
  // getManagedDevice() Tests
  // ==========================================================================

  describe('getManagedDevice()', () => {
    it('should fetch a single device by ID', async () => {
      // ARRANGE
      const mockDevice = { id: 'device-123', deviceName: 'Test Device' };
      setupApiMockChain(mockDevice);
      
      // ACT
      const { getManagedDevice } = await import('@/lib/graph/client');
      const result = await getManagedDevice('device-123');
      
      // ASSERT
      expect(result).toEqual(mockDevice);
      expect(apiMock).toHaveBeenCalledWith('/deviceManagement/managedDevices/device-123');
    });

    it('should handle device not found error', async () => {
      // ARRANGE
      setupApiMockChain({}).get.mockRejectedValue(new Error('Not found'));
      
      // ACT & ASSERT
      const { getManagedDevice } = await import('@/lib/graph/client');
      await expect(getManagedDevice('nonexistent')).rejects.toThrow(
        'Failed to fetch device from Microsoft Graph'
      );
    });
  });

  // ==========================================================================
  // getUsers() Tests
  // ==========================================================================

  describe('getUsers()', () => {
    it('should fetch users with query options', async () => {
      // ARRANGE
      const mockUsers = [{ id: 'user-1', displayName: 'Test User' }];
      setupApiMockChain({ value: mockUsers });
      
      // ACT
      const { getUsers } = await import('@/lib/graph/client');
      const result = await getUsers({
        top: 100,
        select: ['id', 'displayName'],
      });
      
      // ASSERT
      expect(result).toEqual(mockUsers);
      expect(apiMock).toHaveBeenCalledWith('/users');
    });

    it('should handle API errors', async () => {
      // ARRANGE
      setupApiMockChain({}).get.mockRejectedValue(new Error('API Error'));
      
      // ACT & ASSERT
      const { getUsers } = await import('@/lib/graph/client');
      await expect(getUsers({ top: 100 })).rejects.toThrow(
        'Failed to fetch users from Microsoft Graph'
      );
    });
  });

  // ==========================================================================
  // getUser() Tests
  // ==========================================================================

  describe('getUser()', () => {
    it('should fetch a single user by ID', async () => {
      // ARRANGE
      const mockUser = { id: 'user-123', displayName: 'Test User' };
      setupApiMockChain(mockUser);
      
      // ACT
      const { getUser } = await import('@/lib/graph/client');
      const result = await getUser('user-123');
      
      // ASSERT
      expect(result).toEqual(mockUser);
      expect(apiMock).toHaveBeenCalledWith('/users/user-123');
    });
  });

  // ==========================================================================
  // Enrichment Functions Tests
  // ==========================================================================

  describe('Device Enrichment Functions', () => {
    it('getDeviceCompliancePolicies should return empty array on error', async () => {
      // ARRANGE
      setupApiMockChain({}).get.mockRejectedValue(new Error('Not found'));
      
      // ACT
      const { getDeviceCompliancePolicies } = await import('@/lib/graph/client');
      const result = await getDeviceCompliancePolicies('device-123');
      
      // ASSERT
      expect(result).toEqual([]);
    });

    it('getDeviceWindowsProtectionState should return null for non-Windows devices', async () => {
      // ARRANGE
      const error: any = new Error('Not found');
      error.statusCode = 404;
      setupApiMockChain({}).get.mockRejectedValue(error);
      
      // ACT
      const { getDeviceWindowsProtectionState } = await import('@/lib/graph/client');
      const result = await getDeviceWindowsProtectionState('ios-device');
      
      // ASSERT
      expect(result).toBeNull();
    });

    it('getDeviceCategory should return null when not assigned', async () => {
      // ARRANGE
      const error: any = new Error('Not found');
      error.statusCode = 404;
      setupApiMockChain({}).get.mockRejectedValue(error);
      
      // ACT
      const { getDeviceCategory } = await import('@/lib/graph/client');
      const result = await getDeviceCategory('device-123');
      
      // ASSERT
      expect(result).toBeNull();
    });

    it('getDeviceGroups should return groups for device', async () => {
      // ARRANGE
      const mockGroups = [
        { id: 'group-1', displayName: 'Engineering' },
        { id: 'group-2', displayName: 'Compliance' },
      ];
      setupApiMockChain({ value: mockGroups });
      
      // ACT
      const { getDeviceGroups } = await import('@/lib/graph/client');
      const result = await getDeviceGroups('aad-device-123');
      
      // ASSERT
      expect(result).toEqual(mockGroups);
      expect(apiMock).toHaveBeenCalledWith('/devices/aad-device-123/memberOf');
    });
  });

  // ==========================================================================
  // testGraphConnection() Tests
  // ==========================================================================

  describe('testGraphConnection()', () => {
    it('should return success when connection works', async () => {
      // ARRANGE
      const mockOrg = { value: [{ displayName: 'Test Org' }] };
      setupApiMockChain(mockOrg);
      
      // ACT
      const { testGraphConnection } = await import('@/lib/graph/client');
      const result = await testGraphConnection();
      
      // ASSERT
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully connected');
      expect(result.organization).toEqual(mockOrg.value[0]);
    });

    it('should return error when connection fails', async () => {
      // ARRANGE
      setupApiMockChain({}).get.mockRejectedValue(new Error('Connection failed'));
      
      // ACT
      const { testGraphConnection } = await import('@/lib/graph/client');
      const result = await testGraphConnection();
      
      // ASSERT
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });
});
