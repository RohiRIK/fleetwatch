// Device Normalizer - Correlates all data sources into UnifiedDeviceDocument
import type { UnifiedDeviceDocument, DeviceConfigurationReference, UpdatedDeviceConfigurationField, DeviceCompliancePolicyReference, UpdatedDeviceComplianceField } from '../schemas/device.schema';
import type { Client } from '@opensearch-project/opensearch';
import { ConfigurationRepository, normalizePlatform, createConfigurationReference } from '../repositories/configuration.repository';
import { ComplianceRepository, normalizeCompliancePlatform, calculateComplianceContentHash, createComplianceReference, extractComplianceStatus } from '../repositories/compliance.repository';

// Raw data interfaces from fetcher output
interface FetcherOutput {
  managedDevices: any[];
  deviceScores?: any[];
  startupPerformance?: any[];
  appReliability?: any[];
  batteryHealth?: any[];
  deviceComplianceStatus?: Record<string, any[]>;
  deviceConfigurationStatus?: Record<string, any[]>;
  compliancePolicies?: any[];
  configurationPolicies?: any[];
  users?: any[];
  securityAccess?: {
    deviceActionHistory?: Record<string, any[]>;
    windowsProtectionState?: Record<string, any>;
    conditionalAccessPolicies?: any[];
    namedLocations?: any[];
    deviceCategories?: any[];
    deviceCategoryAssignments?: Record<string, any>;
    deviceGroupMemberships?: Record<string, any[]>;
    securityBaselines?: any[];
    deviceHealthAttestation?: Record<string, any>;
  };
  crashes?: any[];
  warranty?: any[];
  [key: string]: any;
}

interface NormalizerOptions {
  includeRawData?: boolean; // For debugging
  validateRequired?: boolean; // Strict validation
  enableDualWrite?: boolean; // Enable dual-write mode (Phase 2)
  opensearchClient?: Client; // OpenSearch client for dual-write
}

export class DeviceNormalizer {
  private usersById: Map<string, any> = new Map();
  private usersByUpn: Map<string, any> = new Map();
  private compliancePoliciesById: Map<string, any> = new Map();
  private configPoliciesById: Map<string, any> = new Map();
  private categoriesById: Map<string, any> = new Map();
  private deviceScoresById: Map<string, any> = new Map();
  private startupById: Map<string, any> = new Map();
  private batteryById: Map<string, any> = new Map();
  private crashesByDevice: Map<string, any[]> = new Map();
  private warrantyBySerial: Map<string, any> = new Map();
  private configRepo?: ConfigurationRepository;
  private complianceRepo?: ComplianceRepository;
  private profileVersions: Map<string, number> = new Map(); // Cache profile versions during normalization
  private policyVersions: Map<string, number> = new Map(); // Cache compliance policy versions
  private debugLogged: boolean = false; // Debug flag to log once
  private deviceDebugLogged: boolean = false; // Debug flag for device normalization
  private deviceDebugLogged2: boolean = false; // Debug flag for compliance result

  constructor(private data: FetcherOutput, private options: NormalizerOptions = {}) {
    this.buildLookupMaps();

    // Initialize repositories if dual-write is enabled
    if (this.options.enableDualWrite && this.options.opensearchClient) {
      this.configRepo = new ConfigurationRepository(this.options.opensearchClient);
      this.complianceRepo = new ComplianceRepository(this.options.opensearchClient);
    }
  }

  /**
   * Build lookup maps for fast correlation
   */
  private buildLookupMaps(): void {
    // Users lookup
    if (this.data.users) {
      for (const user of this.data.users) {
        if (user.id) this.usersById.set(user.id, user);
        if (user.userPrincipalName) this.usersByUpn.set(user.userPrincipalName.toLowerCase(), user);
      }
    }

    // Compliance policies lookup
    if (this.data.compliancePolicies) {
      for (const policy of this.data.compliancePolicies) {
        if (policy.id) this.compliancePoliciesById.set(policy.id, policy);
      }
    }

    // Configuration policies lookup
    if (this.data.configurationPolicies) {
      for (const policy of this.data.configurationPolicies) {
        if (policy.id) this.configPoliciesById.set(policy.id, policy);
      }
    }

    // Device categories lookup
    if (this.data.securityAccess?.deviceCategories) {
      for (const cat of this.data.securityAccess.deviceCategories) {
        if (cat.id) this.categoriesById.set(cat.id, cat);
      }
    }

    // Device scores lookup (by device name)
    if (this.data.deviceScores) {
      for (const score of this.data.deviceScores) {
        if (score.deviceName) {
          this.deviceScoresById.set(score.deviceName.toLowerCase(), score);
        }
      }
    }

    // Startup performance lookup (by device name)
    if (this.data.startupPerformance) {
      for (const startup of this.data.startupPerformance) {
        if (startup.deviceName) {
          this.startupById.set(startup.deviceName.toLowerCase(), startup);
        }
      }
    }

    // Battery health lookup (by device name)
    if (this.data.batteryHealth) {
      for (const battery of this.data.batteryHealth) {
        if (battery.deviceName) {
          this.batteryById.set(battery.deviceName.toLowerCase(), battery);
        }
      }
    }

    // Crashes lookup (by device ID or name)
    if (this.data.crashes) {
      for (const crash of this.data.crashes) {
        const key = crash.deviceId || crash.deviceName;
        if (key) {
          const existing = this.crashesByDevice.get(key) || [];
          existing.push(crash);
          this.crashesByDevice.set(key, existing);
        }
      }
    }

    // Warranty lookup (by serial number)
    // Store with lowercase key for case-insensitive lookup
    if (this.data.warranty) {
      for (const w of this.data.warranty) {
        if (w.serialNumber) {
          this.warrantyBySerial.set(w.serialNumber.toLowerCase(), w);
        }
      }
    }
  }

