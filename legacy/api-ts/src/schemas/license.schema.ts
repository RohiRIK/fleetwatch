export interface UnifiedLicenseDocument {
  // Core SKU Info
  id: string;                    // SKU ID (UUID)
  skuId: string;                 // Same as id
  skuPartNumber: string;         // Human-readable (e.g., "SPE_E5")
  displayName: string;           // Friendly name from LICENSE_SKU_MAP

  // Allocation Data
  total: number;                 // prepaidUnits.enabled
  assigned: number;              // consumedUnits
  unused: number;                // total - assigned

  // Pricing & Waste (from config)
  pricePerMonth: number;         // From LICENSE_PRICING config
  monthlyWaste: number;          // unused * pricePerMonth
  annualWaste: number;           // monthlyWaste * 12

  // Utilization Metrics
  utilizationRate: number;       // (assigned / total) * 100
  utilizationStatus: 'optimal' | 'acceptable' | 'poor';  // Based on thresholds

  // Service Plans
  servicePlans?: Array<{
    servicePlanId: string;
    servicePlanName: string;
    provisioningStatus?: string;
    appliesTo?: string;
  }>;

  // Additional SKU Details
  capabilityStatus?: string;
  prepaidUnits: {
    enabled: number;
    suspended: number;
    warning: number;
  };

  // Metadata
  ingestion: {
    timestamp: string;
    source: string;
    version: string;
  };
}

export const licenseMapping = {
  properties: {
    id: { type: 'keyword' },
    skuId: { type: 'keyword' },
    skuPartNumber: { type: 'keyword' },
    displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },

    total: { type: 'integer' },
    assigned: { type: 'integer' },
    unused: { type: 'integer' },

    pricePerMonth: { type: 'float' },
    monthlyWaste: { type: 'float' },
    annualWaste: { type: 'float' },

    utilizationRate: { type: 'float' },
    utilizationStatus: { type: 'keyword' },

    servicePlans: {
      type: 'nested',
      properties: {
        servicePlanId: { type: 'keyword' },
        servicePlanName: { type: 'keyword' },
        provisioningStatus: { type: 'keyword' },
        appliesTo: { type: 'keyword' }
      }
    },

    capabilityStatus: { type: 'keyword' },
    prepaidUnits: {
      properties: {
        enabled: { type: 'integer' },
        suspended: { type: 'integer' },
        warning: { type: 'integer' }
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

// License SKU Name Mapping (imported from user.schema.ts)
export const LICENSE_SKU_MAP: Record<string, string> = {
  // Microsoft 365
  'SPE_E3': 'Microsoft 365 E3',
  'SPE_E5': 'Microsoft 365 E5',
  'SPE_E1': 'Microsoft 365 E1',
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

  // Office Apps
  'OFFICESUBSCRIPTION': 'Microsoft 365 Apps for Enterprise',
  'STANDARDPACK': 'Office 365 E1',
  'ENTERPRISEPACK': 'Office 365 E3',
  'ENTERPRISEPREMIUM': 'Office 365 E5',
  'OFFICE_MOBILE_APPS_ENTERPRISE': 'Office Mobile Apps for Enterprise',

  // Exchange
  'EXCHANGESTANDARD': 'Exchange Online (Plan 1)',
  'EXCHANGEENTERPRISE': 'Exchange Online (Plan 2)',
  'EXCHANGEONLINE_PLAN1': 'Exchange Online (Plan 1)',
  'EXCHANGEONLINE_PLAN2': 'Exchange Online (Plan 2)',

  // SharePoint
  'SHAREPOINTSTANDARD': 'SharePoint Online (Plan 1)',
  'SHAREPOINTONLINE_PLAN1': 'SharePoint Online (Plan 1)',
  'SHAREPOINTONLINE_PLAN2': 'SharePoint Online (Plan 2)',

  // Power Platform
  'POWER_BI_PRO': 'Power BI Pro',
  'POWER_BI_PREMIUM_PER_USER': 'Power BI Premium Per User',
  'POWERAPPS_PER_USER': 'Power Apps Per User',
  'FLOW_PER_USER': 'Power Automate Per User',

  // Project & Visio
  'PROJECTPLAN3': 'Project Plan 3',
  'PROJECTPLAN5': 'Project Plan 5',
  'VISIOONLINE_PLAN1': 'Visio Plan 1',
  'VISIOONLINE_PLAN2': 'Visio Plan 2',

  // Teams
  'TEAMS_EXPLORATORY': 'Microsoft Teams Exploratory',
  'MCOSTANDARD': 'Microsoft Teams',

  // Security & Compliance
  'INFORMATION_PROTECTION_COMPLIANCE': 'Microsoft 365 E5 Information Protection and Governance',
  'M365_E5_SECURITY': 'Microsoft 365 E5 Security',
  'M365_E5_COMPLIANCE': 'Microsoft 365 E5 Compliance',
};
