import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch'; // Required for server-side fetch

/**
 * Microsoft Graph API Client
 * Uses app-only authentication (client credentials flow) for background sync
 */

let graphClient: Client | null = null;

/**
 * Get or create singleton Graph API client
 * Uses client secret authentication for app-only access
 */
export function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Azure AD credentials. Please set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, and AZURE_AD_CLIENT_SECRET in .env.local'
    );
  }

  // Create client secret credential
  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );

  // Create auth provider with Graph API scope
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  // Initialize Graph client
  graphClient = Client.initWithMiddleware({ 
    authProvider,
    defaultVersion: 'v1.0',
  });

  return graphClient;
}

/**
 * Get managed devices from Intune
 * 
 * @param options Query options
 * @returns Array of managed devices
 */
export async function getManagedDevices(options: {
  top?: number;
  skip?: number;
  filter?: string;
  select?: string[];
  orderby?: string;
}): Promise<any[]> {
  const client = getGraphClient();

  try {
    let request = client
      .api('/deviceManagement/managedDevices')
      .top(options.top || 100)
      .skip(options.skip || 0);

    if (options.filter) {
      request = request.filter(options.filter);
    }

    if (options.select && options.select.length > 0) {
      request = request.select(options.select.join(','));
    }

    if (options.orderby) {
      request = request.orderby(options.orderby);
    }

    const response = await request.get();
    return response.value || [];
  } catch (error: any) {
    console.error('[Graph API] Failed to fetch managed devices:', error);
    throw new Error(
      `Failed to fetch devices from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Get a single managed device by ID
 * 
 * @param deviceId Device ID from Intune
 * @returns Device object
 */
export async function getManagedDevice(deviceId: string): Promise<any> {
  const client = getGraphClient();

  try {
    const device = await client
      .api(`/deviceManagement/managedDevices/${deviceId}`)
      .get();

    return device;
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch device ${deviceId}:`, error);
    throw new Error(
      `Failed to fetch device from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Get users from Azure AD
 * 
 * @param options Query options
 * @returns Array of users
 */
export async function getUsers(options: {
  top?: number;
  skip?: number;
  filter?: string;
  select?: string[];
  orderby?: string;
}): Promise<any[]> {
  const client = getGraphClient();

  try {
    let request = client
      .api('/users')
      .top(options.top || 100);

    // Note: $skip is not supported by /users endpoint, use pagination with @odata.nextLink instead
    
    if (options.filter) {
      request = request.filter(options.filter);
    }

    if (options.select && options.select.length > 0) {
      request = request.select(options.select.join(','));
    }

    if (options.orderby) {
      request = request.orderby(options.orderby);
    }

    const response = await request.get();
    return response.value || [];
  } catch (error: any) {
    console.error('[Graph API] Failed to fetch users:', error);
    throw new Error(
      `Failed to fetch users from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Get a single user by ID
 * 
 * @param userId User ID from Azure AD
 * @returns User object
 */
export async function getUser(userId: string): Promise<any> {
  const client = getGraphClient();

  try {
    const user = await client
      .api(`/users/${userId}`)
      .get();

    return user;
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch user ${userId}:`, error);
    throw new Error(
      `Failed to fetch user from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Get devices owned by a specific user
 * 
 * @param userId User ID from Azure AD
 * @returns Array of devices owned by the user
 */
export async function getUserDevices(userId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/users/${userId}/ownedDevices`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch devices for user ${userId}:`, error);
    throw new Error(
      `Failed to fetch user devices from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Get device compliance policy states for a specific device
 * 
 * @param deviceId Device ID from Intune
 * @returns Array of compliance policy states
 */
export async function getDeviceCompliancePolicies(deviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch compliance policies for device ${deviceId}:`, error);
    // Return empty array instead of throwing - this data is optional enrichment
    return [];
  }
}

/**
 * Get device configuration profile states for a specific device
 * 
 * @param deviceId Device ID from Intune
 * @returns Array of configuration profile states
 */
export async function getDeviceConfigurationProfiles(deviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/deviceConfigurationStates`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch configuration profiles for device ${deviceId}:`, error);
    return [];
  }
}

/**
 * Get security baseline states for a specific device
 * 
 * @param deviceId Device ID from Intune
 * @returns Array of security baseline states
 */
export async function getDeviceSecurityBaselines(deviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/securityBaselineStates`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch security baselines for device ${deviceId}:`, error);
    return [];
  }
}

/**
 * Get Windows protection state for a specific device
 * Only applicable to Windows devices
 * 
 * @param deviceId Device ID from Intune
 * @returns Windows protection state object or null
 */
export async function getDeviceWindowsProtectionState(deviceId: string): Promise<any | null> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/windowsProtectionState`)
      .get();

    return response;
  } catch (error: any) {
    // This endpoint only works for Windows devices, so 404 is expected for others
    if (error.statusCode === 404) {
      return null;
    }
    console.error(`[Graph API] Failed to fetch Windows protection state for device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Get device health attestation state
 * 
 * @param deviceId Device ID from Intune
 * @returns Health attestation state object or null
 */
