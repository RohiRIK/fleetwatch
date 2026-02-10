import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

/**
 * Risk Level Categorization (based on user-approved mapping)
 * - Critical: Unencrypted, jailbroken, malware detected
 * - High: Outdated OS, Defender disabled, password violations
 * - Medium: Missing updates, weak passwords
 * - Low: Minor policy violations
 */

interface PolicyFailure {
  id: string;
  displayName: string;
  state: 'error' | 'nonCompliant' | 'compliant';
  settingCount: number;
  deviceId: string;
  deviceName: string;
}

interface PolicyBreakdown {
  policyId: string;
  policyName: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  failedCount: number;
  affectedDevices: Array<{
    id: string;
    name: string;
    manufacturer: string;
    os: string;
    user: string;
    // Phase 2 fields
    gracePeriodExpiration?: Date | null;
    threatState?: string | null;
    jailBroken: string;
  }>;
}

interface ComplianceByOS {
  osName: string;
  total: number;
  compliant: number;
  nonCompliant: number;
  complianceRate: string;
}

/**
 * Categorize policy by risk level based on display name keywords
 */
function categorizePolicyRiskLevel(policyName: string): 'critical' | 'high' | 'medium' | 'low' {
  const name = policyName.toLowerCase();
  
  // Critical: Encryption, jailbreak, malware
  if (
    name.includes('encrypt') ||
    name.includes('bitlocker') ||
    name.includes('filevault') ||
    name.includes('jailbreak') ||
    name.includes('malware') ||
    name.includes('root')
  ) {
    return 'critical';
  }
  
  // High: OS version, Defender, password requirements
  if (
    name.includes('os version') ||
    name.includes('operating system') ||
    name.includes('defender') ||
    name.includes('antivirus') ||
    name.includes('password') ||
    name.includes('firewall')
  ) {
    return 'high';
  }
  
  // Medium: Updates, security patches
  if (
    name.includes('update') ||
    name.includes('patch') ||
    name.includes('security') ||
    name.includes('minimum os')
  ) {
    return 'medium';
  }
  
  // Low: Everything else
  return 'low';
}

