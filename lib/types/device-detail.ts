/**
 * Device Detail Extended Types
 * 
 * TypeScript interfaces for the 25 new device properties added in Phase 3.
 * These extend the base Device type from Drizzle schema.
 */

import { Device } from '@/lib/db/schema';

// ============================================================================
// Hardware Information (10 fields)
// ============================================================================

export interface DeviceHardwareInfo {
  /** Mobile Equipment Identifier */
  meid: string | null;
  
  /** Integrated Circuit Card Identifier (SIM card ID) */
  iccid: string | null;
  
  /** Unique Device Identifier (Apple devices) */
  udid: string | null;
  
  /** Mobile carrier name */
  subscriberCarrier: string | null;
  
  /** Battery serial number */
  batterySerialNumber: string | null;
  
  /** Number of battery charge cycles */
  batteryChargeCycles: number | null;
  
  /** Current battery level percentage (0-100) */
  batteryLevelPercentage: number | null;
  
  /** Number of resident users on device */
  residentUsersCount: number | null;
  
  /** Product marketing name (e.g., "MacBook Pro") */
  productName: string | null;
  
  /** Full qualified domain name */
  deviceFullQualifiedDomainName: string | null;
}

// ============================================================================
// Management Information (8 fields)
// ============================================================================

export interface DeviceManagementInfo {
  /** Management agent type (mdm, eas, etc.) */
  managementAgent: string | null;
  
  /** Management certificate expiration date */
  managementCertificateExpirationDate: Date | null;
  
  /** Management features enabled */
  managementFeatures: string | null;
  
  /** Remote assistance session URL */
  remoteAssistanceSessionUrl: string | null;
  
  /** Error details from remote assistance */
  remoteAssistanceSessionErrorDetails: string | null;
  
  /** Whether user enrollment approval is required */
  requireUserEnrollmentApproval: boolean | null;
  
  /** Enrollment profile name */
  enrollmentProfileName: string | null;
}

// ============================================================================
// Security Hardware (4 fields)
// ============================================================================

export interface DeviceSecurityHardware {
  /** TPM (Trusted Platform Module) present */
  tpmPresent: boolean | null;
  
  /** Secure Boot enabled */
  secureBootEnabled: boolean | null;
  
  /** Code Integrity enabled */
  codeIntegrityEnabled: boolean | null;
  
  /** Boot debugging enabled (security risk if true) */
  bootDebuggingEnabled: boolean | null;
}

// ============================================================================
// Exchange ActiveSync (3 fields)
// ============================================================================

export interface DeviceExchangeActiveSync {
  /** Whether EAS is activated */
  easActivated: boolean | null;
  
  /** Exchange ActiveSync device ID */
  easDeviceId: string | null;
  
  /** Last successful Exchange sync */
  exchangeLastSuccessfulSyncDateTime: Date | null;
}

// ============================================================================
// Malware Protection (1 field)
// ============================================================================

export interface DeviceMalwareInfo {
  /** Number of active malware threats */
  malwareActiveCount: number | null;
  
  /** Number of remediated malware threats */
  malwareRemediatedCount: number | null;
}

// ============================================================================
// Extended Device Type
// ============================================================================

export interface ExtendedDevice extends Device {
  // Hardware
  meid: string | null;
  iccid: string | null;
  udid: string | null;
  subscriberCarrier: string | null;
  batterySerialNumber: string | null;
  batteryChargeCycles: number | null;
  batteryLevelPercentage: number | null;
  residentUsersCount: number | null;
  productName: string | null;
  deviceFullQualifiedDomainName: string | null;
  
  // Management
  managementAgent: string | null;
  managementCertificateExpirationDate: Date | null;
  managementFeatures: string | null;
  remoteAssistanceSessionUrl: string | null;
  remoteAssistanceSessionErrorDetails: string | null;
  requireUserEnrollmentApproval: boolean | null;
  enrollmentProfileName: string | null;
  
  // Security Hardware
  tpmPresent: boolean | null;
  secureBootEnabled: boolean | null;
  codeIntegrityEnabled: boolean | null;
  bootDebuggingEnabled: boolean | null;
  
  // Exchange ActiveSync
  easActivated: boolean | null;
  easDeviceId: string | null;
  exchangeLastSuccessfulSyncDateTime: Date | null;
  
  // Malware
  malwareActiveCount: number | null;
  malwareRemediatedCount: number | null;
}

// ============================================================================
// Helper Types for UI Components
// ============================================================================

export interface HardwareDisplayData {
  label: string;
  value: string | number | null;
  icon?: string;
  isSecuritySensitive?: boolean;
}

export interface ManagementStatus {
  status: 'active' | 'expired' | 'warning' | 'unknown';
  message: string;
  details?: Record<string, string | null>;
}

export interface SecurityStatus {
  level: 'secure' | 'warning' | 'critical' | 'unknown';
  features: Array<{
    name: string;
    enabled: boolean | null;
    description: string;
  }>;
}

export interface ExchangeStatus {
  isActive: boolean;
  lastSync: Date | null;
  deviceId: string | null;
}

export interface MalwareStatus {
  threatLevel: 'clean' | 'low' | 'medium' | 'high' | 'unknown';
  activeThreats: number;
  remediatedThreats: number;
  lastScan?: Date | null;
}