export async function getDeviceHealthAttestation(deviceId: string): Promise<any | null> {
  const client = getGraphClient();

  try {
    const device = await client
      .api(`/deviceManagement/managedDevices/${deviceId}`)
      .select('deviceHealthAttestationState')
      .get();

    return device.deviceHealthAttestationState || null;
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch health attestation for device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Get device management troubleshooting events (action history)
 * 
 * @param deviceId Device ID from Intune
 * @returns Array of troubleshooting events
 */
export async function getDeviceActions(deviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/deviceManagementTroubleshootingEvents`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch device actions for device ${deviceId}:`, error);
    return [];
  }
}

/**
 * Get Azure AD groups for a device
 * 
 * @param azureAdDeviceId Azure AD Device ID (not the Intune managed device ID)
 * @returns Array of group memberships
 */
export async function getDeviceGroups(azureAdDeviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/devices/${azureAdDeviceId}/memberOf`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch groups for Azure AD device ${azureAdDeviceId}:`, error);
    return [];
  }
}

/**
 * Get device category for a specific device
 * 
 * @param deviceId Device ID from Intune
 * @returns Device category object or null
 */
export async function getDeviceCategory(deviceId: string): Promise<any | null> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/deviceCategory`)
      .get();

    return response;
  } catch (error: any) {
    // Device may not have a category assigned
    if (error.statusCode === 404) {
      return null;
    }
    console.error(`[Graph API] Failed to fetch device category for device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Get detected apps for a specific device
 * 
 * @param deviceId Device ID from Intune
 * @returns Array of detected apps
 */
export async function getDeviceDetectedApps(deviceId: string): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/detectedApps`)
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch detected apps for device ${deviceId}:`, error);
    return [];
  }
}

/**
 * Get endpoint analytics device performance data
 * 
 * @param deviceId Device ID from Intune
 * @returns Analytics data or null
 */
export async function getDeviceAnalytics(deviceId: string): Promise<any | null> {
  const client = getGraphClient();

  try {
    const response = await client
      .api('/deviceManagement/userExperienceAnalyticsDevicePerformance')
      .filter(`deviceId eq '${deviceId}'`)
      .get();

    return response.value?.[0] || null;
  } catch (error: any) {
    console.error(`[Graph API] Failed to fetch analytics for device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Get conditional access policies (global - not device-specific)
 * This is fetched once and then we determine which policies apply to devices
 * 
 * @returns Array of conditional access policies
 */
export async function getConditionalAccessPolicies(): Promise<any[]> {
  const client = getGraphClient();

  try {
    const response = await client
      .api('/identity/conditionalAccess/policies')
      .get();

    return response.value || [];
  } catch (error: any) {
    console.error('[Graph API] Failed to fetch conditional access policies:', error);
    return [];
  }
}

/**
 * Get managed devices using delta query for incremental sync
 * Delta queries return only changes since the last sync
 * 
 * @param deltaLink Optional delta link from previous query
 * @returns Object with devices and next delta link
 */
export async function getManagedDevicesDelta(deltaLink?: string): Promise<{
  devices: any[];
  deltaLink: string | null;
  nextLink: string | null;
}> {
  const client = getGraphClient();

  try {
    let response;
    
    if (deltaLink) {
      // Use the delta link from previous query
      response = await client.api(deltaLink).get();
    } else {
      // Initial delta query
      response = await client
        .api('/deviceManagement/managedDevices/delta')
        .get();
    }

    // Extract next delta link or next page link
    const nextDeltaLink = response['@odata.deltaLink'] || null;
    const nextPageLink = response['@odata.nextLink'] || null;

    return {
      devices: response.value || [],
      deltaLink: nextDeltaLink,
      nextLink: nextPageLink,
    };
  } catch (error: any) {
    console.error('[Graph API] Failed to fetch device delta:', error);
    throw new Error(
      `Failed to fetch device delta from Microsoft Graph: ${error.message}`
    );
  }
}

/**
 * Test Graph API connection
 * Makes a simple API call to verify credentials and permissions
 * 
 * @returns Success status and basic info
 */
export async function testGraphConnection(): Promise<{
  success: boolean;
  message: string;
  organization?: any;
}> {
  const client = getGraphClient();

  try {
    // Try to get organization info (requires Directory.Read.All)
    const org = await client.api('/organization').get();

    return {
      success: true,
      message: 'Successfully connected to Microsoft Graph API',
      organization: org.value?.[0] || null,
    };
  } catch (error: any) {
    console.error('[Graph API] Connection test failed:', error);
    return {
      success: false,
      message: error.message || 'Failed to connect to Microsoft Graph API',
    };
  }
}