  /**
   * Normalize all devices to UnifiedDeviceDocument format
   */
  public async normalizeAll(): Promise<UnifiedDeviceDocument[]> {
    console.log(`[DEBUG normalizeAll] Starting with ${this.data.managedDevices?.length || 0} devices`);
    console.log(`[DEBUG normalizeAll] enableDualWrite: ${this.options.enableDualWrite}`);
    console.log(`[DEBUG normalizeAll] Has compliance repo: ${!!this.complianceRepo}`);
    console.log(`[DEBUG normalizeAll] Has config repo: ${!!this.configRepo}`);

    if (!this.data.managedDevices || this.data.managedDevices.length === 0) {
      console.log(`[DEBUG normalizeAll] No devices found, returning empty array`);
      return [];
    }

    // Phase 2: Dual-write mode - bulk upsert configuration profiles and compliance policies first
    if (this.options.enableDualWrite) {
      if (this.configRepo) {
        await this.bulkUpsertConfigurationProfiles();
      }
      if (this.complianceRepo) {
        await this.bulkUpsertCompliancePolicies();
      }
    }

    console.log(`[DEBUG normalizeAll] About to normalize ${this.data.managedDevices.length} devices`);
    // Normalize all devices
    const devices = this.data.managedDevices.map(device => this.normalizeDevice(device));
    console.log(`[DEBUG normalizeAll] Normalized ${devices.length} devices`);

    // Phase 2: Dual-write mode - bulk upsert compliance evaluations after device normalization
    if (this.options.enableDualWrite && this.complianceRepo) {
      await this.bulkUpsertComplianceEvaluations(devices);
    }

    return devices;
  }

  /**
   * Bulk upsert all configuration profiles (Phase 2: Dual-write mode)
   * This is called once before normalization to populate the configuration_profiles index
   */
  private async bulkUpsertConfigurationProfiles(): Promise<void> {
    if (!this.configRepo) return;

    const configPolicies = this.data.configurationPolicies || [];
    if (configPolicies.length === 0) return;

    console.log(`[Dual-Write] Bulk upserting ${configPolicies.length} configuration profiles...`);

    // Prepare profiles for bulk upsert
    const profiles = configPolicies.map((policy: any) => ({
      configId: policy.id,
      displayName: policy.displayName || 'Unknown Configuration',
      platform: normalizePlatform(policy['@odata.type']?.split('.').pop() || 'unknown'),
      settingsPayload: this.extractPolicySettings(policy),
      createdDate: policy.createdDateTime || new Date().toISOString(),
      lastModifiedDate: policy.lastModifiedDateTime || new Date().toISOString()
    }));

    // Bulk upsert and get version map
    const versionMap = await this.configRepo.bulkUpsertProfiles(profiles);

    // Cache versions for quick lookup during device normalization
    this.profileVersions = versionMap;

    console.log(`[Dual-Write] Upserted ${versionMap.size} profiles (${configPolicies.length - versionMap.size} unchanged)`);
  }

  /**
   * Bulk upsert all compliance policies (Phase 2: Dual-write mode)
   * This is called once before normalization to populate the compliance_policies index
   */
  private async bulkUpsertCompliancePolicies(): Promise<void> {
    if (!this.complianceRepo) return;

    const compliancePolicies = this.data.compliancePolicies || [];
    if (compliancePolicies.length === 0) return;

    console.log(`[Dual-Write] Bulk upserting ${compliancePolicies.length} compliance policies...`);

    // Prepare policies for bulk upsert
    const policies = compliancePolicies.map((policy: any) => ({
      policyId: policy.id,
      displayName: policy.displayName || 'Unknown Policy',
      platform: normalizeCompliancePlatform(policy['@odata.type']?.split('.').pop() || 'unknown'),
      settingsPayload: this.extractPolicySettings(policy),
      description: policy.description,
      createdDate: policy.createdDateTime || new Date().toISOString(),
      lastModifiedDate: policy.lastModifiedDateTime || new Date().toISOString()
    }));

    // Bulk upsert and get version map
    const versionMap = await this.complianceRepo.bulkUpsertPolicies(policies);

    // Cache versions for quick lookup during device normalization
    this.policyVersions = versionMap;

    console.log(`[Dual-Write] Upserted ${versionMap.size} compliance policies (${compliancePolicies.length - versionMap.size} unchanged)`);
  }

