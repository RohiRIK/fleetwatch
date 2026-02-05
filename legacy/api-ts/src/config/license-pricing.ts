/**
 * LICENSE PRICING - SINGLE SOURCE OF TRUTH
 *
 * This is the ONLY place where license prices are defined.
 * Frontend gets pricing from API responses, not a separate config.
 *
 * Update this file when Microsoft changes pricing.
 */
export const LICENSE_PRICING: Record<string, number> = {
  // Microsoft 365 Plans
  'SPE_E5': 57.00,
  'SPE_E3': 36.00,
  'SPE_E1': 12.00,
  'SPE_F1': 10.00,
  'SPE_F3': 8.00,
  'O365_BUSINESS_ESSENTIALS': 6.00,
  'O365_BUSINESS_PREMIUM': 12.50,
  'SPB': 22.00,
  'Microsoft_365_E3_(no_Teams)': 33.00,
  'Microsoft_365_Copilot': 30.00,

  // Intune & EMS
  'INTUNE_A': 6.00,
  'EMS': 10.00,

  // Azure AD Premium & Identity
  'AAD_PREMIUM': 6.00,
  'AAD_PREMIUM_P2': 9.00,
  'IDENTITY_THREAT_PROTECTION': 12.00,
  'Microsoft_Entra_ID_Governance': 7.00,

  // Exchange
  'EXCHANGESTANDARD': 4.00,
  'EXCHANGEENTERPRISE': 8.00,
  'EXCHANGEONLINE_PLAN1': 4.00,
  'EXCHANGEONLINE_PLAN2': 8.00,

  // SharePoint
  'SHAREPOINTSTANDARD': 5.00,
  'SHAREPOINTONLINE_PLAN1': 5.00,
  'SHAREPOINTONLINE_PLAN2': 10.00,
  'SHAREPOINTSTORAGE': 0.20, // Per GB usually, placeholder

  // Office Apps
  'OFFICESUBSCRIPTION': 12.00,
  'OFFICE_MOBILE_APPS_ENTERPRISE': 7.00,

  // Power Platform
  'POWER_BI_PRO': 10.00,
  'POWER_BI_PREMIUM_PER_USER': 20.00,
  'POWER_BI_STANDARD': 0.00, // Usually free
  'POWERAPPS_PER_USER': 20.00,
  'POWERAPPS_PER_APP_IW': 5.00,
  'POWERAPPS_VIRAL': 0.00,
  'POWERAPPS_DEV': 0.00,
  'FLOW_PER_USER': 15.00,
  'FLOW_BUSINESS_PROCESS': 0.00, // Often included
  'FLOW_FREE': 0.00,
  'VIRTUAL_AGENT_USL': 0.00, // Or usage based
  'Power_Virtual_Agents': 200.00, // Base tenant fee often
  'POWERAUTOMATE_ATTENDED_RPA': 40.00,

  // Project & Visio
  'PROJECTPLAN3': 30.00,
  'PROJECTPLAN5': 55.00,
  'PROJECTPROFESSIONAL': 1000.00, // Perpetual/Subscription high cost
  'VISIOONLINE_PLAN1': 5.00,
  'VISIOONLINE_PLAN2': 15.00,
  'VISIO_PLAN2_DEPT': 15.00,
  'VISIOCLIENT': 15.00, // Subscription

  // Teams & Voice
  'TEAMS_EXPLORATORY': 0.00,
  'MCOSTANDARD': 12.00,
  'Microsoft_Teams_Rooms_Basic': 0.00,
  'Microsoft_Teams_Rooms_Pro': 40.00,
  'Teams_Premium_(for_Departments)': 10.00,
  'PHONESYSTEM_VIRTUALUSER': 0.00,

  // Security & Compliance
  'INFORMATION_PROTECTION_COMPLIANCE': 12.00,
  'M365_E5_SECURITY': 12.00,
  'M365_E5_COMPLIANCE': 12.00,
  'Microsoft_Hunting_Experts': 0.00, // Often add-on
  'Insider_Risk_Management_Forensic_Evidence_100GB_Add_on': 0.00,
  'RMSBASIC': 0.00, // Rights Management often included

  // Other
  'STREAM': 0.00,
  'WINDOWS_STORE': 0.00,
  'CCIBOTS_PRIVPREV_VIRAL': 0.00
};

/**
 * Get price for a SKU (returns 0 for unknown SKUs)
 */
export function getLicensePrice(skuPartNumber: string): number {
  return LICENSE_PRICING[skuPartNumber] || 0;
}

/**
 * Get all SKUs with pricing
 */
export function getAllPricedSkus(): string[] {
  return Object.keys(LICENSE_PRICING);
}
