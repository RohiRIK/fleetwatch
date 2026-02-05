// Unified Device Document Schema
// Correlates all device-related data into a single OpenSearch document

export interface UnifiedDeviceDocument {
  // === Core Identity ===
  id: string;                    // Primary key (managedDevice.id)
  azureAdDeviceId?: string;
  serialNumber?: string;
  deviceName: string;

  // === Basic Device Info ===
  manufacturer?: string;
  model?: string;
  operatingSystem: string;
  osVersion?: string;
  joinType?: string;
  enrollmentType?: string;
  managementState?: string;
  lastSyncDateTime?: string;
  enrolledDateTime?: string;

  // === Top-level Convenience Fields (denormalized for query performance) ===
  isCompliant?: boolean;              // Denormalized from compliance.state
  complianceState?: string;           // Raw state from Intune Graph API
  isEncrypted?: boolean;              // Denormalized from network.isEncrypted
  isSupervised?: boolean;             // Denormalized from network.isSupervised
  jailBroken?: string;                // From device.jailBroken
  userPrincipalName?: string;         // Denormalized from user.upn and management.userPrincipalName
  userDisplayName?: string;           // Denormalized from user.displayName for performance
  managedDeviceOwnerType?: string;    // Denormalized from management.managedDeviceOwnerType
  totalStorageSpaceInBytes?: number;  // Denormalized from hardware.totalStorageSpaceInBytes
  freeStorageSpaceInBytes?: number;   // Denormalized from hardware.freeStorageSpaceInBytes
  batteryHealthPercentage?: number;   // Denormalized from hardware.batteryHealthPercentage

  // === Hardware Information ===
  hardware?: {
    // Storage
    totalStorageSpaceInBytes?: number;
    freeStorageSpaceInBytes?: number;

    // Memory
    physicalMemoryInBytes?: number;

    // System Enclosure
    chassisType?: string;

    // Network Adapters
    wiFiMacAddress?: string;
    ethernetMacAddress?: string;

    // Mobile (iOS/Android)
    imei?: string;
    meid?: string;
    iccid?: string;
    udid?: string;
    phoneNumber?: string;
    subscriberCarrier?: string;

    // Additional hardware details from hardwareInformation
    batterySerialNumber?: string;
    batteryHealthPercentage?: number;
    batteryChargeCycles?: number;
    batteryLevelPercentage?: number;
    residentUsersCount?: number;
    productName?: string;
    deviceFullQualifiedDomainName?: string;
    deviceGuardVirtualizationBasedSecurityHardwareRequirementState?: string;
    deviceGuardVirtualizationBasedSecurityState?: string;
    deviceGuardLocalSystemAuthorityCredentialGuardState?: string;
  };

  // === Network Details ===
  network?: {
    ipAddressV4?: string;
    ipAddressV6?: string;
    subnetAddress?: string;
    wifiMac?: string;
    ethernetMac?: string;
    isEncrypted?: boolean;
    isSupervised?: boolean;
  };

  // === Conditional Access ===
  conditionalAccess?: {
    // Device-level CA state
    deviceRegistrationState?: string;

    // Policies applied to this device
    policies?: Array<{
      policyId: string;
      policyName?: string;
      state?: string;
      lastModified?: string;
    }>;

    // Named locations the device is associated with
    locations?: Array<{
      locationId: string;
      locationName?: string;
      isTrusted?: boolean;
    }>;
  };

  // === Autopilot & Provisioning ===
  autopilot?: {
    enrolled?: boolean;
    profileName?: string;
    deploymentProfileAssigned?: string;
    groupTag?: string;
  };

  // === Exchange ActiveSync ===
  exchangeActiveSync?: {
    easActivated?: boolean;
    easDeviceId?: string;
    easActivationDateTime?: string;
    exchangeLastSuccessfulSyncDateTime?: string;
    exchangeAccessState?: string;
    exchangeAccessStateReason?: string;
  };

