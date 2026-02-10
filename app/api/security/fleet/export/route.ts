import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

/**
 * GET /api/security/fleet/export
 * 
 * Exports security data as CSV file.
 * Requires 'export_data' permission (ADMIN or SUPERADMIN).
 */
export async function GET() {
  // Authentication & Authorization
  const { error, session } = await protectRouteWithPermission('export_data');
  if (error) return error;

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

    // Build CSV content
    const headers = [
      'Device Name',
      'OS',
      'OS Version',
      'Manufacturer',
      'Model',
      'User',
      'Email',
      'Encrypted',
      'BitLocker/FileVault',
      'Windows Defender',
      'Firewall',
      'TPM',
      'Secure Boot',
      'Jailbroken',
      'Threat State',
      'Last Sync',
    ];

    const rows = allDevices.map((device) => {
      const security = device.securityDetails as any;
      
      return [
        device.deviceName || 'Unknown',
        device.operatingSystem || 'Unknown',
        device.osVersion || 'Unknown',
        device.manufacturer || 'Unknown',
        device.model || 'Unknown',
        device.userDisplayName || 'Unknown',
        device.userEmail || 'No email',
        device.isEncrypted ? 'Yes' : 'No',
        security?.bitLockerEnabled === true ? 'Enabled' : security?.bitLockerEnabled === false ? 'Disabled' : 'Unknown',
        security?.defenderEnabled === true || security?.defenderStatus === 'active' ? 'Enabled' : security?.defenderEnabled === false ? 'Disabled' : 'Unknown',
        security?.firewallEnabled === true ? 'Enabled' : security?.firewallEnabled === false ? 'Disabled' : 'Unknown',
        security?.tpmPresent === true ? 'Present' : security?.tpmPresent === false ? 'Absent' : 'Unknown',
        security?.secureBootEnabled === true ? 'Enabled' : security?.secureBootEnabled === false ? 'Disabled' : 'Unknown',
        device.jailBroken && device.jailBroken !== 'Unknown' ? 'Yes' : 'No',
        device.partnerReportedThreatState || 'None',
        device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : 'Never',
      ].map(escapeCSV);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Audit log
    console.log('[AUDIT] Security data exported', {
      exportedBy: session?.user?.email,
      exportedAt: new Date().toISOString(),
      deviceCount: allDevices.length,
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="security-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export security data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to export security data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Escape CSV field values
 */
function escapeCSV(value: string | number | boolean): string {
  if (typeof value !== 'string') {
    value = String(value);
  }
  
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}
