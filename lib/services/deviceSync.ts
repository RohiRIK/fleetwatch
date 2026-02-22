import { eq, or, ilike, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { devices, users, activityLogs, complianceHistory, storageHistory, device_groups, user_devices, device_analytics, device_compliance_policies } from '@/lib/db/schema';
import type { groupTypeEnum } from '@/lib/db/schema';
import {
  getManagedDevice,
  getManagedDevices,
  getManagedDevicesDelta,
  getDeviceCompliancePolicies,
  getDeviceConfigurationProfiles,
  getDeviceSecurityBaselines,
  getDeviceWindowsProtectionState,
  getDeviceHealthAttestation,
  getDeviceActions,
  getDeviceGroups,
  getDeviceCategory,
  getDeviceDetectedApps,
  getDeviceAnalytics,
} from '@/lib/graph/client';

/**
 * Helper function to log activity
 */
async function logActivity(action: string, entityType: string, entityId: string, metadata?: any) {
  try {
    await db.insert(activityLogs).values({
      action,
      entityType,
      entityId,
      metadata: metadata || null,
      ipAddress: null, // Server-side sync has no IP
      userId: null, // System action, not user-initiated
    });
  } catch (error) {
    console.error('[DeviceSync] Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break sync
  }
}

/**
 * Helper function to record compliance history snapshot
 */
async function recordComplianceSnapshot(deviceId: string, isCompliant: boolean, complianceState: string | null, complianceDetails: any) {
  try {
    // Extract failed policies from compliance_details
    const policyFailures = Array.isArray(complianceDetails) 
      ? complianceDetails.filter((policy: any) => policy.state !== 'compliant')
      : [];

    await db.insert(complianceHistory).values({
      deviceId,
      isCompliant,
      complianceState,
      policyFailures: policyFailures.length > 0 ? policyFailures : null,
    });
  } catch (error) {
    console.error('[DeviceSync] Failed to record compliance history:', error);
  }
}

/**
 * Helper function to record storage history snapshot
 */
async function recordStorageSnapshot(deviceId: string, storageTotal: number | null, storageFree: number | null) {
  try {
    if (storageTotal !== null && storageFree !== null) {
      const storageUsed = storageTotal - storageFree;
      const utilizationPercent = storageTotal > 0 
        ? Math.round((storageUsed / storageTotal) * 100) 
        : 0;

      await db.insert(storageHistory).values({
        deviceId,
        storageTotal,
        storageFree,
        storageUsed,
        utilizationPercent,
      });
    }
  } catch (error) {
    console.error('[DeviceSync] Failed to record storage history:', error);
  }
}

/**
 * Detect group type from Graph API group object
 * 
 * Graph API groups have these properties:
 * - groupTypes: ['Unified'] = Microsoft 365 group
 * - securityEnabled: true = Security group
 * - mailEnabled: true = Mail-enabled
 * 
 * @param group Graph API group object
 * @returns Group type enum value
 */
export function detectGroupType(group: {
  groupTypes?: string[];
  securityEnabled?: boolean;
  mailEnabled?: boolean;
}): typeof groupTypeEnum.enumValues[number] {
  const hasUnified = group.groupTypes?.includes('Unified');
  const isSecurityEnabled = group.securityEnabled ?? false;
  const isMailEnabled = group.mailEnabled ?? false;

  if (hasUnified) {
    return 'microsoft_365';
  }

  if (isSecurityEnabled && isMailEnabled) {
    return 'mail_enabled_security';
  }

  if (isMailEnabled && !isSecurityEnabled) {
    return 'distribution';
  }

  return 'security';
}

/**
 * Upsert device groups to database
 * 
 * Deletes existing groups for the device, then inserts new ones.
 * This ensures group memberships are always in sync with Azure AD.
 * 
 * @param deviceId Internal device ID (UUID)
 * @param groups Array of group objects from Graph API
 */
export async function upsertDeviceGroups(
  deviceId: string,
  groups: Array<{
    id: string;
    displayName?: string;
    groupTypes?: string[];
    securityEnabled?: boolean;
    mailEnabled?: boolean;
    membershipRule?: string | null;
    description?: string | null;
  }> | null
): Promise<void> {
  if (!groups || groups.length === 0) {
    await db.delete(device_groups).where(eq(device_groups.deviceId, deviceId));
    console.log(`[DeviceSync] Cleared groups for device ${deviceId} (no groups)`);
    return;
  }

  try {
    await db.delete(device_groups).where(eq(device_groups.deviceId, deviceId));

    for (const group of groups) {
      try {
        await db.insert(device_groups).values({
          deviceId,
          groupId: group.id,
          groupName: group.displayName || 'Unknown Group',
          groupType: detectGroupType(group),
          description: group.description || null,
          isDynamic: !!group.membershipRule,
          membershipRule: group.membershipRule || null,
        });
      } catch (insertError) {
        console.error(`[DeviceSync] Failed to insert group ${group.id} for device ${deviceId}:`, insertError);
      }
    }

    console.log(`[DeviceSync] Upserted ${groups.length} groups for device ${deviceId}`);
  } catch (error) {
    console.error(`[DeviceSync] Failed to upsert groups for device ${deviceId}:`, error);
  }
}

/**
 * Create or update user-device junction record
 * 
 * Creates a many-to-many relationship between users and devices.
 * Supports primary device flagging and relationship types.
 * 
 * @param userId Internal user ID (UUID) or null
 * @param deviceId Internal device ID (UUID) or null
 * @param isPrimary Whether this is the user's primary device
 * @param relationshipType Type of relationship (owner, user, shared)
 */
export async function upsertUserDevice(
  userId: string | null,
  deviceId: string | null,
  isPrimary: boolean = false,
  relationshipType: 'owner' | 'user' | 'shared' = 'owner'
): Promise<void> {
  if (!userId || !deviceId) {
    return;
  }

  try {
    const existing = await db
      .select()
      .from(user_devices)
      .where(
        and(
          eq(user_devices.userId, userId),
          eq(user_devices.deviceId, deviceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[DeviceSync] User-device junction already exists: user=${userId}, device=${deviceId}`);
      return;
    }

    await db.insert(user_devices).values({
      userId,
      deviceId,
      isPrimary,
      relationshipType,
      assignedAt: new Date(),
    });

    console.log(`[DeviceSync] Created user-device junction: user=${userId}, device=${deviceId}, primary=${isPrimary}, type=${relationshipType}`);
  } catch (error) {
    console.error(`[DeviceSync] Failed to create user-device junction:`, error);
  }
}

/**
 * Remove user-device junction record
 * 
 * @param userId Internal user ID (UUID) or null
 * @param deviceId Internal device ID (UUID) or null
 */
export async function removeUserDevice(
  userId: string | null,
  deviceId: string | null
): Promise<void> {
  if (!userId || !deviceId) {
    return;
  }

  try {
    await db
      .delete(user_devices)
      .where(
        and(
          eq(user_devices.userId, userId),
          eq(user_devices.deviceId, deviceId)
        )
      );

    console.log(`[DeviceSync] Removed user-device junction: user=${userId}, device=${deviceId}`);
  } catch (error) {
    console.error(`[DeviceSync] Failed to remove user-device junction:`, error);
  }
}

/**
 * Create or update device analytics record
 * 
 * Extracts endpoint analytics scores from Graph API response
 * and stores them in the device_analytics table.
 * 
 * @param deviceId Internal device ID (UUID)
 * @param analytics Analytics data from Graph API or null
 */
export async function upsertDeviceAnalytics(
  deviceId: string,
  analytics: any | null
): Promise<void> {
  if (!analytics) {
    return;
  }

  try {
    const existing = await db
      .select()
      .from(device_analytics)
      .where(eq(device_analytics.deviceId, deviceId))
      .limit(1);

    const analyticsData = {
      deviceId,
      overallScore: analytics.overallScore ?? null,
      startupScore: analytics.startupPerformance?.score ?? null,
      appReliabilityScore: analytics.appReliability?.score ?? null,
      batteryScore: analytics.batteryHealth?.score ?? null,
      workFromAnywhereScore: analytics.workFromAnywhere?.score ?? null,
      coreBootTimeMs: analytics.startupPerformance?.coreBootTimeInMs ?? null,
      coreLoginTimeMs: analytics.startupPerformance?.coreLoginTimeInMs ?? null,
      responsiveDesktopTimeMs: analytics.startupPerformance?.responsiveDesktopTimeInMs ?? null,
      restartCount: analytics.restartCount ?? null,
      blueScreenCount: analytics.blueScreenCount ?? null,
      meanTimeToFailureMinutes: analytics.meanTimeToFailureMinutes ?? null,
      healthStatus: analytics.healthStatus ?? null,
      diskType: analytics.diskType ?? null,
      modelPerformance: analytics.modelPerformance ?? null,
      rawAnalytics: analytics,
      recordedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(device_analytics)
        .set(analyticsData)
        .where(eq(device_analytics.deviceId, deviceId));

      console.log(`[DeviceSync] Updated device analytics for device ${deviceId}`);
    } else {
      await db.insert(device_analytics).values({
        ...analyticsData,
        createdAt: new Date(),
      });

      console.log(`[DeviceSync] Created device analytics for device ${deviceId}`);
    }
  } catch (error) {
    console.error(`[DeviceSync] Failed to upsert device analytics for device ${deviceId}:`, error);
  }
}

/**
 * Device Sync Service
 * 
 * Orchestrates syncing device data from Microsoft Graph API to local database
 * Handles full sync, incremental sync, and deep enrichment
 */

export type SyncMode = 'full' | 'incremental' | 'deep';

export interface SyncResult {
  success: boolean;
  mode: SyncMode;
  devicesProcessed: number;
  devicesCreated: number;
  devicesUpdated: number;
  devicesFailed: number;
  errors: Array<{ deviceId: string; error: string }>;
  durationMs: number;
}

/**
 * Sync all devices from Intune to local database
 * 
 * @param mode Sync mode: full (all devices), incremental (delta only), deep (full enrichment)
 * @returns Sync result summary
 */
export async function syncDevices(mode: SyncMode = 'full'): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: true,
    mode,
    devicesProcessed: 0,
    devicesCreated: 0,
    devicesUpdated: 0,
    devicesFailed: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    console.log(`[DeviceSync] Starting ${mode} sync...`);

    let rawDevices: any[] = [];

    if (mode === 'incremental') {
      // TODO: Implement delta sync with stored deltaLink
      // For now, fall back to full sync
      console.log('[DeviceSync] Delta sync not yet implemented, falling back to full sync');
      rawDevices = await getManagedDevices({ top: 999 });
    } else {
      // Full sync - get all devices
      rawDevices = await getManagedDevices({ top: 999 });
    }

    console.log(`[DeviceSync] Found ${rawDevices.length} devices in Intune`);

    // Process devices in parallel (with rate limiting)
    const BATCH_SIZE = 10; // Process 10 devices at a time
    const batches = [];
    
    for (let i = 0; i < rawDevices.length; i += BATCH_SIZE) {
      batches.push(rawDevices.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map((rawDevice) =>
        syncSingleDevice(rawDevice, mode)
          .then((syncResult) => {
            result.devicesProcessed++;
            if (syncResult.created) result.devicesCreated++;
            if (syncResult.updated) result.devicesUpdated++;
          })
          .catch(async (error) => {
            result.devicesFailed++;
            result.errors.push({
              deviceId: rawDevice.id || 'unknown',
              error: error.message,
            });
            console.error(`[DeviceSync] Failed to sync device ${rawDevice.id}:`, error);
            
            // Log sync failure
            await logActivity('SYNC_FAILED', 'DEVICE', rawDevice.id || 'unknown', {
              deviceName: rawDevice.deviceName || 'Unknown',
              error: error.message,
              syncMode: mode,
            });
          })
      );

      await Promise.all(promises);

      // Small delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    result.durationMs = Date.now() - startTime;
    console.log(
      `[DeviceSync] Completed ${mode} sync in ${result.durationMs}ms. ` +
      `Processed: ${result.devicesProcessed}, Created: ${result.devicesCreated}, ` +
      `Updated: ${result.devicesUpdated}, Failed: ${result.devicesFailed}`
    );

    return result;
  } catch (error: any) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    console.error('[DeviceSync] Sync failed:', error);
    throw error;
  }
}

/**
 * Sync a single device from Graph API to database
 * 
 * @param rawDevice Raw device object from Graph API
 * @param mode Sync mode (determines level of enrichment)
 * @returns Object indicating if device was created or updated
 */
async function syncSingleDevice(
  rawDevice: any,
  mode: SyncMode
): Promise<{ created: boolean; updated: boolean }> {
  const azureId = rawDevice.id;

  // Check if device exists
  const existingDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.azureId, azureId))
    .limit(1);

  const existingDevice = existingDevices[0];
  const isNewDevice = !existingDevice;

  // Transform raw device data to database format
  const deviceData = await transformDeviceData(rawDevice, mode);

  if (isNewDevice) {
    // Insert new device
    const [newDevice] = await db.insert(devices).values(deviceData).returning({ id: devices.id });
    console.log(`[DeviceSync] Created device: ${rawDevice.deviceName} (${azureId})`);
    
    // Log device enrollment
    await logActivity('DEVICE_ENROLLED', 'DEVICE', newDevice.id, {
      deviceName: rawDevice.deviceName,
      manufacturer: rawDevice.manufacturer,
      model: rawDevice.model,
      operatingSystem: rawDevice.operatingSystem,
    });
    
    // Record initial compliance snapshot
    if (newDevice.id && deviceData.isCompliant !== undefined) {
      await recordComplianceSnapshot(
        newDevice.id, 
        deviceData.isCompliant, 
        deviceData.complianceState || null,
        deviceData.complianceDetails
      );
    }
    
    // Record initial storage snapshot
    if (newDevice.id && deviceData.storageTotal) {
      await recordStorageSnapshot(newDevice.id, deviceData.storageTotal, deviceData.storageFree || null);
    }
    
    // Upsert device groups if available (deep mode)
    if (newDevice.id && deviceData.organizationDetails?.groups) {
      await upsertDeviceGroups(newDevice.id, deviceData.rawGroups || null);
    }
    
    // Create user-device junction if user is assigned
    if (newDevice.id && deviceData.userId) {
      await upsertUserDevice(deviceData.userId, newDevice.id, true, 'owner');
    }
    
    // Upsert device analytics if available (deep mode)
    if (newDevice.id && deviceData.rawAnalytics) {
      await upsertDeviceAnalytics(newDevice.id, deviceData.rawAnalytics);
    }
    
    return { created: true, updated: false };
  } else {
    // Check for compliance state change
    const complianceChanged = existingDevice.isCompliant !== deviceData.isCompliant;
    
    // Update existing device
    await db
      .update(devices)
      .set({
        ...deviceData,
        updatedAt: new Date(),
      })
      .where(eq(devices.azureId, azureId));

    console.log(`[DeviceSync] Updated device: ${rawDevice.deviceName} (${azureId})`);
    
    // Log compliance state change
    if (complianceChanged) {
      await logActivity('COMPLIANCE_CHANGED', 'DEVICE', existingDevice.id, {
        deviceName: rawDevice.deviceName,
        oldState: existingDevice.complianceState,
        newState: deviceData.complianceState,
        isCompliant: deviceData.isCompliant,
      });
      
      // Record compliance snapshot only when it changes
      await recordComplianceSnapshot(
        existingDevice.id,
        deviceData.isCompliant,
        deviceData.complianceState || null,
        deviceData.complianceDetails
      );
    }
    
    // Record storage snapshot (always, for trend analysis)
    if (deviceData.storageTotal) {
      await recordStorageSnapshot(existingDevice.id, deviceData.storageTotal, deviceData.storageFree || null);
    }
    
    // Upsert device groups if available (deep mode)
    if (existingDevice.id && deviceData.organizationDetails?.groups) {
      await upsertDeviceGroups(existingDevice.id, deviceData.rawGroups || null);
    }
    
    // Create user-device junction if user is assigned (idempotent - skips if exists)
    if (existingDevice.id && deviceData.userId) {
      await upsertUserDevice(deviceData.userId, existingDevice.id, false, 'owner');
    }
    
    // Upsert device analytics if available (deep mode)
    if (existingDevice.id && deviceData.rawAnalytics) {
      await upsertDeviceAnalytics(existingDevice.id, deviceData.rawAnalytics);
    }
    
    return { created: false, updated: true };
  }
}

/**
 * Transform raw Graph API device data into database format
 * 
 * @param rawDevice Raw device from Graph API
 * @param mode Sync mode (deep mode fetches additional enrichment data)
 * @returns Device data formatted for database insertion
 */
async function transformDeviceData(rawDevice: any, mode: SyncMode) {
  // Look up user ID based on userPrincipalName or email
  let userId: string | null = null;
  const userPrincipalName = rawDevice.userPrincipalName;
  const userEmail = rawDevice.emailAddress;
  
  if (userPrincipalName || userEmail) {
    try {
      const userLookup = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            userPrincipalName ? ilike(users.email, userPrincipalName) : undefined,
            userEmail ? ilike(users.email, userEmail) : undefined
          )
        )
        .limit(1);
      
      if (userLookup.length > 0) {
        userId = userLookup[0].id;
        console.log(`[DeviceSync] Linked device ${rawDevice.deviceName} to user ${userPrincipalName || userEmail}`);
      } else {
        console.log(`[DeviceSync] No user found for ${userPrincipalName || userEmail}`);
      }
    } catch (error) {
      console.error(`[DeviceSync] Error looking up user:`, error);
    }
  }
  
  // Extract basic device info
  const deviceData: any = {
    azureId: rawDevice.id,
    azureAdDeviceId: rawDevice.azureAdDeviceId || null,
    deviceName: rawDevice.deviceName || 'Unknown Device',
    serialNumber: rawDevice.serialNumber || null,
    userId: userId, // Linked to user if found
    
    // Basic info
    manufacturer: rawDevice.manufacturer || null,
    model: rawDevice.model || null,
    operatingSystem: rawDevice.operatingSystem || null,
    osVersion: rawDevice.osVersion || null,
    
    // Enrollment
    joinType: rawDevice.joinType || null,
    enrollmentType: rawDevice.enrollmentType || null,
    managementState: rawDevice.managementState || null,
    managedDeviceOwnerType: rawDevice.managedDeviceOwnerType || null,
    enrolledAt: rawDevice.enrolledDateTime ? new Date(rawDevice.enrolledDateTime) : null,
    
    // Compliance
    isCompliant: rawDevice.complianceState === 'compliant',
    complianceState: rawDevice.complianceState || null,
    isEncrypted: rawDevice.isEncrypted || false,
    isSupervised: rawDevice.isSupervised || false,
    jailBroken: rawDevice.jailBroken || null,
    complianceGracePeriodExpiration: rawDevice.complianceGracePeriodExpirationDateTime 
      ? new Date(rawDevice.complianceGracePeriodExpirationDateTime) 
      : null,
    partnerReportedThreatState: rawDevice.partnerReportedThreatState || null,
    
    // User info (denormalized)
    userPrincipalName: rawDevice.userPrincipalName || null,
    userDisplayName: rawDevice.userDisplayName || null,
    userEmail: rawDevice.emailAddress || null,
    userDepartment: null, // Will be enriched from user data
    
    // Hardware
    storageTotal: rawDevice.totalStorageSpaceInBytes || null,
    storageFree: rawDevice.freeStorageSpaceInBytes || null,
    memoryTotal: rawDevice.physicalMemoryInBytes || null,
    batteryHealth: null, // Not directly available in basic device object
    chassisType: rawDevice.chassisType || null,
    notes: null, // Admin-populated field, remains null from sync
    imei: rawDevice.imei || null, // Mobile device IMEI
    phoneNumber: rawDevice.phoneNumber || null, // Mobile device phone number
    
    // Network
    ipAddressV4: rawDevice.wiFiMacAddress ? null : rawDevice.ipAddressV4 || null, // Prefer WiFi MAC
    wifiMac: rawDevice.wiFiMacAddress || null,
    ethernetMac: rawDevice.ethernetMacAddress || null,
    
    // Store full raw device data
    rawDeviceData: rawDevice,

    // ========== PHASE 3: EXTENDED HARDWARE FIELDS ==========
    // Hardware deep dive
    meid: rawDevice.meid || null,
    iccid: rawDevice.iccid || null,
    udid: rawDevice.udid || null,
    subscriberCarrier: rawDevice.subscriberCarrier || null,
    batterySerialNumber: rawDevice.hardwareInformation?.batterySerialNumber || null,
    batteryChargeCycles: rawDevice.hardwareInformation?.batteryChargeCycles || null,
    batteryLevelPercentage: rawDevice.hardwareInformation?.batteryLevelPercentage || null,
    residentUsersCount: rawDevice.residentUsersCount || null,
    productName: rawDevice.productName || null,
    deviceFullQualifiedDomainName: rawDevice.deviceFullQualifiedDomainName || null,

    // Management
    managementAgent: rawDevice.managementAgent || null,
    managementCertificateExpirationDate: rawDevice.managementCertificateExpirationDateTime
      ? new Date(rawDevice.managementCertificateExpirationDateTime)
      : null,
    managementFeatures: rawDevice.managementFeatures || null,
    remoteAssistanceSessionUrl: rawDevice.remoteAssistanceSessionUrl || null,
    remoteAssistanceSessionErrorDetails: rawDevice.remoteAssistanceSessionErrorDetails || null,
    requireUserEnrollmentApproval: rawDevice.requireUserEnrollmentApproval || null,
    enrollmentProfileName: rawDevice.enrollmentProfileName || null,

    // Security hardware
    tpmPresent: rawDevice.tpmPresent || null,
    secureBootEnabled: rawDevice.secureBootEnabled || null,
    codeIntegrityEnabled: rawDevice.codeIntegrityEnabled || null,
    bootDebuggingEnabled: rawDevice.bootDebuggingEnabled || null,

    // Exchange ActiveSync
    easActivated: rawDevice.easActivated || null,
    easDeviceId: rawDevice.easDeviceId || null,
    exchangeLastSuccessfulSyncDateTime: rawDevice.exchangeLastSuccessfulSyncDateTime
      ? new Date(rawDevice.exchangeLastSuccessfulSyncDateTime)
      : null,

    // Malware protection
    malwareActiveCount: rawDevice.malwareActiveCount || null,
    malwareRemediatedCount: rawDevice.malwareRemediatedCount || null,

    // Timestamps
    lastSyncAt: new Date(),
  };

  // Deep enrichment: Fetch additional data from Graph API
  if (mode === 'deep') {
    console.log(`[DeviceSync] Performing deep enrichment for device ${rawDevice.id}`);
    
    try {
      // Fetch all enrichment data in parallel
      const [
        compliancePolicies,
        configProfiles,
        securityBaselines,
        windowsProtection,
        healthAttestation,
        actionsHistory,
        deviceCategory,
        detectedApps,
        analytics,
      ] = await Promise.all([
        getDeviceCompliancePolicies(rawDevice.id),
        getDeviceConfigurationProfiles(rawDevice.id),
        getDeviceSecurityBaselines(rawDevice.id),
        getDeviceWindowsProtectionState(rawDevice.id),
        getDeviceHealthAttestation(rawDevice.id),
        getDeviceActions(rawDevice.id),
        getDeviceCategory(rawDevice.id),
        getDeviceDetectedApps(rawDevice.id),
        getDeviceAnalytics(rawDevice.id),
      ]);

      // Enrich JSONB columns
      // Enrich compliance policies with policy definition details (settings) from DB
      const enrichedComplianceDetails = await Promise.all(
        compliancePolicies.map(async (policyState: any) => {
          try {
            // Look up policy definition from synced policies in database
            const [policyDefinition] = await db
              .select({ rawPolicyData: device_compliance_policies.rawPolicyData })
              .from(device_compliance_policies)
              .where(eq(device_compliance_policies.id, policyState.id))
              .limit(1);
            
            const settings = policyDefinition?.rawPolicyData as any;
            return {
              ...policyState,
              policySettings: settings ? {
                passwordRequired: settings.passwordRequired,
                passwordMinimumLength: settings.passwordMinimumLength,
                passwordExpirationDays: settings.passwordExpirationDays,
                osMinimumVersion: settings.osMinimumVersion,
                osMaximumVersion: settings.osMaximumVersion,
                bitLockerEnabled: settings.bitLockerEnabled,
                secureBootEnabled: settings.secureBootEnabled,
                codeIntegrityEnabled: settings.codeIntegrityEnabled,
                storageRequireEncryption: settings.storageRequireEncryption,
                requireHealthyDeviceReport: settings.requireHealthyDeviceReport,
                earlyLaunchAntiMalwareDriverEnabled: settings.earlyLaunchAntiMalwareDriverEnabled,
                deviceThreatProtectionEnabled: settings.deviceThreatProtectionEnabled,
                deviceThreatProtectionRequiredSecurityLevel: settings.deviceThreatProtectionRequiredSecurityLevel,
                passcodeBlockSimple: settings.passcodeBlockSimple,
                passcodeMinimumLength: settings.passcodeMinimumLength,
                firewallEnabled: settings.firewallEnabled,
                fileVaultEnabled: settings.fileVaultEnabled,
                safetyNetDeviceAttestationEnabled: settings.safetyNetDeviceAttestationEnabled,
                securityPatchLevelRequired: settings.securityPatchLevelRequired,
              } : null,
            };
          } catch (error) {
            console.error(`[DeviceSync] Failed to get policy definition for ${policyState.id}:`, error);
            return policyState;
          }
        })
      );
      
      deviceData.complianceDetails = enrichedComplianceDetails.length > 0 ? enrichedComplianceDetails : null;
      deviceData.configurationDetails = configProfiles.length > 0 ? configProfiles : null;
      deviceData.securityDetails = {
        baselines: securityBaselines,
        windowsProtection,
        healthAttestation,
      };
      deviceData.actionsHistory = actionsHistory.length > 0 ? actionsHistory : null;
      deviceData.organizationDetails = deviceCategory ? { category: deviceCategory } : null;
      deviceData.detectedAppsDetails = detectedApps.length > 0 ? detectedApps : null;
      deviceData.analyticsDetails = analytics;
      deviceData.rawAnalytics = analytics;

      // Fetch Azure AD groups if we have the Azure AD device ID
      let rawGroups: any[] = [];
      if (rawDevice.azureAdDeviceId) {
        try {
          rawGroups = await getDeviceGroups(rawDevice.azureAdDeviceId);
          if (rawGroups.length > 0) {
            deviceData.organizationDetails = {
              ...deviceData.organizationDetails,
              groups: rawGroups.map((g: any) => ({
                id: g.id,
                displayName: g.displayName,
              })),
            };
            // Store raw groups for device_groups table insertion
            deviceData.rawGroups = rawGroups;
          }
        } catch (error) {
          console.error(`[DeviceSync] Failed to fetch groups for device ${rawDevice.id}:`, error);
        }
      }

      // Extract hardware details from raw device
      deviceData.hardwareDetails = {
        imei: rawDevice.imei || null,
        meid: rawDevice.meid || null,
        subscriberCarrier: rawDevice.subscriberCarrier || null,
        cellularTechnology: rawDevice.cellularTechnology || null,
        wifiMacAddress: rawDevice.wiFiMacAddress || null,
        ethernetMacAddress: rawDevice.ethernetMacAddress || null,
        deviceGuardVirtualizationBasedSecurity: rawDevice.deviceGuardVirtualizationBasedSecurityHardwareRequirementState || null,
        deviceGuardLocalSystemAuthority: rawDevice.deviceGuardLocalSystemAuthorityCredentialGuardState || null,
      };

      // Extract network details
      deviceData.networkDetails = {
        ipAddressV4: rawDevice.ipAddressV4 || null,
        ipAddressV6: null, // Not available in basic device object
        subnetAddress: null,
        isNetworkDeployed: rawDevice.isNetworkDeployed || false,
      };

      // Exchange ActiveSync details
      if (rawDevice.easActivated || rawDevice.easDeviceId) {
        deviceData.exchangeActivesyncDetails = {
          activated: rawDevice.easActivated || false,
          activationDate: rawDevice.easActivationDateTime || null,
          deviceId: rawDevice.easDeviceId || null,
        };
      }

      // Autopilot details
      if (rawDevice.autopilotEnrolled) {
        deviceData.autopilotDetails = {
          enrolled: rawDevice.autopilotEnrolled,
          groupTag: rawDevice.groupTag || null,
        };
      }

      // Lost mode (iOS)
      if (rawDevice.lostModeState) {
        deviceData.lostModeDetails = {
          state: rawDevice.lostModeState,
          isEnabled: rawDevice.lostModeState === 'enabled',
        };
      }

      // Data quality indicators
      deviceData.dataQuality = {
        hasComplianceData: compliancePolicies.length > 0,
        hasConfigurationData: configProfiles.length > 0,
        hasSecurityData: !!windowsProtection || !!healthAttestation,
        hasAnalyticsData: !!analytics,
        hasAppsData: detectedApps.length > 0,
        lastEnrichmentAt: new Date().toISOString(),
      };

      // Ingestion metadata
      deviceData.ingestionMetadata = {
        syncMode: mode,
        enriched: true,
        enrichmentTimestamp: new Date().toISOString(),
        graphApiVersion: 'v1.0',
      };

    } catch (error) {
      console.error(`[DeviceSync] Deep enrichment failed for device ${rawDevice.id}:`, error);
      
      // Add partial enrichment metadata
      deviceData.ingestionMetadata = {
        syncMode: mode,
        enriched: false,
        enrichmentError: (error as Error).message,
        enrichmentTimestamp: new Date().toISOString(),
        graphApiVersion: 'v1.0',
      };
    }
  } else {
    // Basic or incremental sync - minimal metadata
    deviceData.ingestionMetadata = {
      syncMode: mode,
      enriched: false,
      syncTimestamp: new Date().toISOString(),
      graphApiVersion: 'v1.0',
    };
  }

  return deviceData;
}

/**
 * Sync a single device by Azure ID
 * Useful for on-demand sync or webhook-triggered updates
 * 
 * @param azureId Azure/Intune device ID
 * @param mode Sync mode
 * @returns Success status
 */
export async function syncDeviceById(azureId: string, mode: SyncMode = 'deep'): Promise<boolean> {
  try {
    console.log(`[DeviceSync] Syncing single device: ${azureId}`);
    
    const rawDevice = await getManagedDevice(azureId);
    await syncSingleDevice(rawDevice, mode);
    
    console.log(`[DeviceSync] Successfully synced device ${azureId}`);
    return true;
  } catch (error) {
    console.error(`[DeviceSync] Failed to sync device ${azureId}:`, error);
    return false;
  }
}