  // === Management Details ===
  management?: {
    managedDeviceOwnerType?: string;
    managementAgent?: string;
    managementCertificateExpirationDate?: string;
    managementFeatures?: string;
    remoteAssistanceSessionUrl?: string;
    remoteAssistanceSessionErrorDetails?: string;
    requireUserEnrollmentApproval?: boolean;
    userPrincipalName?: string;
    enrollmentProfileName?: string;
  };

  // === Configuration Manager ===
  configurationManager?: {
    clientHealthState?: any;
    clientInformation?: any;
    clientEnabledFeatures?: any;
  };

  // === Partner/Third-party ===
  partnerReportedThreatState?: string;

  // === Lost Mode (iOS) ===
  lostMode?: {
    state?: string;
    message?: string;
    phoneNumber?: string;
    footnote?: string;
  };

  // === Device Notes ===
  notes?: string;

  // === Role Scope Tags ===
  roleScopeTagIds?: string[];

  // === Malware Detection (Windows) ===
  malware?: {
    activeMalwareCount?: number;
    remediatedMalwareCount?: number;
  };

  // === User Association ===
  user?: {
    id?: string;
    upn?: string;
    displayName?: string;
    email?: string;
    department?: string;
  };

  // === Compliance (shows WHY non-compliant) ===
  compliance?: {
    state: 'compliant' | 'noncompliant' | 'unknown';
    gracePeriodExpiration?: string;
    references?: DeviceCompliancePolicyReference[];
    policies: Array<{
      id: string;
      name: string;
      platformType: string;
      state: string;
      version: number;
      settingStates?: Array<{
        setting: string;
        state: string;
        errorCode?: string;
      }>;
    }>;
    lastEvaluated?: string;
  };

  // === Configuration Status ===
  configuration?: {
    references?: DeviceConfigurationReference[];
    policies: Array<{
      id: string;
      name: string;
      platformType: string;
      state: string;
      version: number;
      lastReported?: string;
      settings?: Record<string, any>;
    }>;
    lastEvaluated?: string;
  };

  // === Security & Protection ===
  security?: {
    // Windows Defender & Update Status
    protection?: {
      defenderStatus?: string;
      realTimeProtectionEnabled?: boolean;
      quickScanOverdue?: boolean;
      fullScanOverdue?: boolean;
      signatureUpdateOverdue?: boolean;
      rebootRequired?: boolean;
      pendingUpdates?: number;
      lastUpdateCheckTime?: string;
    };

    // Device Health Attestation
    healthAttestation?: {
      bitLockerStatus?: string;
      bootDebuggingEnabled?: boolean;
      codeIntegrityEnabled?: boolean;
      secureBootEnabled?: boolean;
      tpmPresent?: boolean;
      attestationState?: string;
    };

    // Security Baselines
    baselines?: Array<{
      id: string;
      name: string;
      state: string;
      version: number;
    }>;
  };

  // === Device Actions History ===
  actions?: {
    history: Array<{
      actionName: string;
      actionState: string;
      startDateTime: string;
      lastUpdatedDateTime?: string;
      userId?: string;
    }>;
    lastAction?: {
      name: string;
      state: string;
      timestamp: string;
    };
  };

  // === Categories & Groups ===
  organization?: {
    category?: {
      id: string;
      displayName: string;
    };
    groups: Array<{
      id: string;
      displayName: string;
      groupType: string;
    }>;
  };

  // === Endpoint Analytics ===
  analytics?: {
    scores?: {
      overall?: number;
      startup?: number;
      appReliability?: number;
      battery?: number;
      workFromAnywhere?: number;
    };

    startup?: {
      coreBootTimeMs?: number;
      coreLoginTimeMs?: number;
      responsiveDesktopTimeMs?: number;
      restartCount?: number;
      blueScreenCount?: number;
      diskType?: string;
    };

    appReliability?: {
      score?: number;
      meanTimeToFailureMinutes?: number;
      crashCount?: number;
      hangCount?: number;
    };

    battery?: {
      score?: number;
      healthStatus?: string;
      ageInDays?: number;
      maxCapacityPercentage?: number;
      estimatedRuntimeMinutes?: number;
    };
  };