  /**
   * Bulk upsert all compliance evaluations (Phase 2: Dual-write mode)
   * This is called after device normalization to populate the compliance_evaluations index
   */
  private async bulkUpsertComplianceEvaluations(devices: UnifiedDeviceDocument[]): Promise<void> {
    if (!this.complianceRepo) return;

    const evaluations: any[] = [];

    // Collect all device-policy evaluations
    for (const device of devices) {
      if (!device.compliance?.references) continue;

      for (const ref of device.compliance.references) {
        // Find the original compliance state to get full setting details
        const complianceStates = this.data.deviceComplianceStatus?.[device.id]; // FIX: Use device.id
        // Fetcher uses 'policyId' field, not 'id'
        const state = complianceStates?.find((s: any) => (s.policyId || s.id) === ref.policy_id);

        if (!state) continue;

        // Map setting states to normalized format
        const settingStates = (state.settingStates || []).map((ss: any) => ({
          setting: ss.setting,
          state: extractComplianceStatus(ss.state),
          error_code: ss.errorCode,
          error_description: ss.errorDescription,
          user_id: ss.userId,
          user_name: ss.userName,
          sources: ss.sources?.map((src: any) => ({
            id: src.id,
            display_name: src.displayName
          })) || []
        }));

        evaluations.push({
          deviceId: device.id,
          policyId: ref.policy_id,
          policyVersion: ref.version,
          evaluationTimestamp: ref.last_evaluated,
          deploymentStatus: ref.deployment_status,
          settingStates,
          errorCodes: state.settingStates
            ?.filter((ss: any) => ss.errorCode)
            .map((ss: any) => ss.errorCode) || []
        });
      }
    }

    if (evaluations.length === 0) {
      console.log('[Dual-Write] No compliance evaluations to upsert');
      return;
    }

    console.log(`[Dual-Write] Bulk upserting ${evaluations.length} compliance evaluations...`);
    await this.complianceRepo.bulkUpsertEvaluations(evaluations);
    console.log(`[Dual-Write] Upserted ${evaluations.length} compliance evaluations`);
  }

  /**
   * Extract policy settings from policy object (filter out metadata)
   */
  private extractPolicySettings(policy: any): any {
    const metadataFields = [
      '@odata.type',
      'id',
      'createdDateTime',
      'lastModifiedDateTime',
      'version',
      'displayName',
      'description',
      'platformType',
      'roleScopeTagIds',
      'supportsScopeTags',
      'deviceManagementApplicabilityRuleOsEdition',
      'deviceManagementApplicabilityRuleOsVersion',
      'deviceManagementApplicabilityRuleDeviceMode',
      'assignments'
    ];

    const settings: Record<string, any> = { '@odata.type': policy['@odata.type'] };

    // Extract all non-metadata fields as settings
    Object.keys(policy).forEach(key => {
      if (!metadataFields.includes(key) && policy[key] !== null && policy[key] !== undefined) {
        settings[key] = policy[key];
      }
    });

    return settings;
  }

