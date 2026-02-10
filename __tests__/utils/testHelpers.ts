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
export function createMockSession(overrides = {}) {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      ...overrides.user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
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
export function mockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}