  // === Crashes ===
  crashes?: {
    summary: {
      total: number;
      last7Days: number;
      lastCrashAt?: string;
      topApp?: string;
      topProcess?: string;
    };
    events: Array<{
      timestamp: string;
      appName?: string;
      processName?: string;
      version?: string;
      errorCode?: string;
    }>;
  };

  // === Warranty ===
  warranty?: {
    status: string;
    startDate?: string;
    endDate?: string;
    daysRemaining?: number;
    inWarranty: boolean;
    vendor?: string;
  };

  // === Trends (Time-series data) ===
  trends?: {
    scores?: Array<{ timestamp: string; value: number }>;
    crashes?: Array<{ timestamp: string; count: number }>;
  };

  // === Metadata ===
  dataQuality: {
    hasCompliance: boolean;
    hasConfiguration: boolean;
    hasSecurity: boolean;
    hasActions: boolean;
    hasAnalytics: boolean;
    hasCrashes: boolean;
    hasWarranty: boolean;
    lastEnrichedAt: string;
  };

  ingestion: {
    timestamp: string;
    source: string;
    version: string;
  };
}

// OpenSearch mapping for the unified device document
export const deviceMapping = {
  properties: {
    id: { type: 'keyword' },
    azureAdDeviceId: { type: 'keyword' },
    serialNumber: { type: 'keyword' },
    deviceName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    manufacturer: { type: 'keyword' },
    model: { type: 'keyword' },
    operatingSystem: { type: 'keyword' },
    osVersion: { type: 'keyword' },
    joinType: { type: 'keyword' },
    enrollmentType: { type: 'keyword' },
    managementState: { type: 'keyword' },
    lastSyncDateTime: { type: 'date' },
    enrolledDateTime: { type: 'date' },

    // Top-level convenience fields (denormalized)
    isCompliant: { type: 'boolean' },
    isEncrypted: { type: 'boolean' },
    isSupervised: { type: 'boolean' },
    jailBroken: { type: 'keyword' },
    userPrincipalName: { type: 'keyword' },
    userDisplayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    managedDeviceOwnerType: { type: 'keyword' },
    totalStorageSpaceInBytes: { type: 'long' },
    freeStorageSpaceInBytes: { type: 'long' },
    batteryHealthPercentage: { type: 'integer' },

    hardware: {
      properties: {
        totalStorageSpaceInBytes: { type: 'long' },
        freeStorageSpaceInBytes: { type: 'long' },
        physicalMemoryInBytes: { type: 'long' },
        chassisType: { type: 'keyword' },
        wiFiMacAddress: { type: 'keyword' },
        ethernetMacAddress: { type: 'keyword' },
        imei: { type: 'keyword' },
        meid: { type: 'keyword' },
        iccid: { type: 'keyword' },
        udid: { type: 'keyword' },
        phoneNumber: { type: 'keyword' },
        subscriberCarrier: { type: 'keyword' },
        batterySerialNumber: { type: 'keyword' },
        batteryHealthPercentage: { type: 'integer' },
        batteryChargeCycles: { type: 'integer' },
        batteryLevelPercentage: { type: 'integer' },
        residentUsersCount: { type: 'integer' },
        productName: { type: 'keyword' },
        deviceFullQualifiedDomainName: { type: 'keyword' },
        deviceGuardVirtualizationBasedSecurityHardwareRequirementState: { type: 'keyword' },
        deviceGuardVirtualizationBasedSecurityState: { type: 'keyword' },
        deviceGuardLocalSystemAuthorityCredentialGuardState: { type: 'keyword' }
      }
    },

    network: {
      properties: {
        ipAddressV4: { type: 'ip' },
        ipAddressV6: { type: 'keyword' },
        subnetAddress: { type: 'ip' },
        wifiMac: { type: 'keyword' },
        ethernetMac: { type: 'keyword' },
        isEncrypted: { type: 'boolean' },
        isSupervised: { type: 'boolean' }
      }
    },

    conditionalAccess: {
      properties: {
        deviceRegistrationState: { type: 'keyword' },
        policies: {
          type: 'nested',
          properties: {
            policyId: { type: 'keyword' },
            policyName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            state: { type: 'keyword' },
            lastModified: { type: 'date' }
          }
        },
        locations: {
          type: 'nested',
          properties: {
            locationId: { type: 'keyword' },
            locationName: { type: 'keyword' },
            isTrusted: { type: 'boolean' }
          }
        }
      }
    },

    autopilot: {
      properties: {
        enrolled: { type: 'boolean' },
        profileName: { type: 'keyword' },
        deploymentProfileAssigned: { type: 'keyword' },
        groupTag: { type: 'keyword' }
      }
    },

    exchangeActiveSync: {
      properties: {
        easActivated: { type: 'boolean' },
        easDeviceId: { type: 'keyword' },
        easActivationDateTime: { type: 'date' },
        exchangeLastSuccessfulSyncDateTime: { type: 'date' },
        exchangeAccessState: { type: 'keyword' },
        exchangeAccessStateReason: { type: 'keyword' }
      }
    },

    management: {
      properties: {
        managedDeviceOwnerType: { type: 'keyword' },
        managementAgent: { type: 'keyword' },
        managementCertificateExpirationDate: { type: 'date' },
        managementFeatures: { type: 'keyword' },
        remoteAssistanceSessionUrl: { type: 'keyword' },
        remoteAssistanceSessionErrorDetails: { type: 'text' },
        requireUserEnrollmentApproval: { type: 'boolean' },
        userPrincipalName: { type: 'keyword' },
        enrollmentProfileName: { type: 'keyword' }
      }
    },

    configurationManager: {
      properties: {
        clientHealthState: { type: 'object', enabled: false },
        clientInformation: { type: 'object', enabled: false },
        clientEnabledFeatures: { type: 'object', enabled: false }
      }
    },

    partnerReportedThreatState: { type: 'keyword' },

    lostMode: {
      properties: {
        state: { type: 'keyword' },
        message: { type: 'text' },
        phoneNumber: { type: 'keyword' },
        footnote: { type: 'text' }
      }
    },

    notes: { type: 'text' },
    roleScopeTagIds: { type: 'keyword' },

    malware: {
      properties: {
        activeMalwareCount: { type: 'integer' },
        remediatedMalwareCount: { type: 'integer' }
      }
    },

    user: {
      properties: {
        id: { type: 'keyword' },
        upn: { type: 'keyword' },
        displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        email: { type: 'keyword' },
        department: { type: 'keyword' }
      }
    },

    compliance: {
      properties: {
        state: { type: 'keyword' },
        gracePeriodExpiration: { type: 'date' },

        // OLD FORMAT (backward compatible)
        policies: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            platformType: { type: 'keyword' },
            state: { type: 'keyword' },
            version: { type: 'integer' },
            settingStates: {
              type: 'nested',
              properties: {
                setting: { type: 'keyword' },
                state: { type: 'keyword' },
                errorCode: { type: 'keyword' }
              }
            }
          }
        },

        // NEW FORMAT (Phase 2 - lightweight references)
        references: {
          type: 'nested',
          properties: {
            policy_id: { type: 'keyword' },
            display_name_cached: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } }
            },
            deployment_status: { type: 'keyword' },
            error_count: { type: 'integer' },
            total_settings: { type: 'integer' },
            result_code: { type: 'keyword' },
            last_evaluated: { type: 'date' }
          }
        },

        lastEvaluated: { type: 'date' }
      }
    },

    configuration: {
      properties: {
        // OLD FORMAT (backward compatible)
        policies: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            platformType: { type: 'keyword' },
            state: { type: 'keyword' },
            version: { type: 'integer' },
            lastReported: { type: 'date' },
            settings: { type: 'object', enabled: false }
          }
        },

        // NEW FORMAT (Phase 2 - lightweight references)
        references: {
          type: 'nested',
          properties: {
            config_id: { type: 'keyword' },
            display_name_cached: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } }
            },
            deployment_status: { type: 'keyword' },
            error_count: { type: 'integer' },
            total_settings: { type: 'integer' },
            result_code: { type: 'keyword' },
            last_evaluated: { type: 'date' }
          }
        },

        lastEvaluated: { type: 'date' }
      }
    },

    security: {
      properties: {
        protection: {
          properties: {
            defenderStatus: { type: 'keyword' },
            realTimeProtectionEnabled: { type: 'boolean' },
            quickScanOverdue: { type: 'boolean' },
            fullScanOverdue: { type: 'boolean' },
            signatureUpdateOverdue: { type: 'boolean' },
            rebootRequired: { type: 'boolean' },
            pendingUpdates: { type: 'integer' },
            lastUpdateCheckTime: { type: 'date' }
          }
        },
        healthAttestation: {
          properties: {
            bitLockerStatus: { type: 'keyword' },
            bootDebuggingEnabled: { type: 'boolean' },
            codeIntegrityEnabled: { type: 'boolean' },
            secureBootEnabled: { type: 'boolean' },
            tpmPresent: { type: 'boolean' },
            attestationState: { type: 'keyword' }
          }
        },
        baselines: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            state: { type: 'keyword' },
            version: { type: 'integer' }
          }
        }
      }
    },

    actions: {
      properties: {
        history: {
          type: 'nested',
          properties: {
            actionName: { type: 'keyword' },
            actionState: { type: 'keyword' },
            startDateTime: { type: 'date' },
            lastUpdatedDateTime: { type: 'date' },
            userId: { type: 'keyword' }
          }
        },
        lastAction: {
          properties: {
            name: { type: 'keyword' },
            state: { type: 'keyword' },
            timestamp: { type: 'date' }
          }
        }
      }
    },

    organization: {
      properties: {
        category: {
          properties: {
            id: { type: 'keyword' },
            displayName: { type: 'keyword' }
          }
        },
        groups: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            groupType: { type: 'keyword' }
          }
        }
      }
    },

    analytics: {
      properties: {
        scores: {
          properties: {
            overall: { type: 'double' },
            startup: { type: 'double' },
            appReliability: { type: 'double' },
            battery: { type: 'double' },
            workFromAnywhere: { type: 'double' }
          }
        },
        startup: {
          properties: {
            coreBootTimeMs: { type: 'integer' },
            coreLoginTimeMs: { type: 'integer' },
            responsiveDesktopTimeMs: { type: 'integer' },
            restartCount: { type: 'integer' },
            blueScreenCount: { type: 'integer' },
            diskType: { type: 'keyword' }
          }
        },
        appReliability: {
          properties: {
            score: { type: 'double' },
            meanTimeToFailureMinutes: { type: 'integer' },
            crashCount: { type: 'integer' },
            hangCount: { type: 'integer' }
          }
        },
        battery: {
          properties: {
            score: { type: 'double' },
            healthStatus: { type: 'keyword' },
            ageInDays: { type: 'integer' },
            maxCapacityPercentage: { type: 'integer' },
            estimatedRuntimeMinutes: { type: 'integer' }
          }
        }
      }
    },

    crashes: {
      properties: {
        summary: {
          properties: {
            total: { type: 'integer' },
            last7Days: { type: 'integer' },
            lastCrashAt: { type: 'date' },
            topApp: { type: 'keyword' },
            topProcess: { type: 'keyword' }
          }
        },
        events: {
          type: 'nested',
          properties: {
            timestamp: { type: 'date' },
            appName: { type: 'keyword' },
            processName: { type: 'keyword' },
            version: { type: 'keyword' },
            errorCode: { type: 'keyword' }
          }
        }
      }
    },

    warranty: {
      properties: {
        status: { type: 'keyword' },
        startDate: { type: 'date' },
        endDate: { type: 'date' },
        daysRemaining: { type: 'integer' },
        inWarranty: { type: 'boolean' },
        vendor: { type: 'keyword' }
      }
    },

    trends: {
      properties: {
        scores: {
          type: 'nested',
          properties: {
            timestamp: { type: 'date' },
            value: { type: 'double' }
          }
        },
        crashes: {
          type: 'nested',
          properties: {
            timestamp: { type: 'date' },
            count: { type: 'integer' }
          }
        }
      }
    },

    dataQuality: {
      properties: {
        hasCompliance: { type: 'boolean' },
        hasConfiguration: { type: 'boolean' },
        hasSecurity: { type: 'boolean' },
        hasActions: { type: 'boolean' },
        hasAnalytics: { type: 'boolean' },
        hasCrashes: { type: 'boolean' },
        hasWarranty: { type: 'boolean' },
        lastEnrichedAt: { type: 'date' }
      }
    },

    ingestion: {
      properties: {
        timestamp: { type: 'date' },
        source: { type: 'keyword' },
        version: { type: 'keyword' }
      }
    }
  }
};