  /**
   * Normalize a single device with all correlations
   */
  private normalizeDevice(device: any): UnifiedDeviceDocument {
    const deviceId = device.id;
    const deviceName = device.deviceName;
    const serialNumber = device.serialNumber;
    const upn = device.userPrincipalName?.toLowerCase();

    // Debug first device only
    if (!this.deviceDebugLogged) {
      this.deviceDebugLogged = true;
      console.log(`[DEBUG] normalizeDevice called for first device: id="${deviceId}", name="${deviceName}"`);
      console.log(`[DEBUG] About to call normalizeCompliance(${deviceId})`);
    }

    // Calculate compliance state FIRST (from policy-level states, not raw API cache)
    const calculatedCompliance = this.normalizeCompliance(deviceId);

    if (!this.deviceDebugLogged2) {
      this.deviceDebugLogged2 = true;
      console.log(`[DEBUG] normalizeCompliance returned:`, calculatedCompliance ? 'data' : 'undefined');
    }

    // Determine isCompliant from calculated compliance state
    // Priority: 1) Calculated state from policies, 2) Raw API state as fallback
    const isDeviceCompliant = calculatedCompliance
      ? calculatedCompliance.state === 'compliant'
      : device.complianceState === 'compliant';

    // Core identity
    const doc: UnifiedDeviceDocument = {
      id: deviceId,
      azureAdDeviceId: device.azureADDeviceId || device.azureAdDeviceId,
      serialNumber: serialNumber,
      deviceName: deviceName || 'Unknown',

      // Basic device info
      manufacturer: device.manufacturer,
      model: device.model,
      operatingSystem: device.operatingSystem || 'Unknown',
      osVersion: device.osVersion,
      joinType: device.deviceRegistrationState,
      enrollmentType: device.deviceEnrollmentType,
      managementState: device.managementAgent,
      lastSyncDateTime: device.lastSyncDateTime,
      enrolledDateTime: device.enrolledDateTime,

      // Top-level convenience fields (denormalized for query performance)
      isCompliant: isDeviceCompliant,
      complianceState: device.complianceState, // Raw state from Intune Graph API
      isEncrypted: device.isEncrypted,
      isSupervised: device.isSupervised,
      jailBroken: device.jailBroken,
      userPrincipalName: device.userPrincipalName,
      userDisplayName: device.userDisplayName || this.getUserDisplayName(device),
      managedDeviceOwnerType: device.managedDeviceOwnerType,
      totalStorageSpaceInBytes: device.totalStorageSpaceInBytes,
      freeStorageSpaceInBytes: device.freeStorageSpaceInBytes,
      batteryHealthPercentage: device.hardwareInformation?.batteryHealthPercentage,

      // Hardware information
      hardware: this.normalizeHardware(device),

      // Network details
      network: this.normalizeNetwork(device),

      // Conditional access
      conditionalAccess: this.normalizeConditionalAccess(deviceId, device),

      // Autopilot
      autopilot: this.normalizeAutopilot(device),

      // Exchange ActiveSync
      exchangeActiveSync: this.normalizeExchangeActiveSync(device),

      // Management details
      management: this.normalizeManagement(device),

      // Configuration Manager
      configurationManager: device.configurationManagerClientEnabledFeatures ||
                           device.configurationManagerClientHealthState ||
                           device.configurationManagerClientInformation ? {
        clientEnabledFeatures: device.configurationManagerClientEnabledFeatures,
        clientHealthState: device.configurationManagerClientHealthState,
        clientInformation: device.configurationManagerClientInformation
      } : undefined,

      // Partner threat state
      partnerReportedThreatState: device.partnersReportedThreatState,

      // Lost mode
      lostMode: device.lostModeState ? {
        state: device.lostModeState
      } : undefined,

      // Device notes
      notes: device.notes,

      // Role scope tags
      roleScopeTagIds: device.roleScopeTagIds,

      // Malware
      malware: (device.windowsActiveMalwareCount || device.windowsRemediatedMalwareCount) ? {
        activeMalwareCount: device.windowsActiveMalwareCount,
        remediatedMalwareCount: device.windowsRemediatedMalwareCount
      } : undefined,

      // User association
      user: this.normalizeUser(device),

      // Compliance (WHY non-compliant) - use already calculated value
      compliance: calculatedCompliance,

      // Configuration status
      configuration: this.normalizeConfiguration(deviceId, device.operatingSystem),

      // Security & Protection
      security: this.normalizeSecurity(deviceId, device),

      // Device actions history
      actions: this.normalizeActions(deviceId),

      // Organization (categories & groups)
      organization: this.normalizeOrganization(deviceId, device),

      // Endpoint Analytics
      analytics: this.normalizeAnalytics(deviceName),

      // Crashes
      crashes: this.normalizeCrashes(deviceId, deviceName),

      // Warranty
      warranty: this.normalizeWarranty(serialNumber),

      // Data quality indicators
      dataQuality: {
        hasCompliance: !!this.data.deviceComplianceStatus?.[deviceId],
        hasConfiguration: !!this.data.deviceConfigurationStatus?.[deviceId],
        hasSecurity: !!(this.data.securityAccess?.windowsProtectionState?.[deviceId] ||
                        this.data.securityAccess?.deviceHealthAttestation?.[deviceId]),
        hasActions: !!(this.data.securityAccess?.deviceActionHistory?.[deviceId]),
        hasAnalytics: !!(this.deviceScoresById.has(deviceName?.toLowerCase() || '')),
        hasCrashes: this.crashesByDevice.has(deviceId) || this.crashesByDevice.has(deviceName),
        hasWarranty: !!this.warrantyBySerial.get(serialNumber.toLowerCase()),
        lastEnrichedAt: new Date().toISOString()
      },

      // Ingestion metadata
      ingestion: {
        timestamp: new Date().toISOString(),
        source: 'typescript-fetcher',
        version: '2.0.0'
      }
    };

    return doc;
  }

  /**
   * Normalize hardware information
   */
  private normalizeHardware(device: any): UnifiedDeviceDocument['hardware'] {
    const hwInfo = device.hardwareInformation || {};

    // Check if any hardware data exists
    if (!device.totalStorageSpaceInBytes &&
        !device.physicalMemoryInBytes &&
        !device.wiFiMacAddress &&
        !device.imei &&
        !Object.keys(hwInfo).length) {
      return undefined;
    }

    return {
      totalStorageSpaceInBytes: device.totalStorageSpaceInBytes,
      freeStorageSpaceInBytes: device.freeStorageSpaceInBytes,
      physicalMemoryInBytes: device.physicalMemoryInBytes,
      chassisType: hwInfo.chassisType,
      wiFiMacAddress: device.wiFiMacAddress,
      ethernetMacAddress: device.ethernetMacAddress,
      imei: device.imei,
      meid: device.meid,
      iccid: device.iccid,
      udid: device.udid,
      phoneNumber: device.phoneNumber,
      subscriberCarrier: device.subscriberCarrier,
      batterySerialNumber: hwInfo.batterySerialNumber,
      batteryHealthPercentage: hwInfo.batteryHealthPercentage,
      batteryChargeCycles: hwInfo.batteryChargeCycles,
      batteryLevelPercentage: hwInfo.batteryLevelPercentage,
      residentUsersCount: hwInfo.residentUsersCount,
      productName: hwInfo.productName,
      deviceFullQualifiedDomainName: hwInfo.deviceFullQualifiedDomainName,
      deviceGuardVirtualizationBasedSecurityHardwareRequirementState: hwInfo.deviceGuardVirtualizationBasedSecurityHardwareRequirementState,
      deviceGuardVirtualizationBasedSecurityState: hwInfo.deviceGuardVirtualizationBasedSecurityState,
      deviceGuardLocalSystemAuthorityCredentialGuardState: hwInfo.deviceGuardLocalSystemAuthorityCredentialGuardState
    };
  }

