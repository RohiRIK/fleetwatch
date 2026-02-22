import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  conditional_access_policies,
  named_locations,
  device_compliance_policies,
  device_compliance_policy_states,
  device_configuration_profiles,
  device_configuration_profile_states,
  device_conditional_access,
  devices,
} from '@/lib/db/schema';
import {
  getConditionalAccessPolicies,
  getNamedLocations,
  getDeviceCompliancePoliciesList,
  getDeviceConfigurations,
  getConfigurationPolicies,
  getDeviceCompliancePolicies,
  getDeviceConfigurationProfiles,
} from '@/lib/graph/client';

export type PlatformType = 'android' | 'iOS' | 'windows' | 'macOS' | 'linux' | 'unknown';

export function detectPlatformType(odataType?: string): PlatformType {
  if (!odataType) return 'unknown';
  
  const type = odataType.toLowerCase();
  
  if (type.includes('android')) return 'android';
  if (type.includes('ios') || type.includes('ipad') || type.includes('iphone')) return 'iOS';
  if (type.includes('windows')) return 'windows';
  if (type.includes('macos') || type.includes('mac')) return 'macOS';
  if (type.includes('linux')) return 'linux';
  
  return 'unknown';
}

export function detectLocationType(odataType?: string): 'ip' | 'country' {
  if (!odataType) return 'ip';
  return odataType.toLowerCase().includes('ip') ? 'ip' : 'country';
}

export function detectPolicyState(state?: string): 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced' {
  if (!state) return 'disabled';
  if (state === 'enabled') return 'enabled';
  if (state === 'enabledForReportingButNotEnforced') return 'enabledForReportingButNotEnforced';
  return 'disabled';
}