// ============================================================================
// NORMALIZED CONFIGURATION SCHEMA (Phase 1: Index Separation)
// ============================================================================

/**
 * Configuration deployment status types
 */
export type ConfigDeploymentStatus =
  | 'pending'
  | 'success'
  | 'conflict'
  | 'error'
  | 'notApplicable'
  | 'unknown';

/**
 * Supported configuration platforms
 */
export type ConfigPlatform = 'windows' | 'macOS' | 'iOS' | 'android' | 'linux';

/**
 * Lightweight device configuration reference
 * Stored in device document - minimal data for quick queries
 */
export interface DeviceConfigurationReference {
  config_id: string;                          // FK to configuration_profiles
  display_name_cached: string;                // Denormalized for search - CRITICAL for preserving search functionality
  version: number;                            // Policy version
  deployment_status: ConfigDeploymentStatus;  // Device-specific status (NOT "compliant")
  result_code?: string;                       // Error code if failed
  last_evaluated: string;                     // ISO timestamp of last evaluation
}

/**
 * Immutable configuration profile version
 * Stored in configuration_profiles index
 */
export interface ConfigurationProfile {
  config_id: string;              // Base policy ID from Microsoft Graph
  version: number;                // Monotonically increasing version number
  content_hash: string;           // SHA256 hash of settings_payload for deduplication
  display_name: string;           // Human-readable name
  description?: string;           // Optional description
  platform: ConfigPlatform;       // Target platform
  settings_payload: ConfigurationSettings;  // Full configuration JSON
  created_date: string;           // ISO timestamp from Graph API
  last_modified_date: string;     // ISO timestamp from Graph API
  is_active_reference: boolean;   // Is this version currently referenced by any device? (for cleanup)
  indexed_at: string;             // Timestamp when ingested to OpenSearch
}