  /**
   * Normalize network details
   */
  private normalizeNetwork(device: any): UnifiedDeviceDocument['network'] {
    if (!device.wiFiMacAddress &&
        !device.ethernetMacAddress &&
        device.isEncrypted === undefined &&
        device.isSupervised === undefined) {
      return undefined;
    }

    return {
      wifiMac: device.wiFiMacAddress,
      ethernetMac: device.ethernetMacAddress,
      isEncrypted: device.isEncrypted,
      isSupervised: device.isSupervised
    };
  }

  /**
   * Normalize conditional access
   */
  private normalizeConditionalAccess(deviceId: string, device: any): UnifiedDeviceDocument['conditionalAccess'] {
    const caPolicies = this.data.securityAccess?.conditionalAccessPolicies || [];
    const namedLocations = this.data.securityAccess?.namedLocations || [];

    if (!device.deviceRegistrationState && caPolicies.length === 0 && namedLocations.length === 0) {
      return undefined;
    }

    return {
      deviceRegistrationState: device.deviceRegistrationState,
      policies: caPolicies.length > 0 ? caPolicies.map((p: any) => ({
        policyId: p.id,
        policyName: p.displayName,
        state: p.state,
        lastModified: p.modifiedDateTime
      })) : undefined,
      locations: namedLocations.length > 0 ? namedLocations.map((loc: any) => ({
        locationId: loc.id,
        locationName: loc.displayName,
        isTrusted: loc.isTrusted
      })) : undefined
    };
  }

  /**
   * Normalize autopilot
   */
  private normalizeAutopilot(device: any): UnifiedDeviceDocument['autopilot'] {
    if (!device.autopilotEnrolled && !device.enrollmentProfileName) {
      return undefined;
    }

    return {
      enrolled: device.autopilotEnrolled,
      profileName: device.enrollmentProfileName
    };
  }

  /**
   * Normalize Exchange ActiveSync
   */
  private normalizeExchangeActiveSync(device: any): UnifiedDeviceDocument['exchangeActiveSync'] {
    if (!device.easActivated &&
        !device.exchangeLastSuccessfulSyncDateTime &&
        !device.exchangeAccessState) {
      return undefined;
    }

    return {
      easActivated: device.easActivated,
      easDeviceId: device.easDeviceId,
      easActivationDateTime: device.easActivationDateTime,
      exchangeLastSuccessfulSyncDateTime: device.exchangeLastSuccessfulSyncDateTime,
      exchangeAccessState: device.exchangeAccessState,
      exchangeAccessStateReason: device.exchangeAccessStateReason
    };
  }

  /**
   * Normalize management details
   */
  private normalizeManagement(device: any): UnifiedDeviceDocument['management'] {
    if (!device.managedDeviceOwnerType &&
        !device.managementAgent &&
        !device.remoteAssistanceSessionUrl &&
        !device.enrollmentProfileName) {
      return undefined;
    }

    return {
      managedDeviceOwnerType: device.managedDeviceOwnerType,
      managementAgent: device.managementAgent,
      managementCertificateExpirationDate: device.managementCertificateExpirationDate,
      managementFeatures: device.managementFeatures,
      remoteAssistanceSessionUrl: device.remoteAssistanceSessionUrl,
      remoteAssistanceSessionErrorDetails: device.remoteAssistanceSessionErrorDetails,
      requireUserEnrollmentApproval: device.requireUserEnrollmentApproval,
      userPrincipalName: device.userPrincipalName,
      enrollmentProfileName: device.enrollmentProfileName
    };
  }

  /**
   * Get user display name from lookup
   */
  private getUserDisplayName(device: any): string | undefined {
    const upn = device.userPrincipalName?.toLowerCase();
    const userId = device.userId;

    // Try to find user from lookup
    let user = null;
    if (userId) {
      user = this.usersById.get(userId);
    } else if (upn) {
      user = this.usersByUpn.get(upn);
    }

    return user?.displayName;
  }

  /**
   * Normalize user data
   */
  private normalizeUser(device: any): UnifiedDeviceDocument['user'] {
    const upn = device.userPrincipalName?.toLowerCase();
    const userId = device.userId;

    // Try to find user from lookup
    let user = null;
    if (userId) {
      user = this.usersById.get(userId);
    } else if (upn) {
      user = this.usersByUpn.get(upn);
    }

    if (!user && !upn && !userId) {
      return undefined;
    }

    const sanitizedDept = user?.department || undefined;

    return {
      id: userId || user?.id,
      upn: upn || user?.userPrincipalName,
      displayName: device.userDisplayName || user?.displayName,
      email: user?.mail || upn,
      department: sanitizedDept
    };
  }

