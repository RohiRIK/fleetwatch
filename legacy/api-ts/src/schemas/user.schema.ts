// Unified User Document Schema
// Correlates user data with their devices, licenses, and aggregated device analytics

export interface UnifiedUserDocument {
  // === Core Identity ===
  id: string;                    // Primary key (user.id)
  userPrincipalName: string;     // UPN (email-like identifier)
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;

  // === Employment Info ===
  employment?: {
    jobTitle?: string;
    department?: string;
    officeLocation?: string;
    employeeId?: string;
    employeeType?: string;
    companyName?: string;
    hireDate?: string;
    leaveDate?: string;
  };

  // === Contact Info ===
  contact?: {
    mobilePhone?: string;
    businessPhones?: string[];
    otherEmails?: string[];
  };

  // === Account Status ===
  account?: {
    enabled: boolean;
    userType?: string;
    createdDateTime?: string;
    usageLocation?: string;
    onPremisesSyncEnabled?: boolean;
    securityIdentifier?: string;
  };

  // === Licenses ===
  licenses?: {
    assigned: Array<{
      skuId: string;
      skuPartNumber?: string;
      servicePlans?: Array<{
        servicePlanId: string;
        servicePlanName?: string;
        provisioningStatus: string;
      }>;
    }>;
    summary: {
      totalLicenses: number;
      activeServices: number;
      hasIntuneEMS?: boolean;
      hasM365?: boolean;
      hasAADP?: boolean;
    };
  };

  // === Device Association ===
  devices?: {
    managed: Array<{
      deviceId: string;
      deviceName?: string;
      model?: string;
      operatingSystem?: string;
      complianceState?: string;
      lastSync?: string;
    }>;
    summary: {
      totalDevices: number;
      compliantDevices: number;
      nonCompliantDevices: number;
      platforms: Record<string, number>; // { "Windows": 2, "iOS": 1 }
    };
  };

  // === Aggregated Device Analytics ===
  // User's "health score" based on all their devices
  analytics?: {
    overall?: {
      averageScore?: number;
      bestDevice?: string;
      worstDevice?: string;
      needsAttention: boolean;
    };

    startup?: {
      averageBootTimeMs?: number;
      averageLoginTimeMs?: number;
    };

    reliability?: {
      totalCrashes: number;
      totalHangs: number;
      affectedDevices: number;
      crashesLast7Days: number;
    };

    security?: {
      devicesWithDefenderIssues: number;
      devicesWithoutBitLocker: number;
      devicesWithPendingUpdates: number;
    };
  };

  // === Sign-in Activity ===
  signInActivity?: {
    lastSignInDateTime?: string;
    lastNonInteractiveSignInDateTime?: string;
    lastSuccessfulSignIn?: string;
    recentApplications?: Array<{
      appDisplayName: string;
      appId?: string;
      signInDateTime: string;
      resourceDisplayName?: string;
    }>;
  };

  // === Metadata ===
  dataQuality: {
    hasLicenses: boolean;
    hasDevices: boolean;
    hasAnalytics: boolean;
    hasSignInActivity: boolean;
    lastEnrichedAt: string;
  };

  ingestion: {
    timestamp: string;
    source: string;
    version: string;
  };
}

