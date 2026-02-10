import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';

/**
 * GET /api/security/fleet
 * 
 * Aggregates security data across all devices in the fleet.
 * Uses the new security_details JSONB column from Phase 2/3.
 * 
 * Returns:
 * - BitLocker status (enabled/disabled/unknown)
 * - Windows Defender status
 * - Firewall status
 * - TPM presence
 * - Secure Boot status
 * - Device list with security status
 */
export async function GET() {
  try {
    // Fetch all active devices with security details
    const allDevices = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        manufacturer: devices.manufacturer,
        model: devices.model,
        isEncrypted: devices.isEncrypted,
        jailBroken: devices.jailBroken,
        partnerReportedThreatState: devices.partnerReportedThreatState,
        userDisplayName: devices.userDisplayName,
        userEmail: devices.userEmail,
        securityDetails: devices.securityDetails,
        lastSyncAt: devices.lastSyncAt,
      })
      .from(devices)
      .where(isNull(devices.deletedAt));

    // Initialize counters
    const stats = {
      totalDevices: allDevices.length,
      // BitLocker/FileVault (Encryption)
      bitLockerEnabled: 0,
      bitLockerDisabled: 0,
      bitLockerUnknown: 0,
      // Windows Defender
      defenderEnabled: 0,
      defenderDisabled: 0,
      defenderUnknown: 0,
      // Firewall
      firewallEnabled: 0,
      firewallDisabled: 0,
      firewallUnknown: 0,
      // TPM
      tpmPresent: 0,
      tpmAbsent: 0,
      tpmUnknown: 0,
      // Secure Boot
      secureBootEnabled: 0,
      secureBootDisabled: 0,
      secureBootUnknown: 0,
      // Threat detection
      threatsDetected: 0,
      // Jailbroken devices
      jailBroken: 0,
    };

    // Security issue devices (detailed list)
    const securityIssues: Array<{
      id: string;
      deviceName: string;
      operatingSystem: string;
      userDisplayName: string;
      userEmail: string;
      issues: string[];
      severity: 'critical' | 'high' | 'medium' | 'low';
    }> = [];

    // Categorize each device
    allDevices.forEach((device) => {
      const security = device.securityDetails as any;
      const issues: string[] = [];

      // BitLocker/Encryption check
      if (device.isEncrypted) {
        stats.bitLockerEnabled++;
      } else if (security?.bitLockerEnabled === true) {
        stats.bitLockerEnabled++;
      } else if (security?.bitLockerEnabled === false) {
        stats.bitLockerDisabled++;
        issues.push('BitLocker/Encryption disabled');
      } else if (device.isEncrypted === false) {
        stats.bitLockerDisabled++;
        issues.push('Device not encrypted');
      } else {
        stats.bitLockerUnknown++;
      }

      // Windows Defender check (Windows only)
      if (device.operatingSystem?.toLowerCase().includes('windows')) {
        if (security?.defenderEnabled === true || security?.defenderStatus === 'active') {
          stats.defenderEnabled++;
        } else if (security?.defenderEnabled === false || security?.defenderStatus === 'inactive') {
          stats.defenderDisabled++;
          issues.push('Windows Defender disabled');
        } else {
          stats.defenderUnknown++;
        }
      }

      // Firewall check
      if (security?.firewallEnabled === true) {
        stats.firewallEnabled++;
      } else if (security?.firewallEnabled === false) {
        stats.firewallDisabled++;
        issues.push('Firewall disabled');
      } else {
        stats.firewallUnknown++;
      }

      // TPM check (Windows only)
      if (device.operatingSystem?.toLowerCase().includes('windows')) {
        if (security?.tpmPresent === true || security?.tpmVersion) {
          stats.tpmPresent++;
        } else if (security?.tpmPresent === false) {
          stats.tpmAbsent++;
          issues.push('TPM not present');
        } else {
          stats.tpmUnknown++;
        }
      }

      // Secure Boot check (Windows only)
      if (device.operatingSystem?.toLowerCase().includes('windows')) {
        if (security?.secureBootEnabled === true) {
          stats.secureBootEnabled++;
        } else if (security?.secureBootEnabled === false) {
          stats.secureBootDisabled++;
          issues.push('Secure Boot disabled');
        } else {
          stats.secureBootUnknown++;
        }
      }

      // Threat state check
      if (device.partnerReportedThreatState && device.partnerReportedThreatState !== 'unknown') {
        stats.threatsDetected++;
        issues.push(`Threat detected: ${device.partnerReportedThreatState}`);
      }

      // Jailbroken check
      if (device.jailBroken && device.jailBroken !== 'Unknown') {
        stats.jailBroken++;
        issues.push('Device is jailbroken/rooted');
      }

      // Add to security issues if any found
      if (issues.length > 0) {
        let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
        
        // Determine severity based on issues
        if (issues.some(i => i.includes('jailbroken') || i.includes('Threat detected'))) {
          severity = 'critical';
        } else if (issues.some(i => i.includes('BitLocker') || i.includes('Encryption'))) {
          severity = 'high';
        } else if (issues.some(i => i.includes('Defender') || i.includes('TPM'))) {
          severity = 'high';
        } else if (issues.some(i => i.includes('Firewall') || i.includes('Secure Boot'))) {
          severity = 'medium';
        }

        securityIssues.push({
          id: device.id,
          deviceName: device.deviceName || 'Unknown Device',
          operatingSystem: device.operatingSystem || 'Unknown',
          userDisplayName: device.userDisplayName || 'Unknown User',
          userEmail: device.userEmail || 'No email',
          issues,
          severity,
        });
      }
    });

    // Calculate percentages
    const percentages = {
      bitLockerEnabled: stats.totalDevices > 0 
        ? ((stats.bitLockerEnabled / stats.totalDevices) * 100).toFixed(1) 
        : '0.0',
      defenderEnabled: stats.totalDevices > 0 
        ? ((stats.defenderEnabled / stats.totalDevices) * 100).toFixed(1) 
        : '0.0',
      firewallEnabled: stats.totalDevices > 0 
        ? ((stats.firewallEnabled / stats.totalDevices) * 100).toFixed(1) 
        : '0.0',
      tpmPresent: stats.totalDevices > 0 
        ? ((stats.tpmPresent / stats.totalDevices) * 100).toFixed(1) 
        : '0.0',
      secureBootEnabled: stats.totalDevices > 0 
        ? ((stats.secureBootEnabled / stats.totalDevices) * 100).toFixed(1) 
        : '0.0',
    };

    // Sort security issues by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    securityIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      success: true,
      stats,
      percentages,
      securityIssues,
      securityIssueCount: securityIssues.length,
      criticalIssues: securityIssues.filter(i => i.severity === 'critical').length,
      highIssues: securityIssues.filter(i => i.severity === 'high').length,
      mediumIssues: securityIssues.filter(i => i.severity === 'medium').length,
      lowIssues: securityIssues.filter(i => i.severity === 'low').length,
    });
  } catch (error) {
    console.error('Failed to fetch fleet security data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch fleet security data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