  /**
   * Normalize compliance data - shows WHY device is non-compliant
   */
  private normalizeCompliance(deviceId: string): UnifiedDeviceDocument['compliance'] {
    // Debug first call only
    if (!this.debugLogged) {
      this.debugLogged = true;
      const totalKeys = this.data.deviceComplianceStatus ? Object.keys(this.data.deviceComplianceStatus).length : 0;
      console.log(`[DEBUG] First normalizeCompliance call: deviceId="${deviceId}", totalKeys=${totalKeys}`);
      if (totalKeys > 0 && this.data.deviceComplianceStatus) {
        const hasThisDevice = !!this.data.deviceComplianceStatus[deviceId];
        console.log(`[DEBUG] Device ${deviceId} has compliance states: ${hasThisDevice}`);
        if (hasThisDevice) {
          console.log(`[DEBUG] State count: ${this.data.deviceComplianceStatus[deviceId].length}`);
        }
      }
    }

    const complianceStates = this.data.deviceComplianceStatus?.[deviceId];
    if (!complianceStates || complianceStates.length === 0) {
      return undefined;
    }

    // Determine overall compliance state
    const hasNonCompliant = complianceStates.some((s: any) => {
      const stateLower = (s.state || '').toLowerCase();
      return stateLower === 'noncompliant' || stateLower === 'error';
    });
    const overallState = hasNonCompliant ? 'noncompliant' : 'compliant';

    // OLD FORMAT: Nested policies with full setting-level detail (for backward compatibility)
    const policies = complianceStates.map((state: any) => {
      // Fetcher uses 'policyId' field, not 'id'
      const policyId = state.policyId || state.id;
      const policy = this.compliancePoliciesById.get(policyId);

      return {
        id: policyId,
        name: policy?.displayName || state.policyName || state.displayName || 'Unknown Policy',
        platformType: policy?.['@odata.type']?.split('.').pop() || state.platformType || 'unknown',
        state: state.state,
        version: state.version || 1,
        settingStates: state.settingStates?.map((ss: any) => ({
          setting: ss.setting,
          state: ss.state,
          errorCode: ss.errorCode
        }))
      };
    });

    // Phase 2: Dual-write mode - also create lightweight references
    if (this.options.enableDualWrite) {
      const references: DeviceCompliancePolicyReference[] = complianceStates.map((state: any) => {
        // Fetcher uses 'policyId' field, not 'id'
        const policyId = state.policyId || state.id;
        const policy = this.compliancePoliciesById.get(policyId);
        const displayName = policy?.displayName || state.policyName || state.displayName || 'Unknown Policy';
        const version = this.policyVersions.get(policyId) || 1;

        // Calculate error_count and total_settings from settingStates
        const settingStates = state.settingStates || [];
        const errorCount = settingStates.filter((ss: any) => {
          const stateLower = (ss.state || '').toLowerCase();
          return stateLower === 'noncompliant' || stateLower === 'error';
        }).length;
        const totalSettings = settingStates.length;

        return createComplianceReference(
          policyId,
          displayName,
          version,
          state.state,
          errorCount,
          totalSettings,
          state.errorCode,
          state.lastReportedDateTime
        );
      });

      // Return both formats during dual-write phase
      return {
        state: overallState as 'compliant' | 'noncompliant' | 'unknown',
        gracePeriodExpiration: complianceStates[0]?.complianceGracePeriodExpirationDateTime,
        policies, // OLD FORMAT (for backward compatibility)
        lastEvaluated: new Date().toISOString(),
        references, // NEW FORMAT (normalized references)
      } as any; // Cast to any to allow additional field during transition
    }

    // Default: return old format only
    return {
      state: overallState as 'compliant' | 'noncompliant' | 'unknown',
      gracePeriodExpiration: complianceStates[0]?.complianceGracePeriodExpirationDateTime,
      policies,
      lastEvaluated: new Date().toISOString()
    };
  }

  /**
   * Check if configuration policy matches device platform
   */
  private isPolicyPlatformMatch(policyPlatformType: string, deviceOS: string): boolean {
    const deviceOSLower = (deviceOS || '').toLowerCase();
    const policyTypeLower = (policyPlatformType || '').toLowerCase();

    // macOS devices
    if (deviceOSLower.includes('macos') || deviceOSLower.includes('mac os')) {
      return policyTypeLower.includes('macos');
    }

    // Windows devices
    if (deviceOSLower.includes('windows')) {
      return policyTypeLower.includes('windows') ||
             policyTypeLower.includes('editionupgrade');
    }

    // iOS devices (but not macOS)
    if (deviceOSLower.includes('ios')) {
      return policyTypeLower.includes('ios') && !policyTypeLower.includes('macos');
    }

    // Android devices
    if (deviceOSLower.includes('android')) {
      return policyTypeLower.includes('android');
    }

    // If unknown, allow (fail-open for now)
    return true;
  }