export async function GET() {
  try {
    // Fetch all devices with their compliance details (including Phase 2 fields)
    const allDevices = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        manufacturer: devices.manufacturer,
        operatingSystem: devices.operatingSystem,
        userDisplayName: devices.userDisplayName,
        isCompliant: devices.isCompliant,
        complianceDetails: devices.complianceDetails,
        // Phase 2 fields
        complianceGracePeriodExpiration: devices.complianceGracePeriodExpiration,
        partnerReportedThreatState: devices.partnerReportedThreatState,
        jailBroken: devices.jailBroken,
      })
      .from(devices)
      .where(isNotNull(devices.complianceDetails));

    // Parse compliance_details JSONB and extract policy failures
    const policyFailures: PolicyFailure[] = [];
    
    for (const device of allDevices) {
      if (!device.complianceDetails) continue;
      
      const details = device.complianceDetails as Array<{
        id: string;
        state: string;
        displayName?: string;
        settingCount?: number;
      }>;
      
      for (const policy of details) {
        // Only track failed policies (error or nonCompliant)
        if (policy.state === 'error' || policy.state === 'nonCompliant') {
          policyFailures.push({
            id: policy.id,
            displayName: policy.displayName || 'Unknown Policy',
            state: policy.state,
            settingCount: policy.settingCount || 0,
            deviceId: device.id,
            deviceName: device.deviceName || 'Unknown Device',
          });
        }
      }
    }

    // Group failures by policy
    const policyMap = new Map<string, PolicyBreakdown>();
    
    for (const failure of policyFailures) {
      if (!policyMap.has(failure.id)) {
        policyMap.set(failure.id, {
          policyId: failure.id,
          policyName: failure.displayName,
          riskLevel: categorizePolicyRiskLevel(failure.displayName),
          failedCount: 0,
          affectedDevices: [],
        });
      }
      
      const policy = policyMap.get(failure.id)!;
      policy.failedCount++;
      
      // Find device details
      const device = allDevices.find((d: typeof allDevices[0]) => d.id === failure.deviceId);
      if (device) {
        policy.affectedDevices.push({
          id: device.id,
          name: device.deviceName || 'Unknown',
          manufacturer: device.manufacturer || 'Unknown',
          os: device.operatingSystem || 'Unknown',
          user: device.userDisplayName || 'Unassigned',
          // Phase 2 fields
          gracePeriodExpiration: device.complianceGracePeriodExpiration,
          threatState: device.partnerReportedThreatState,
          jailBroken: device.jailBroken || 'Unknown',
        });
      }
    }

    // Convert to array and sort by risk level then failure count
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const policies = Array.from(policyMap.values()).sort((a, b) => {
      if (a.riskLevel !== b.riskLevel) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return b.failedCount - a.failedCount;
    });

    // Calculate compliance by risk level
    const complianceByRisk = {
      critical: { failed: 0, total: 0 },
      high: { failed: 0, total: 0 },
      medium: { failed: 0, total: 0 },
      low: { failed: 0, total: 0 },
    };

    for (const policy of policies) {
      complianceByRisk[policy.riskLevel].failed += policy.failedCount;
      complianceByRisk[policy.riskLevel].total += policy.affectedDevices.length;
    }

    // Calculate compliance by OS
    const osMap = new Map<string, { total: number; compliant: number; nonCompliant: number }>();
    
    for (const device of allDevices) {
      const osName = device.operatingSystem || 'Unknown';
      
      if (!osMap.has(osName)) {
        osMap.set(osName, { total: 0, compliant: 0, nonCompliant: 0 });
      }
      
      const os = osMap.get(osName)!;
      os.total++;
      
      if (device.isCompliant) {
        os.compliant++;
      } else {
        os.nonCompliant++;
      }
    }

    const complianceByOS: ComplianceByOS[] = Array.from(osMap.entries()).map(([osName, stats]: [string, { total: number; compliant: number; nonCompliant: number }]) => ({
      osName,
      total: stats.total,
      compliant: stats.compliant,
      nonCompliant: stats.nonCompliant,
      complianceRate: stats.total > 0 ? ((stats.compliant / stats.total) * 100).toFixed(1) : '0.0',
    }));

    // Summary statistics
    const totalDevices = allDevices.length;
    const compliantDevices = allDevices.filter(d => d.isCompliant).length;
    const nonCompliantDevices = totalDevices - compliantDevices;
    const uniqueFailedPolicies = policyMap.size;
    const totalPolicyFailures = policyFailures.length;

    // Phase 2 statistics
    const devicesInGracePeriod = allDevices.filter(d => 
      d.complianceGracePeriodExpiration && new Date(d.complianceGracePeriodExpiration) > new Date()
    ).length;
    const devicesWithThreats = allDevices.filter(d => 
      d.partnerReportedThreatState && !['unknown', 'unavailable'].includes(d.partnerReportedThreatState.toLowerCase())
    ).length;
    const jailbrokenDevices = allDevices.filter(d => 
      d.jailBroken && d.jailBroken.toLowerCase() !== 'unknown'
    ).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalDevices,
        compliantDevices,
        nonCompliantDevices,
        complianceRate: totalDevices > 0 ? ((compliantDevices / totalDevices) * 100).toFixed(1) : '0.0',
        uniqueFailedPolicies,
        totalPolicyFailures,
        // Phase 2 summary stats
        devicesInGracePeriod,
        devicesWithThreats,
        jailbrokenDevices,
      },
      policies,
      complianceByRisk,
      complianceByOS,
    });
  } catch (error) {
    console.error('Failed to fetch compliance breakdown:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance breakdown' },
      { status: 500 }
    );
  }
}