export async function upsertConditionalAccessPolicy(policy: {
  id: string;
  displayName?: string;
  description?: string | null;
  state?: string;
  createdDateTime?: string | null;
  modifiedDateTime?: string | null;
  conditions?: any;
  grantControls?: any;
  sessionControls?: any;
}): Promise<void> {
  try {
    await db
      .insert(conditional_access_policies)
      .values({
        id: policy.id,
        displayName: policy.displayName || 'Unnamed Policy',
        description: policy.description || null,
        state: detectPolicyState(policy.state),
        createdDateTime: policy.createdDateTime ? new Date(policy.createdDateTime) : null,
        modifiedDateTime: policy.modifiedDateTime ? new Date(policy.modifiedDateTime) : null,
        conditions: policy.conditions || null,
        grantControls: policy.grantControls || null,
        sessionControls: policy.sessionControls || null,
        isEnabled: policy.state === 'enabled',
        isReportOnly: policy.state === 'enabledForReportingButNotEnforced',
      })
      .onConflictDoUpdate({
        target: conditional_access_policies.id,
        set: {
          displayName: policy.displayName || 'Unnamed Policy',
          description: policy.description || null,
          state: detectPolicyState(policy.state),
          modifiedDateTime: policy.modifiedDateTime ? new Date(policy.modifiedDateTime) : null,
          conditions: policy.conditions || null,
          grantControls: policy.grantControls || null,
          sessionControls: policy.sessionControls || null,
          isEnabled: policy.state === 'enabled',
          isReportOnly: policy.state === 'enabledForReportingButNotEnforced',
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`[PolicySync] Failed to upsert CA policy ${policy.id}:`, error);
    throw error;
  }
}

export async function syncConditionalAccessPolicies(): Promise<number> {
  const policies = await getConditionalAccessPolicies();
  
  let synced = 0;
  
  for (const policy of policies) {
    await upsertConditionalAccessPolicy(policy);
    synced++;
  }
  
  console.log(`[PolicySync] Synced ${synced} conditional access policies`);
  return synced;
}

export async function upsertNamedLocation(location: {
  id: string;
  displayName?: string;
  '@odata.type'?: string;
  isTrusted?: boolean;
  ipRanges?: Array<{ '@odata.type'?: string; cidrAddress?: string }>;
  countriesAndRegions?: string[];
  includeUnknownCountriesAndRegions?: boolean;
  createdDateTime?: string | null;
  modifiedDateTime?: string | null;
}): Promise<void> {
  const cleanedIpRanges = location.ipRanges
    ?.filter(ip => ip.cidrAddress)
    ?.map(ip => ({ cidrAddress: ip.cidrAddress as string })) || null;

  try {
    await db
      .insert(named_locations)
      .values({
        id: location.id,
        displayName: location.displayName || 'Unnamed Location',
        locationType: detectLocationType(location['@odata.type']),
        isTrusted: location.isTrusted || false,
        ipRanges: cleanedIpRanges,
        countriesAndRegions: location.countriesAndRegions || null,
        includeUnknownCountriesAndRegions: location.includeUnknownCountriesAndRegions || false,
        createdDateTime: location.createdDateTime ? new Date(location.createdDateTime) : null,
        modifiedDateTime: location.modifiedDateTime ? new Date(location.modifiedDateTime) : null,
      })
      .onConflictDoUpdate({
        target: named_locations.id,
        set: {
          displayName: location.displayName || 'Unnamed Location',
          isTrusted: location.isTrusted || false,
          ipRanges: cleanedIpRanges,
          countriesAndRegions: location.countriesAndRegions || null,
          includeUnknownCountriesAndRegions: location.includeUnknownCountriesAndRegions || false,
          modifiedDateTime: location.modifiedDateTime ? new Date(location.modifiedDateTime) : null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`[PolicySync] Failed to upsert named location ${location.id}:`, error);
    throw error;
  }
}

export async function syncNamedLocations(): Promise<number> {
  const locations = await getNamedLocations();
  
  let synced = 0;
  
  for (const location of locations) {
    await upsertNamedLocation(location);
    synced++;
  }
  
  console.log(`[PolicySync] Synced ${synced} named locations`);
  return synced;
}

export async function upsertDeviceCompliancePolicy(policy: {
  id: string;
  displayName?: string;
  description?: string | null;
  '@odata.type'?: string;
  version?: number | null;
  createdDateTime?: string | null;
  modifiedDateTime?: string | null;
  [key: string]: any;
}): Promise<void> {
  try {
    await db
      .insert(device_compliance_policies)
      .values({
        id: policy.id,
        odataType: policy['@odata.type'] || null,
        displayName: policy.displayName || 'Unnamed Policy',
        description: policy.description || null,
        platformType: detectPlatformType(policy['@odata.type']),
        version: policy.version || null,
        createdDateTime: policy.createdDateTime ? new Date(policy.createdDateTime) : null,
        modifiedDateTime: policy.modifiedDateTime ? new Date(policy.modifiedDateTime) : null,
        rawPolicyData: policy,
      })
      .onConflictDoUpdate({
        target: device_compliance_policies.id,
        set: {
          displayName: policy.displayName || 'Unnamed Policy',
          description: policy.description || null,
          platformType: detectPlatformType(policy['@odata.type']),
          version: policy.version || null,
          modifiedDateTime: policy.modifiedDateTime ? new Date(policy.modifiedDateTime) : null,
          rawPolicyData: policy,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`[PolicySync] Failed to upsert compliance policy ${policy.id}:`, error);
    throw error;
  }
}

export async function syncDeviceCompliancePolicies(): Promise<number> {
  const policies = await getDeviceCompliancePoliciesList();
  
  let synced = 0;
  
  for (const policy of policies) {
    await upsertDeviceCompliancePolicy(policy);
    synced++;
  }
  
  console.log(`[PolicySync] Synced ${synced} device compliance policies`);
  return synced;
}

export async function upsertDeviceConfigurationProfile(profile: {
  id: string;
  displayName?: string;
  description?: string | null;
  '@odata.type'?: string;
  profileType?: string | null;
  version?: number | null;
  createdDateTime?: string | null;
  modifiedDateTime?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(device_configuration_profiles)
      .values({
        id: profile.id,
        odataType: profile['@odata.type'] || null,
        displayName: profile.displayName || 'Unnamed Profile',
        description: profile.description || null,
        platformType: detectPlatformType(profile['@odata.type']),
        profileType: profile.profileType || null,
        version: profile.version || null,
        createdDateTime: profile.createdDateTime ? new Date(profile.createdDateTime) : null,
        modifiedDateTime: profile.modifiedDateTime ? new Date(profile.modifiedDateTime) : null,
      })
      .onConflictDoUpdate({
        target: device_configuration_profiles.id,
        set: {
          displayName: profile.displayName || 'Unnamed Profile',
          description: profile.description || null,
          platformType: detectPlatformType(profile['@odata.type']),
          profileType: profile.profileType || null,
          version: profile.version || null,
          modifiedDateTime: profile.modifiedDateTime ? new Date(profile.modifiedDateTime) : null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`[PolicySync] Failed to upsert configuration profile ${profile.id}:`, error);
    throw error;
  }
}

export async function syncDeviceConfigurationProfiles(): Promise<number> {
  const [configs, configPolicies] = await Promise.all([
    getDeviceConfigurations(),
    getConfigurationPolicies(),
  ]);
  
  let synced = 0;
  
  for (const profile of configs) {
    await upsertDeviceConfigurationProfile(profile);
    synced++;
  }
  
  for (const profile of configPolicies) {
    await upsertDeviceConfigurationProfile(profile);
    synced++;
  }
  
  console.log(`[PolicySync] Synced ${synced} device configuration profiles`);
  return synced;
}

export async function syncDeviceCompliancePolicyStates(
  deviceId: string,
  azureDeviceId: string
): Promise<number> {
  const states = await getDeviceCompliancePolicies(azureDeviceId);
  
  const device = await db.query.devices.findFirst({
    where: eq(devices.azureId, azureDeviceId),
  });
  
  if (!device) {
    console.warn(`[PolicySync] Device not found for azureId: ${azureDeviceId}`);
    return 0;
  }
  
  let synced = 0;
  
  await db
    .delete(device_compliance_policy_states)
    .where(eq(device_compliance_policy_states.deviceId, device.id));
  
  for (const state of states) {
    await db
      .insert(device_compliance_policy_states)
      .values({
        deviceId: device.id,
        policyId: state.id,
        policyName: state.name || null,
        platformType: detectPlatformType(state.platformType),
        state: state.state || null,
        errorCode: state.errorCode || null,
        errorDescription: state.errorDescription || null,
        lastReportedDateTime: state.lastReportedDateTime ? new Date(state.lastReportedDateTime) : null,
        complianceGracePeriodExpirationDateTime: state.complianceGracePeriodExpirationDateTime
          ? new Date(state.complianceGracePeriodExpirationDateTime)
          : null,
      });
    synced++;
  }
  
  return synced;
}

export async function syncDeviceConfigurationProfileStates(
  deviceId: string,
  azureDeviceId: string
): Promise<number> {
  const states = await getDeviceConfigurationProfiles(azureDeviceId);
  
  const device = await db.query.devices.findFirst({
    where: eq(devices.azureId, azureDeviceId),
  });
  
  if (!device) {
    console.warn(`[PolicySync] Device not found for azureId: ${azureDeviceId}`);
    return 0;
  }
  
  let synced = 0;
  
  await db
    .delete(device_configuration_profile_states)
    .where(eq(device_configuration_profile_states.deviceId, device.id));
  
  for (const state of states) {
    await db
      .insert(device_configuration_profile_states)
      .values({
        deviceId: device.id,
        profileId: state.id,
        profileName: state.name || null,
        platformType: detectPlatformType(state.platformType),
        state: state.state || null,
        stateDetail: state.stateDetail || null,
        errorCode: state.errorCode || null,
        errorDescription: state.errorDescription || null,
        reportedDateTime: state.reportedDateTime ? new Date(state.reportedDateTime) : new Date(),
      });
    synced++;
  }
  
  return synced;
}

export async function syncAllPolicies(): Promise<{
  conditionalAccess: number;
  namedLocations: number;
  compliancePolicies: number;
  configurationProfiles: number;
  totalPolicies: number;
}> {
  const [caPolicies, locations, compliancePolicies, configProfiles] = await Promise.all([
    syncConditionalAccessPolicies(),
    syncNamedLocations(),
    syncDeviceCompliancePolicies(),
    syncDeviceConfigurationProfiles(),
  ]);
  
  const totalPolicies = caPolicies + locations + compliancePolicies + configProfiles;
  
  return {
    conditionalAccess: caPolicies,
    namedLocations: locations,
    compliancePolicies,
    configurationProfiles: configProfiles,
    totalPolicies,
  };
}
