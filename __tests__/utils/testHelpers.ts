/**
 * Test Utilities and Helpers
 *
 * Common utilities for writing tests
 */

/**
 * Create a mock device object
 */
export function createMockDevice(overrides = {}) {
  return {
    id: 'device-123',
    azureId: 'azure-device-123',
    deviceName: 'Test Device',
    serialNumber: 'SN123456',
    manufacturer: 'Dell',
    model: 'Latitude 7420',
    operatingSystem: 'Windows',
    osVersion: '11 Pro',
    isCompliant: true,
    isEncrypted: true,
    userPrincipalName: 'test@example.com',
    userDisplayName: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    displayName: 'Test User',
    azureId: 'azure-user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock session object
 */
export function createMockSession(overrides: { user?: Record<string, unknown> } = {}) {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      ...overrides.user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Mock fetch response
 */
export function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

// ============================================================================
// PHASE 3: NEW TABLE MOCK HELPERS
// ============================================================================

/**
 * Create a mock device group object
 */
export function createMockDeviceGroup(overrides = {}) {
  return {
    id: 'group-123',
    deviceId: 'device-123',
    groupId: 'azure-group-123',
    groupName: 'Test Security Group',
    groupType: 'security' as const,
    description: 'Test group description',
    isDynamic: false,
    membershipRule: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock user license object
 */
export function createMockUserLicense(overrides = {}) {
  return {
    id: 'license-123',
    userId: 'user-123',
    skuId: 'sku-123',
    skuPartNumber: 'ENTERPRISEPACK',
    skuName: 'Microsoft 365 E3',
    capabilityStatus: 'enabled' as const,
    servicePlans: [
      {
        servicePlanId: 'plan-1',
        servicePlanName: 'EXCHANGE_S_ENTERPRISE',
        provisioningStatus: 'Success',
        appliesTo: 'User',
      },
    ],
    prepaidUnitsEnabled: 100,
    prepaidUnitsSuspended: 0,
    prepaidUnitsWarning: 0,
    consumedUnits: 50,
    assignedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock user-device junction object
 */
export function createMockUserDevice(overrides = {}) {
  return {
    userId: 'user-123',
    deviceId: 'device-123',
    isPrimary: true,
    assignedAt: new Date('2024-01-01'),
    relationshipType: 'owner',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock device analytics object
 */
export function createMockDeviceAnalytics(overrides = {}) {
  return {
    id: 'analytics-123',
    deviceId: 'device-123',
    overallScore: 85,
    startupScore: 90,
    appReliabilityScore: 88,
    batteryScore: 75,
    workFromAnywhereScore: 82,
    coreBootTimeMs: 15000,
    coreLoginTimeMs: 8000,
    responsiveDesktopTimeMs: 5000,
    restartCount: 2,
    blueScreenCount: 0,
    meanTimeToFailureMinutes: 43200,
    healthStatus: 'healthy',
    diskType: 'SSD',
    modelPerformance: null,
    rawAnalytics: null,
    recordedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Create a mock device warranty object
 */
export function createMockDeviceWarranty(overrides: Record<string, unknown> = {}) {
  const defaultEndDate = new Date();
  defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1); // 1 year from now
  
  const endDate = (overrides.endDate as Date) || defaultEndDate;
  const now = new Date();
  const calculatedDaysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  const defaults = {
    id: 'warranty-123',
    deviceId: 'device-123',
    status: 'active' as const,
    startDate: new Date('2023-01-01'),
    endDate: defaultEndDate,
    daysRemaining: calculatedDaysRemaining,
    inWarranty: calculatedDaysRemaining > 0,
    vendor: 'Dell Technologies',
    warrantyType: 'ProSupport',
    coverageType: 'Next Business Day',
    description: '3-year ProSupport warranty',
    serialNumber: 'SN123456',
    rawWarrantyData: null,
    lastCheckedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
  
  const merged = { ...defaults, ...overrides };
  
  return {
    ...merged,
    daysRemaining: calculatedDaysRemaining,
    inWarranty: overrides.inWarranty !== undefined ? overrides.inWarranty : calculatedDaysRemaining > 0,
  };
}