  /**
   * Normalize configuration data
   * Phase 2: Supports dual-write mode (both old nested format and new normalized references)
   * Phase 2b: Added platform filtering to prevent cross-platform policy pollution
   */
  private normalizeConfiguration(deviceId: string, deviceOS: string): UnifiedDeviceDocument['configuration'] {
    const configStates = this.data.deviceConfigurationStatus?.[deviceId];
    if (!configStates || configStates.length === 0) {
      return undefined;
    }

    // Phase 2b: Filter configurations by platform match
    // Microsoft Graph sometimes returns platform-mismatched policies for devices
    // We filter them here to prevent showing macOS configs on Windows devices, etc.
    const platformMatchedStates = configStates.filter((state: any) => {
      // Fetcher uses 'configId' field, not 'id'
      const configId = state.configId || state.id;
      const policy = this.configPoliciesById.get(configId);
      const policyPlatformType = policy?.['@odata.type']?.split('.').pop() || state.platformType || 'unknown';
      return this.isPolicyPlatformMatch(policyPlatformType, deviceOS);
    });

    // Log filtering results for debugging
    if (configStates.length !== platformMatchedStates.length) {
      console.log(`[Platform Filter] Device ${deviceId} (${deviceOS}): Filtered ${configStates.length - platformMatchedStates.length} mismatched policies (${configStates.length} → ${platformMatchedStates.length})`);
    }

    // OLD FORMAT: Nested policies with full settings (for backward compatibility)
    // Use filtered states instead of all states
    const policies = platformMatchedStates.map((state: any) => {
      // Fetcher uses 'configId' field, not 'id'
      const configId = state.configId || state.id;
      const policy = this.configPoliciesById.get(configId);

      // Extract settings (for backward compatibility)
      let settings: Record<string, any> = {};
      if (policy) {
        settings = this.extractPolicySettings(policy);
      }

      return {
        id: configId,
        name: policy?.displayName || state.configName || state.displayName || 'Unknown Configuration',
        platformType: policy?.['@odata.type']?.split('.').pop() || state.platformType || 'unknown',
        state: state.state,
        version: state.version || 1,
        lastReported: state.lastReportedDateTime,
        settings: Object.keys(settings).length > 0 ? settings : undefined
      };
    });

    // Phase 2: Dual-write mode - also create lightweight references
    // Use filtered states to prevent platform-mismatched references
    if (this.options.enableDualWrite) {
      const references: DeviceConfigurationReference[] = platformMatchedStates.map((state: any) => {
        // Fetcher uses 'configId' field, not 'id'
        const configId = state.configId || state.id;
        const policy = this.configPoliciesById.get(configId);
        const displayName = policy?.displayName || state.configName || state.displayName || 'Unknown Configuration';
        const version = this.profileVersions.get(configId) || 1;

        return createConfigurationReference(
          configId,
          displayName,
          version,
          state.state,
          state.errorCode,
          state.lastReportedDateTime
        );
      });

      // Return both formats during dual-write phase
      return {
        policies, // OLD FORMAT (for backward compatibility)
        lastEvaluated: new Date().toISOString(),
        references, // NEW FORMAT (normalized references)
      } as any; // Cast to any to allow additional field during transition
    }

    // Default: return old format only
    return {
      policies,
      lastEvaluated: new Date().toISOString()
    };
  }

  /**
   * Normalize security data (Windows protection, health attestation, baselines)
   */
  private normalizeSecurity(deviceId: string, device: any): UnifiedDeviceDocument['security'] {
    const protectionState = this.data.securityAccess?.windowsProtectionState?.[deviceId];
    const healthAttestation = this.data.securityAccess?.deviceHealthAttestation?.[deviceId] ||
                              device.deviceHealthAttestationState;
    const baselines = this.data.securityAccess?.securityBaselines || [];

    if (!protectionState && !healthAttestation && baselines.length === 0) {
      return undefined;
    }

    return {
      protection: protectionState ? {
        defenderStatus: protectionState.defenderStatus,
        realTimeProtectionEnabled: protectionState.realTimeProtectionEnabled,
        quickScanOverdue: protectionState.quickScanOverdue,
        fullScanOverdue: protectionState.fullScanOverdue,
        signatureUpdateOverdue: protectionState.signatureUpdateOverdue,
        rebootRequired: protectionState.rebootRequired,
        pendingUpdates: protectionState.pendingUpdates,
        lastUpdateCheckTime: protectionState.lastUpdateCheckTime
      } : undefined,

      healthAttestation: healthAttestation ? {
        bitLockerStatus: healthAttestation.bitLockerStatus,
        bootDebuggingEnabled: healthAttestation.bootDebuggingEnabled,
        codeIntegrityEnabled: healthAttestation.codeIntegrityEnabled,
        secureBootEnabled: healthAttestation.secureBootEnabled,
        tpmPresent: healthAttestation.tpmVersion ? true : false,
        attestationState: healthAttestation.attestationIdentityKey ? 'attested' : 'not_attested'
      } : undefined,

      baselines: baselines.length > 0 ? baselines.map((b: any) => ({
        id: b.id,
        name: b.displayName,
        state: b.state || 'unknown',
        version: b.version || 1
      })) : undefined
    };
  }

  /**
   * Normalize device actions history
   */
  private normalizeActions(deviceId: string): UnifiedDeviceDocument['actions'] {
    const actionHistory = this.data.securityAccess?.deviceActionHistory?.[deviceId];
    if (!actionHistory || actionHistory.length === 0) {
      return undefined;
    }

    const history = actionHistory.map((action: any) => ({
      actionName: action.actionName,
      actionState: action.actionState,
      startDateTime: action.startDateTime,
      lastUpdatedDateTime: action.lastUpdatedDateTime,
      userId: action.initiatedByUserId
    }));

    // Find most recent action
    const sorted = [...history].sort((a, b) =>
      new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
    );

    return {
      history,
      lastAction: sorted.length > 0 ? {
        name: sorted[0].actionName,
        state: sorted[0].actionState,
        timestamp: sorted[0].startDateTime
      } : undefined
    };
  }