/**
 * Configuration settings structure
 * Flexible JSON payload - structure varies by platform and policy type
 */
export interface ConfigurationSettings {
  '@odata.type': string;          // Microsoft Graph type identifier
  [key: string]: any;             // Flexible settings structure
}

/**
 * Configuration setting state for detailed compliance tracking
 */
export interface SettingStateSnapshot {
  setting: string;                // Setting identifier/path
  state: ConfigDeploymentStatus;  // State of this specific setting
  error_code?: string;            // Error code if failed
  current_value?: any;            // Current value on device
  desired_value?: any;            // Desired value from policy
}

/**
 * Deployment history entry for audit trail
 * Stored in configuration_deployment_history index
 */
export interface ConfigurationDeploymentHistory {
  device_id: string;              // FK to devices
  config_id: string;              // Base policy ID (not versioned ID)
  version: number;                // Version number at time of deployment
  timestamp: string;              // ISO timestamp of deployment evaluation
  status: ConfigDeploymentStatus; // Deployment status
  result_code?: string;           // Error code if failed
  setting_states?: SettingStateSnapshot[];  // Detailed setting states (optional)
  indexed_at: string;             // Timestamp when ingested to OpenSearch
}

/**
 * OpenSearch mapping for configuration_profiles index
 * Index name: configuration_profiles
 * Document ID format: {config_id}-v{version} (e.g., "a1b2c3d4-v5")
 */