// OpenSearch mapping for the unified user document
export const userMapping = {
  properties: {
    id: { type: 'keyword' },
    userPrincipalName: { type: 'keyword' },
    displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    givenName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    surname: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    mail: { type: 'keyword' },

    employment: {
      properties: {
        jobTitle: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        department: { type: 'keyword' },
        officeLocation: { type: 'keyword' },
        employeeId: { type: 'keyword' },
        employeeType: { type: 'keyword' },
        companyName: { type: 'keyword' },
        hireDate: { type: 'date' },
        leaveDate: { type: 'date' }
      }
    },

    contact: {
      properties: {
        mobilePhone: { type: 'keyword' },
        businessPhones: { type: 'keyword' },
        otherEmails: { type: 'keyword' }
      }
    },

    account: {
      properties: {
        enabled: { type: 'boolean' },
        userType: { type: 'keyword' },
        createdDateTime: { type: 'date' },
        usageLocation: { type: 'keyword' },
        onPremisesSyncEnabled: { type: 'boolean' },
        securityIdentifier: { type: 'keyword' }
      }
    },

    licenses: {
      properties: {
        assigned: {
          type: 'nested',
          properties: {
            skuId: { type: 'keyword' },
            skuPartNumber: { type: 'keyword' },
            servicePlans: {
              type: 'nested',
              properties: {
                servicePlanId: { type: 'keyword' },
                servicePlanName: { type: 'keyword' },
                provisioningStatus: { type: 'keyword' }
              }
            }
          }
        },
        summary: {
          properties: {
            totalLicenses: { type: 'integer' },
            activeServices: { type: 'integer' },
            hasIntuneEMS: { type: 'boolean' },
            hasM365: { type: 'boolean' },
            hasAADP: { type: 'boolean' }
          }
        }
      }
    },

    devices: {
      properties: {
        managed: {
          type: 'nested',
          properties: {
            deviceId: { type: 'keyword' },
            deviceName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            model: { type: 'keyword' },
            operatingSystem: { type: 'keyword' },
            complianceState: { type: 'keyword' },
            lastSync: { type: 'date' }
          }
        },
        summary: {
          properties: {
            totalDevices: { type: 'integer' },
            compliantDevices: { type: 'integer' },
            nonCompliantDevices: { type: 'integer' },
            platforms: { type: 'object', enabled: false } // Dynamic field
          }
        }
      }
    },

    analytics: {
      properties: {
        overall: {
          properties: {
            averageScore: { type: 'double' },
            bestDevice: { type: 'keyword' },
            worstDevice: { type: 'keyword' },
            needsAttention: { type: 'boolean' }
          }
        },
        startup: {
          properties: {
            averageBootTimeMs: { type: 'integer' },
            averageLoginTimeMs: { type: 'integer' }
          }
        },
        reliability: {
          properties: {
            totalCrashes: { type: 'integer' },
            totalHangs: { type: 'integer' },
            affectedDevices: { type: 'integer' },
            crashesLast7Days: { type: 'integer' }
          }
        },
        security: {
          properties: {
            devicesWithDefenderIssues: { type: 'integer' },
            devicesWithoutBitLocker: { type: 'integer' },
            devicesWithPendingUpdates: { type: 'integer' }
          }
        }
      }
    },

    signInActivity: {
      properties: {
        lastSignInDateTime: { type: 'date' },
        lastNonInteractiveSignInDateTime: { type: 'date' },
        lastSuccessfulSignIn: { type: 'date' },
        recentApplications: { type: 'object', enabled: false }
      }
    },

    dataQuality: {
      properties: {
        hasLicenses: { type: 'boolean' },
        hasDevices: { type: 'boolean' },
        hasAnalytics: { type: 'boolean' },
        hasSignInActivity: { type: 'boolean' },
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

// Known license SKU mappings
export const LICENSE_SKU_MAP: Record<string, string> = {
  // Microsoft 365
  'SPE_E3': 'Microsoft 365 E3',
  'SPE_E5': 'Microsoft 365 E5',
  'SPE_F1': 'Microsoft 365 F1',
  'SPE_F3': 'Microsoft 365 F3',
  'O365_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
  'O365_BUSINESS_PREMIUM': 'Microsoft 365 Business Standard',
  'SPB': 'Microsoft 365 Business Premium',

  // Enterprise Mobility + Security
  'EMS': 'Enterprise Mobility + Security E3',
  'EMSPREMIUM': 'Enterprise Mobility + Security E5',
  'INTUNE_A': 'Microsoft Intune',

  // Azure AD Premium
  'AAD_PREMIUM': 'Azure Active Directory Premium P1',
  'AAD_PREMIUM_P2': 'Azure Active Directory Premium P2',

  // Office
  'OFFICESUBSCRIPTION': 'Microsoft 365 Apps for Enterprise',
  'STANDARDPACK': 'Office 365 E1',
  'ENTERPRISEPACK': 'Office 365 E3',
  'ENTERPRISEPREMIUM': 'Office 365 E5',
};
