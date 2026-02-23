/**
 * Recommendation Engine
 * 
 * Core rule engine for evaluating device conditions and generating recommendations.
 * Issue #58: Intelligent Recommendation Engine for Fleet Health Analytics
 */

import type { devices, users, device_analytics } from '@/lib/db/schema';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'security' | 'compliance' | 'performance' | 'maintenance' | 'license';

export type Device = typeof devices.$inferSelect;
export type User = typeof users.$inferSelect;
export type Analytics = typeof device_analytics.$inferSelect;

export interface RecommendationRule {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  description: string;
  evaluate: (device: Device, analytics?: Analytics, user?: User) => boolean;
  getTitle: (device: Device, analytics?: Analytics, user?: User) => string;
  getDescription: (device: Device, analytics?: Analytics, user?: User) => string;
}

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 5,
};

export function calculatePriorityScore(
  severity: Severity,
  deviceCount: number = 1,
  isPrimaryUser: boolean = false,
  isCorporateDevice: boolean = false
): number {
  let score = SEVERITY_WEIGHTS[severity] * deviceCount;
  
  if (isPrimaryUser) score *= 2;
  else if (isCorporateDevice) score *= 1.5;
  
  return Math.round(score);
}

// ============================================================================
// SECURITY RULES (12 rules)
// ============================================================================