export const configurationProfilesMapping = {
  properties: {
    config_id: { type: 'keyword' },
    version: { type: 'integer' },
    content_hash: { type: 'keyword' },  // SHA256 hash for deduplication
    display_name: {
      type: 'text',
      fields: { keyword: { type: 'keyword' } }
    },
    description: { type: 'text' },
    platform: { type: 'keyword' },  // windows, macOS, iOS, android, linux
    settings_payload: {
      type: 'object',
      enabled: false  // Don't index nested settings (store only)
    },
    created_date: { type: 'date' },
    last_modified_date: { type: 'date' },
    is_active_reference: { type: 'boolean' },  // For cleanup job
    indexed_at: { type: 'date' }
  }
};

/**
 * OpenSearch mapping for configuration_deployment_history index
 * Index name: configuration_deployment_history
 * ILM policy: 90-day retention
 */
export const deploymentHistoryMapping = {
  properties: {
    device_id: { type: 'keyword' },
    config_id: { type: 'keyword' },
    version: { type: 'integer' },
    timestamp: { type: 'date' },
    status: { type: 'keyword' },
    result_code: { type: 'keyword' },
    setting_states: {
      type: 'nested',
      properties: {
        setting: { type: 'keyword' },
        state: { type: 'keyword' },
        error_code: { type: 'keyword' },
        current_value: { type: 'object', enabled: false },
        desired_value: { type: 'object', enabled: false }
      }
    },
    indexed_at: { type: 'date' }
  }
};