  /**
   * Normalize organization data (categories & groups)
   */
  private normalizeOrganization(deviceId: string, device: any): UnifiedDeviceDocument['organization'] {
    const categoryId = device.deviceCategoryDisplayName ||
                      this.data.securityAccess?.deviceCategoryAssignments?.[deviceId];
    const groups = this.data.securityAccess?.deviceGroupMemberships?.[deviceId] || [];

    if (!categoryId && groups.length === 0) {
      return undefined;
    }

    return {
      category: categoryId ? {
        id: categoryId,
        displayName: device.deviceCategoryDisplayName || categoryId
      } : undefined,
      groups: groups.map((g: any) => ({
        id: g.id,
        displayName: g.displayName,
        groupType: g.groupTypes?.join(',') || 'unknown'
      }))
    };
  }

  /**
   * Normalize Endpoint Analytics data
   */
  private normalizeAnalytics(deviceName: string): UnifiedDeviceDocument['analytics'] {
    if (!deviceName) return undefined;

    const nameKey = deviceName.toLowerCase();
    const scores = this.deviceScoresById.get(nameKey);
    const startup = this.startupById.get(nameKey);
    const battery = this.batteryById.get(nameKey);

    if (!scores && !startup && !battery) {
      return undefined;
    }

    return {
      scores: scores ? {
        overall: scores.endpointAnalyticsScore,
        startup: scores.startupPerformanceScore,
        appReliability: scores.appReliabilityScore,
        battery: scores.batteryHealthScore,
        workFromAnywhere: scores.workFromAnywhereScore
      } : undefined,

      startup: startup ? {
        coreBootTimeMs: startup.coreBootTimeInMs,
        coreLoginTimeMs: startup.coreLoginTimeInMs,
        responsiveDesktopTimeMs: startup.responsiveDesktopTimeInMs,
        restartCount: startup.restartCount,
        blueScreenCount: startup.blueScreenCount,
        diskType: startup.diskType
      } : undefined,

      appReliability: scores ? {
        score: scores.appReliabilityScore,
        meanTimeToFailureMinutes: scores.meanTimeToFailureInMinutes,
        crashCount: undefined, // Will be filled from crashes data
        hangCount: undefined
      } : undefined,

      battery: battery ? {
        score: battery.deviceBatteryHealthScore,
        healthStatus: battery.healthStatus,
        ageInDays: battery.batteryAgeInDays,
        maxCapacityPercentage: battery.maxCapacityPercentage,
        estimatedRuntimeMinutes: battery.estimatedRuntimeInMinutes
      } : undefined
    };
  }

  /**
   * Normalize crashes data
   */
  private normalizeCrashes(deviceId: string, deviceName: string): UnifiedDeviceDocument['crashes'] {
    const crashEvents = this.crashesByDevice.get(deviceId) ||
                       this.crashesByDevice.get(deviceName) ||
                       [];

    if (crashEvents.length === 0) {
      return undefined;
    }

    // Calculate summary
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = crashEvents.filter((c: any) =>
      new Date(c.eventDateTime) >= sevenDaysAgo
    ).length;

    // Find most recent crash
    const sorted = [...crashEvents].sort((a: any, b: any) =>
      new Date(b.eventDateTime).getTime() - new Date(a.eventDateTime).getTime()
    );

    // Find top app/process by count
    const appCounts: Record<string, number> = {};
    const processCounts: Record<string, number> = {};
    for (const crash of crashEvents) {
      if (crash.applicationName) {
        appCounts[crash.applicationName] = (appCounts[crash.applicationName] || 0) + 1;
      }
      if (crash.processName) {
        processCounts[crash.processName] = (processCounts[crash.processName] || 0) + 1;
      }
    }

    const topApp = Object.entries(appCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topProcess = Object.entries(processCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      summary: {
        total: crashEvents.length,
        last7Days,
        lastCrashAt: sorted[0]?.eventDateTime,
        topApp,
        topProcess
      },
      events: sorted.slice(0, 50).map((crash: any) => ({ // Limit to 50 most recent
        timestamp: crash.eventDateTime,
        appName: crash.applicationName,
        processName: crash.processName,
        version: crash.applicationVersion,
        errorCode: crash.errorCode
      }))
    };
  }

  /**
   * Normalize warranty data
   */
  private normalizeWarranty(serialNumber: string): UnifiedDeviceDocument['warranty'] {
    if (!serialNumber) return undefined;

    const warranty = this.warrantyBySerial.get(serialNumber.toLowerCase());
    if (!warranty) return undefined;

    const now = new Date();
    const endDate = warranty.warrantyEnd ? new Date(warranty.warrantyEnd) : null;
    const inWarranty = endDate ? endDate > now : false;
    const daysRemaining = endDate ?
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      status: warranty.error ? 'error' : (inWarranty ? 'active' : 'expired'),
      startDate: warranty.warrantyStart,
      endDate: warranty.warrantyEnd,
      daysRemaining: Math.max(0, daysRemaining),
      inWarranty,
      vendor: warranty.product?.toLowerCase().includes('lenovo') ? 'Lenovo' : 'Unknown'
    };
  }
}

/**
 * Convenience function to normalize fetcher output
 * Phase 2: Now supports async for dual-write mode
 */
export async function normalizeDevices(
  fetcherOutput: FetcherOutput,
  options?: NormalizerOptions
): Promise<UnifiedDeviceDocument[]> {
  const normalizer = new DeviceNormalizer(fetcherOutput, options);
  return await normalizer.normalizeAll();
}
