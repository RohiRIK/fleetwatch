import { eq, or, ilike } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { devices, users, activityLogs, complianceHistory, storageHistory } from '@/lib/db/schema';
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
      deviceData.complianceDetails = compliancePolicies.length > 0 ? compliancePolicies : null;
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

      // Fetch Azure AD groups if we have the Azure AD device ID
      if (rawDevice.azureAdDeviceId) {
        try {
          const groups = await getDeviceGroups(rawDevice.azureAdDeviceId);
          if (groups.length > 0) {
            deviceData.organizationDetails = {
              ...deviceData.organizationDetails,
              groups: groups.map((g: any) => ({
                id: g.id,
                displayName: g.displayName,
              })),
            };
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