/**
 * Updated device configuration field structure (replaces nested configuration.policies)
 * This is how configuration references will appear in the device document
 */
export interface UpdatedDeviceConfigurationField {
  references: DeviceConfigurationReference[];  // Lightweight references only
  last_evaluated?: string;                     // Timestamp of last evaluation
}

// ============================================================================
// Compliance Policy Schema (Phase 1: Lightweight References)
// ============================================================================

/**
 * Compliance policy deployment status
 */
export type CompliancePolicyStatus =
  | 'compliant'      // All settings pass
  | 'noncompliant'   // Some settings fail
  | 'error'          // Policy evaluation error
  | 'conflict'       // Conflicting policies
  | 'pending'        // Evaluation pending
  | 'notApplicable'  // Policy doesn't apply to device
  | 'unknown';       // Unknown state

/**
 * Supported compliance platforms
 */
export type CompliancePlatform = 'windows' | 'macOS' | 'iOS' | 'android' | 'linux';

/**
 * Lightweight compliance policy reference
 * Stored in device document - minimal data for quick queries and UI overview
 */
export interface DeviceCompliancePolicyReference {
  policy_id: string;                           // FK to compliance_policies index
  display_name_cached: string;                 // Denormalized for search
  version: number;                             // Policy version
  deployment_status: CompliancePolicyStatus;   // Overall status
  error_count: number;                         // Number of failing settings (0 = compliant)
  total_settings: number;                      // Total settings in policy
  result_code?: string;                        // Primary error code if failed
  last_evaluated: string;                      // ISO timestamp of last evaluation
}

/**
 * Compliance policy settings structure
 * Stores the DESIRED state from Intune, not device-specific results
 */
export interface ComplianceSettings {
  '@odata.type': string;                       // Microsoft Graph type identifier
  [key: string]: any;                          // Flexible settings structure (varies by platform)
}

/**
 * Immutable compliance policy version
 * Stored in compliance_policies index - full policy details with settings
 */
export interface CompliancePolicy {
  policy_id: string;                           // Base policy ID from Microsoft Graph
  version: number;                             // Monotonically increasing version number
  content_hash: string;                        // SHA256 hash of settings_payload for deduplication
  display_name: string;                        // Human-readable policy name
  description?: string;                        // Policy description
  platform: CompliancePlatform;                // Target platform
  settings_payload: ComplianceSettings;        // Full policy settings (DESIRED state)
  created_date: string;                        // ISO timestamp from Graph API
  last_modified_date: string;                  // ISO timestamp from Graph API
  is_active_reference: boolean;                // Is this version currently referenced?
  indexed_at: string;                          // Timestamp when ingested to OpenSearch
}