const securityRules: RecommendationRule[] = [
  {
    id: 'SEC-001',
    name: 'BitLocker Not Enabled',
    category: 'security',
    severity: 'critical',
    description: 'Device encryption is not enabled. Data is at risk if device is lost or stolen.',
    evaluate: (device) => device.isEncrypted === false,
    getTitle: (d) => `BitLocker/FileVault not enabled on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} (${d.serialNumber || 'unknown serial'}) does not have disk encryption enabled.`,
  },
  {
    id: 'SEC-002',
    name: 'Device Jailbroken',
    category: 'security',
    severity: 'critical',
    description: 'Device has been jailbroken or rooted, bypassing security controls.',
    evaluate: (device) => device.jailBroken === 'Yes' || device.jailBroken === 'true',
    getTitle: (d) => `Security compromised: ${d.deviceName} is jailbroken`,
    getDescription: (d) => `Device ${d.deviceName} has been jailbroken or rooted, bypassing all security controls.`,
  },
  {
    id: 'SEC-003',
    name: 'Active Malware',
    category: 'security',
    severity: 'critical',
    description: 'Active malware or threat detected on device.',
    evaluate: (device) => device.partnerReportedThreatState === 'active' || (device.malwareActiveCount !== null && device.malwareActiveCount > 0),
    getTitle: (d) => `Malware detected on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has ${d.malwareActiveCount || 'unknown'} active malware detections.`,
  },
  {
    id: 'SEC-004',
    name: 'TPM Not Present',
    category: 'security',
    severity: 'critical',
    description: 'Trusted Platform Module (TPM) is not present on this device.',
    evaluate: (device) => device.tpmPresent === false,
    getTitle: (d) => `TPM not present on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} does not have a TPM chip, which is required for BitLocker encryption.`,
  },
  {
    id: 'SEC-005',
    name: 'Secure Boot Disabled',
    category: 'security',
    severity: 'critical',
    description: 'Secure Boot is disabled, increasing risk of bootkit attacks.',
    evaluate: (device) => device.secureBootEnabled === false,
    getTitle: (d) => `Secure Boot disabled on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has Secure Boot disabled, which protects against boot-level malware.`,
  },
  {
    id: 'SEC-006',
    name: 'Code Integrity Disabled',
    category: 'security',
    severity: 'critical',
    description: 'Code Integrity is disabled, allowing unsigned code to run.',
    evaluate: (device) => device.codeIntegrityEnabled === false,
    getTitle: (d) => `Code Integrity disabled on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has Code Integrity disabled, reducing protection against malware.`,
  },
  {
    id: 'SEC-007',
    name: 'Boot Debugging Enabled',
    category: 'security',
    severity: 'critical',
    description: 'Boot debugging is enabled, which can be a security risk.',
    evaluate: (device) => device.bootDebuggingEnabled === true,
    getTitle: (d) => `Boot debugging enabled on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has boot debugging enabled, which should be disabled in production.`,
  },
  {
    id: 'SEC-008',
    name: 'Device Non-Compliant',
    category: 'security',
    severity: 'critical',
    description: 'Device does not meet compliance policies.',
    evaluate: (device) => device.isCompliant === false,
    getTitle: (d) => `${d.deviceName} is non-compliant`,
    getDescription: (d) => `Device ${d.deviceName} fails one or more compliance policies and must be remediated.`,
  },
  {
    id: 'SEC-009',
    name: 'Compliance Grace Period Expired',
    category: 'security',
    severity: 'critical',
    description: 'Compliance grace period has expired.',
    evaluate: (device) => device.complianceGracePeriodExpiration !== null && new Date(device.complianceGracePeriodExpiration) < new Date(),
    getTitle: (d) => `Compliance grace period expired on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} grace period for compliance has expired.`,
  },
  {
    id: 'SEC-010',
    name: 'Management Certificate Expiring',
    category: 'security',
    severity: 'critical',
    description: 'Management certificate will expire within 30 days.',
    evaluate: (device) => {
      if (!device.managementCertificateExpirationDate) return false;
      const expiryDate = new Date(device.managementCertificateExpirationDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate < thirtyDaysFromNow;
    },
    getTitle: (d) => `Management certificate expiring on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} management certificate expires on ${d.managementCertificateExpirationDate}.`,
  },
  {
    id: 'SEC-011',
    name: 'Exchange Sync Not Configured',
    category: 'security',
    severity: 'critical',
    description: 'Mobile device does not have Exchange ActiveSync configured.',
    evaluate: (device) => device.easActivated === false && (device.operatingSystem === 'iOS' || device.operatingSystem === 'Android'),
    getTitle: (d) => `Exchange sync not configured on ${d.deviceName}`,
    getDescription: (d) => `Mobile device ${d.deviceName} does not have Exchange ActiveSync configured for email.`,
  },
  {
    id: 'SEC-012',
    name: 'Unsupervised iOS Device',
    category: 'security',
    severity: 'high',
    description: 'iOS device is not supervised, limiting management capabilities.',
    evaluate: (device) => device.isSupervised === false && device.operatingSystem === 'iOS',
    getTitle: (d) => `${d.deviceName} is not supervised`,
    getDescription: (d) => `iOS device ${d.deviceName} is not supervised, limiting the ability to enforce security policies.`,
  },
];

// ============================================================================
// COMPLIANCE RULES (10 rules)
// ============================================================================

const complianceRules: RecommendationRule[] = [
  {
    id: 'COMP-001',
    name: 'Unknown Compliance State',
    category: 'compliance',
    severity: 'high',
    description: 'Device compliance state is unknown.',
    evaluate: (device) => device.complianceState === 'unknown',
    getTitle: (d) => `Unknown compliance state for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has an unknown compliance state and needs to be evaluated.`,
  },
  {
    id: 'COMP-002',
    name: 'Compliance Not Applicable',
    category: 'compliance',
    severity: 'high',
    description: 'Compliance policies are not applicable to this device.',
    evaluate: (device) => device.complianceState === 'notApplicable',
    getTitle: (d) => `Compliance not applicable for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} does not have applicable compliance policies.`,
  },
  {
    id: 'COMP-003',
    name: 'Compliance Conflict',
    category: 'compliance',
    severity: 'high',
    description: 'Device has conflicting compliance policies.',
    evaluate: (device) => device.complianceState === 'conflict',
    getTitle: (d) => `Compliance conflict on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has conflicting compliance policies that need resolution.`,
  },
  {
    id: 'COMP-004',
    name: 'Device Unmanaged',
    category: 'compliance',
    severity: 'high',
    description: 'Device is not being actively managed.',
    evaluate: (device) => device.managementState === 'unmanaged',
    getTitle: (d) => `${d.deviceName} is unmanaged`,
    getDescription: (d) => `Device ${d.deviceName} is not actively managed and should be enrolled in MDM.`,
  },
  {
    id: 'COMP-005',
    name: 'Device Pending Retirement',
    category: 'compliance',
    severity: 'high',
    description: 'Device is pending retirement.',
    evaluate: (device) => device.managementState === 'retirePending',
    getTitle: (d) => `${d.deviceName} pending retirement`,
    getDescription: (d) => `Device ${d.deviceName} is marked for retirement. Consider backing up data.`,
  },
  {
    id: 'COMP-006',
    name: 'No Autopilot Profile',
    category: 'compliance',
    severity: 'high',
    description: 'Device has no Autopilot profile assigned.',
    evaluate: (device) => !device.enrollmentProfileName,
    getTitle: (d) => `No Autopilot profile for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} does not have an Autopilot profile assigned.`,
  },
  {
    id: 'COMP-007',
    name: 'User Enrollment Approval Pending',
    category: 'compliance',
    severity: 'high',
    description: 'User enrollment approval is pending.',
    evaluate: (device) => device.requireUserEnrollmentApproval === true,
    getTitle: (d) => `Enrollment approval pending for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} requires user enrollment approval.`,
  },
  {
    id: 'COMP-008',
    name: 'Remote Assistance Error',
    category: 'compliance',
    severity: 'high',
    description: 'Remote assistance has an error.',
    evaluate: (device) => !!device.remoteAssistanceSessionErrorDetails,
    getTitle: (d) => `Remote assistance error on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has remote assistance errors: ${d.remoteAssistanceSessionErrorDetails}`,
  },
  {
    id: 'COMP-009',
    name: 'Weak Join Type',
    category: 'compliance',
    severity: 'high',
    description: 'Device is Azure AD Registered instead of Joined.',
    evaluate: (device) => device.joinType === 'AzureADRegistered',
    getTitle: (d) => `Weak join type for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} is Azure AD Registered (personal). Consider hybrid Azure AD join.`,
  },
  {
    id: 'COMP-010',
    name: 'Not Synced from On-Premises AD',
    category: 'compliance',
    severity: 'medium',
    description: 'Corporate user device not synced from on-premises AD.',
    evaluate: (device) => {
      const onPremises = (device as unknown as { onPremisesSyncEnabled?: boolean }).onPremisesSyncEnabled;
      return onPremises === false && device.managedDeviceOwnerType === 'company';
    },
    getTitle: (d) => `On-prem AD sync disabled for ${d.deviceName}`,
    getDescription: (d) => `Corporate device ${d.deviceName} is not synced from on-premises AD.`,
  },
];

// ============================================================================
// PERFORMANCE RULES (12 rules)
// ============================================================================

const performanceRules: RecommendationRule[] = [
  {
    id: 'PERF-001',
    name: 'Low Disk Space',
    category: 'performance',
    severity: 'medium',
    description: 'Device has less than 10GB free disk space.',
    evaluate: (device) => device.storageFree !== null && device.storageFree < 10 * 1024 * 1024 * 1024,
    getTitle: (d) => `Low disk space on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has less than 10GB free. Current: ${Math.round((d.storageFree || 0) / (1024*1024*1024))}GB`,
  },
  {
    id: 'PERF-002',
    name: 'Critical Low Disk Space',
    category: 'performance',
    severity: 'high',
    description: 'Device has less than 5GB free disk space.',
    evaluate: (device) => device.storageFree !== null && device.storageFree < 5 * 1024 * 1024 * 1024,
    getTitle: (d) => `Critical: Low disk space on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has less than 5GB free. Current: ${Math.round((d.storageFree || 0) / (1024*1024*1024))}GB`,
  },
  {
    id: 'PERF-003',
    name: 'Battery Health Degraded',
    category: 'performance',
    severity: 'medium',
    description: 'Battery health is below 80%.',
    evaluate: (device) => device.batteryHealth !== null && device.batteryHealth < 80,
    getTitle: (d) => `Battery health degraded on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} battery health is ${d.batteryHealth}%. Consider battery replacement.`,
  },
  {
    id: 'PERF-004',
    name: 'High Battery Charge Cycles',
    category: 'performance',
    severity: 'medium',
    description: 'Battery has more than 500 charge cycles.',
    evaluate: (device) => device.batteryChargeCycles !== null && device.batteryChargeCycles > 500,
    getTitle: (d) => `High battery cycles on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has ${d.batteryChargeCycles} charge cycles. Battery may need replacement.`,
  },
  {
    id: 'PERF-005',
    name: 'Low Battery',
    category: 'performance',
    severity: 'low',
    description: 'Current battery level is below 20%.',
    evaluate: (device) => device.batteryLevelPercentage !== null && device.batteryLevelPercentage < 20,
    getTitle: (d) => `Low battery on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} battery is at ${d.batteryLevelPercentage}%. Consider charging.`,
  },
  {
    id: 'PERF-006',
    name: 'Low RAM',
    category: 'performance',
    severity: 'medium',
    description: 'Device has less than 8GB RAM.',
    evaluate: (device) => device.memoryTotal !== null && device.memoryTotal < 8 * 1024 * 1024 * 1024,
    getTitle: (d) => `Low RAM on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has ${Math.round((d.memoryTotal || 0) / (1024*1024*1024))}GB RAM.`,
  },
  {
    id: 'PERF-007',
    name: 'Poor Device Health Score',
    category: 'performance',
    severity: 'high',
    description: 'Device analytics overall score is below 50.',
    evaluate: (_device, analytics) => analytics !== null && analytics !== undefined && (analytics.overallScore || 0) < 50,
    getTitle: (_d, _a, user) => `Poor health score for ${user?.name || 'device'}`,
    getDescription: (_d, analytics) => `Device health score is ${analytics?.overallScore || 'unknown'}/100.`,
  },
  {
    id: 'PERF-008',
    name: 'Slow Boot Performance',
    category: 'performance',
    severity: 'medium',
    description: 'Device startup score is below 50.',
    evaluate: (_device, analytics) => analytics !== null && analytics !== undefined && (analytics.startupScore || 0) < 50,
    getTitle: (_d, analytics) => `Slow boot on device`,
    getDescription: (_d, analytics) => `Device startup score is ${analytics?.startupScore || 'unknown'}/100.`,
  },
  {
    id: 'PERF-009',
    name: 'Recent Blue Screen',
    category: 'performance',
    severity: 'high',
    description: 'Device has experienced blue screen errors.',
    evaluate: (_device, analytics) => analytics !== null && analytics !== undefined && (analytics.blueScreenCount || 0) > 0,
    getTitle: (_d, analytics) => `Blue screen errors detected`,
    getDescription: (_d, analytics) => `Device has experienced ${analytics?.blueScreenCount || 0} blue screen errors.`,
  },
  {
    id: 'PERF-010',
    name: 'Slow Boot Time',
    category: 'performance',
    severity: 'medium',
    description: 'Core boot time exceeds 60 seconds.',
    evaluate: (_device, analytics) => analytics !== null && analytics !== undefined && (analytics.coreBootTimeMs || 0) > 60000,
    getTitle: (_d, analytics) => `Slow boot time detected`,
    getDescription: (_d, analytics) => `Device boot time is ${Math.round((analytics?.coreBootTimeMs || 0) / 1000)} seconds.`,
  },
  {
    id: 'PERF-011',
    name: 'Low Time to Failure',
    category: 'performance',
    severity: 'medium',
    description: 'Mean time to failure is below 1000 minutes.',
    evaluate: (_device, analytics) => analytics !== null && analytics !== undefined && (analytics.meanTimeToFailureMinutes || 0) < 1000,
    getTitle: (_d, analytics) => `Low time to failure`,
    getDescription: (_d, analytics) => `Device mean time to failure is ${analytics?.meanTimeToFailureMinutes || 'unknown'} minutes.`,
  },
  {
    id: 'PERF-012',
    name: 'Desktop Missing Display',
    category: 'performance',
    severity: 'low',
    description: 'Desktop device has no monitor connected.',
    evaluate: (device) => device.chassisType === 'desktop',
    getTitle: (d) => `Desktop display status unknown for ${d.deviceName}`,
    getDescription: (d) => `Desktop ${d.deviceName} display connection status is unknown.`,
  },
];

// ============================================================================
// MAINTENANCE RULES (9 rules)
// ============================================================================

const maintenanceRules: RecommendationRule[] = [
  {
    id: 'MAINT-001',
    name: 'Missing OS Version',
    category: 'maintenance',
    severity: 'low',
    description: 'Operating system version is not recorded.',
    evaluate: (device) => !device.osVersion,
    getTitle: (d) => `Missing OS version for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} does not have an OS version recorded.`,
  },
  {
    id: 'MAINT-002',
    name: 'Outdated OS',
    category: 'maintenance',
    severity: 'medium',
    description: 'Operating system is significantly outdated.',
    evaluate: (device) => {
      if (!device.osVersion) return false;
      const versionMatch = device.osVersion.match(/(\d+)/);
      if (!versionMatch) return false;
      const majorVersion = parseInt(versionMatch[1]);
      const currentMajor = device.operatingSystem === 'Windows' ? 11 : device.operatingSystem === 'macOS' ? 15 : device.operatingSystem === 'iOS' ? 18 : 14;
      return majorVersion < currentMajor - 2;
    },
    getTitle: (d) => `Outdated OS on ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} is running outdated OS: ${d.osVersion}`,
  },
  {
    id: 'MAINT-003',
    name: 'Device Older Than 3 Years',
    category: 'maintenance',
    severity: 'low',
    description: 'Device enrollment date is more than 3 years ago.',
    evaluate: (device) => {
      if (!device.enrolledAt) return false;
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      return new Date(device.enrolledAt) < threeYearsAgo;
    },
    getTitle: (d) => `${d.deviceName} is over 3 years old`,
    getDescription: (d) => `Device ${d.deviceName} was enrolled on ${d.enrolledAt}. Consider replacement.`,
  },
  {
    id: 'MAINT-004',
    name: 'Device Not Synced Recently',
    category: 'maintenance',
    severity: 'medium',
    description: 'Device has not synced in more than 7 days.',
    evaluate: (device) => {
      if (!device.lastSyncAt) return true;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return new Date(device.lastSyncAt) < sevenDaysAgo;
    },
    getTitle: (d) => `${d.deviceName} not synced recently`,
    getDescription: (d) => `Device ${d.deviceName} last synced on ${d.lastSyncAt || 'unknown'}.`,
  },
  {
    id: 'MAINT-005',
    name: 'Stale Device',
    category: 'maintenance',
    severity: 'low',
    description: 'Device has not synced in more than 30 days.',
    evaluate: (device) => {
      if (!device.lastSyncAt) return false;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return new Date(device.lastSyncAt) < thirtyDaysAgo;
    },
    getTitle: (d) => `${d.deviceName} is stale`,
    getDescription: (d) => `Device ${d.deviceName} has not synced in over 30 days.`,
  },
  {
    id: 'MAINT-006',
    name: 'Missing Serial Number',
    category: 'maintenance',
    severity: 'low',
    description: 'Device serial number is not recorded.',
    evaluate: (device) => !device.serialNumber,
    getTitle: (d) => `Missing serial number for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} does not have a serial number recorded.`,
  },
  {
    id: 'MAINT-007',
    name: 'Missing Manufacturer',
    category: 'maintenance',
    severity: 'low',
    description: 'Device manufacturer is not recorded.',
    evaluate: (device) => !device.manufacturer,
    getTitle: (d) => `Missing manufacturer for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} manufacturer is not recorded.`,
  },
  {
    id: 'MAINT-008',
    name: 'Missing Model',
    category: 'maintenance',
    severity: 'low',
    description: 'Device model is not recorded.',
    evaluate: (device) => !device.model,
    getTitle: (d) => `Missing model for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} model is not recorded.`,
  },
  {
    id: 'MAINT-009',
    name: 'No Admin Notes',
    category: 'maintenance',
    severity: 'low',
    description: 'Device has no admin notes.',
    evaluate: (device) => !device.notes,
    getTitle: (d) => `No admin notes for ${d.deviceName}`,
    getDescription: (d) => `Device ${d.deviceName} has no admin notes. Consider adding context.`,
  },
];

// ============================================================================
// LICENSE RULES (5 rules)
// ============================================================================

const licenseRules: RecommendationRule[] = [
  {
    id: 'LIC-001',
    name: 'Suspended License',
    category: 'license',
    severity: 'high',
    description: 'User license is suspended.',
    evaluate: () => false,
    getTitle: (_d, _a, user) => `License suspended for ${user?.name || 'user'}`,
    getDescription: (_d, _a, user) => `User ${user?.email || 'unknown'} has a suspended license.`,
  },
  {
    id: 'LIC-002',
    name: 'No License Assigned',
    category: 'license',
    severity: 'medium',
    description: 'User has devices but no license assigned.',
    evaluate: () => false,
    getTitle: (_d, _a, user) => `No license for ${user?.name || 'user'}`,
    getDescription: (_d, _a, user) => `User ${user?.email || 'unknown'} has no Microsoft 365 license.`,
  },
  {
    id: 'LIC-003',
    name: 'Too Many Devices',
    category: 'license',
    severity: 'low',
    description: 'User has more than 5 devices.',
    evaluate: (_device, _analytics, user) => (user?.totalDevices || 0) > 5,
    getTitle: (_d, _a, user) => `Many devices for ${user?.name || 'user'}`,
    getDescription: (_d, _a, user) => `User ${user?.email || 'unknown'} has ${user?.totalDevices || 0} devices.`,
  },
  {
    id: 'LIC-004',
    name: 'Low User Compliance',
    category: 'license',
    severity: 'medium',
    description: 'User has less than 50% compliant devices.',
    evaluate: (_device, _analytics, user) => {
      const total = user?.totalDevices || 0;
      const compliant = user?.compliantDevices || 0;
      return total > 0 && (compliant / total) < 0.5;
    },
    getTitle: (_d, _a, user) => `Low compliance for ${user?.name || 'user'}`,
    getDescription: (_d, _a, user) => `User ${user?.email || 'unknown'} has ${user?.compliantDevices}/${user?.totalDevices} compliant devices.`,
  },
  {
    id: 'LIC-005',
    name: 'Inactive User',
    category: 'license',
    severity: 'low',
    description: 'User has not signed in for over 90 days.',
    evaluate: (_device, _analytics, user) => {
      if (!user?.lastSignInDateTime) return true;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return new Date(user.lastSignInDateTime) < ninetyDaysAgo;
    },
    getTitle: (_d, _a, user) => `Inactive user: ${user?.name || 'unknown'}`,
    getDescription: (_d, _a, user) => `User ${user?.email || 'unknown'} has not signed in for 90+ days.`,
  },
];

// ============================================================================
// ALL RULES
// ============================================================================

export const allRules: RecommendationRule[] = [
  ...securityRules,
  ...complianceRules,
  ...performanceRules,
  ...maintenanceRules,
  ...licenseRules,
];

export function getRulesByCategory(category: Category): RecommendationRule[] {
  return allRules.filter(rule => rule.category === category);
}

export function getRulesBySeverity(severity: Severity): RecommendationRule[] {
  return allRules.filter(rule => rule.severity === severity);
}

export function getRuleById(id: string): RecommendationRule | undefined {
  return allRules.find(rule => rule.id === id);
}