/**
 * Individual setting evaluation result
 * Contains both desired state and actual state
 */
export interface ComplianceSettingState {
  setting: string;                             // Setting identifier
  display_name?: string;                       // Human-readable name
  state: CompliancePolicyStatus;               // Compliant, noncompliant, error, etc.
  error_code?: string;                         // Error code if failed
  error_description?: string;                  // Human-readable error
  desired_value?: any;                         // Expected value from policy
  actual_value?: any;                          // Current value on device
}

/**
 * Device-specific compliance evaluation results
 * Stored in compliance_evaluations index - separate from policy definition
 * This is what the frontend lazy-loads when user clicks "View Details"
 */
export interface CompliancePolicyEvaluation {
  device_id: string;                           // FK to devices
  policy_id: string;                           // FK to compliance_policies
  policy_version: number;                      // Version evaluated
  evaluation_timestamp: string;                // ISO timestamp of evaluation
  deployment_status: CompliancePolicyStatus;   // Overall status
  setting_states: ComplianceSettingState[];    // Detailed setting-level results
  error_codes: string[];                       // All error codes (for aggregation)
  indexed_at: string;                          // Timestamp when ingested
}

/**
 * Updated device compliance field structure (Phase 2: Dual-write)
 * Replaces compliance.policies array with lightweight references
 */
export interface UpdatedDeviceComplianceField {
  state: 'compliant' | 'noncompliant' | 'unknown';  // Overall state (derived from references)
  grace_period_expiration?: string;                  // Device-level grace period
  references: DeviceCompliancePolicyReference[];     // Lightweight references
  last_evaluated?: string;                           // Last evaluation timestamp

  // DEPRECATED: Old nested format (Phase 2: Dual-write, Phase 4: Remove)
  policies?: Array<{
    id: string;
    name: string;
    platformType: string;
    state: string;
    version: number;
    settingStates?: Array<{
      setting: string;
      state: string;
      errorCode?: string;
    }>;
  }>;
}

// ============================================================================
// OpenSearch Mappings for Compliance Indices
// ============================================================================

/**
 * Mapping for compliance_policies index
 * Stores immutable compliance policy versions with content-based deduplication
 */
export const compliancePoliciesMapping = {
  properties: {
    policy_id: { type: 'keyword' },
    version: { type: 'integer' },
    content_hash: { type: 'keyword' },
    display_name: {
      type: 'text',
      fields: { keyword: { type: 'keyword' } }
    },
    description: { type: 'text' },
    platform: { type: 'keyword' },
    settings_payload: {
      type: 'object',
      enabled: false  // Store but don't index - retrieved by document ID
    },
    created_date: { type: 'date' },
    last_modified_date: { type: 'date' },
    is_active_reference: { type: 'boolean' },
    indexed_at: { type: 'date' }
  }
};

/**
 * Mapping for compliance_evaluations index
 * Stores device-specific compliance evaluation results with 30-day retention
 */
export const complianceEvaluationsMapping = {
  properties: {
    device_id: { type: 'keyword' },
    policy_id: { type: 'keyword' },
    policy_version: { type: 'integer' },
    evaluation_timestamp: { type: 'date' },
    deployment_status: { type: 'keyword' },
    setting_states: {
      type: 'nested',
      properties: {
        setting: { type: 'keyword' },
        display_name: { type: 'text' },
        state: { type: 'keyword' },
        error_code: { type: 'keyword' },
        error_description: { type: 'text' },
        desired_value: { type: 'object', enabled: false },
        actual_value: { type: 'object', enabled: false }
      }
    },
    error_codes: { type: 'keyword' },
    indexed_at: { type: 'date' }
  }
};
