import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

/**
 * GET /api/apps/inventory/export
 * 
 * Exports app inventory data as CSV file.
 * Requires 'export_data' permission (ADMIN or SUPERADMIN).
 */
export async function GET(request: Request) {
  // Authentication & Authorization
  const { error, session } = await protectRouteWithPermission('export_data');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const minInstalls = parseInt(searchParams.get('minInstalls') || '1', 10);

    // Fetch all active devices with detected apps
    const allDevices = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        operatingSystem: devices.operatingSystem,
        userDisplayName: devices.userDisplayName,
        userEmail: devices.userEmail,
        detectedAppsDetails: devices.detectedAppsDetails,
      })
      .from(devices)
      .where(isNull(devices.deletedAt));

    // Aggregate apps
    const appMap = new Map<string, {
      displayName: string;
      publisher: string;
      version: string;
      installCount: number;
      versions: Map<string, number>;
    }>();

    allDevices.forEach((device) => {
      if (!device.detectedAppsDetails) return;

      const appsArray = Array.isArray(device.detectedAppsDetails) 
        ? device.detectedAppsDetails 
        : [device.detectedAppsDetails];

      appsArray.forEach((app: any) => {
        if (!app || !app.displayName) return;

        const displayName = app.displayName;
        const publisher = app.publisher || 'Unknown Publisher';
        const version = app.version || 'Unknown';
        const key = displayName.toLowerCase();

        if (!appMap.has(key)) {
          appMap.set(key, {
            displayName,
            publisher,
            version,
            installCount: 0,
            versions: new Map(),
          });
        }

        const appData = appMap.get(key)!;
        appData.installCount++;
        
        const versionCount = appData.versions.get(version) || 0;
        appData.versions.set(version, versionCount + 1);
      });
    });

    // Convert to array and filter
    let apps = Array.from(appMap.values())
      .filter(app => app.installCount >= minInstalls)
      .map(app => ({
        ...app,
        versionCount: app.versions.size,
        versions: Array.from(app.versions.entries()).map(([version, count]) => ({
          version,
          count,
        })).sort((a, b) => b.count - a.count),
        hasMultipleVersions: app.versions.size > 1,
      }))
      .sort((a, b) => b.installCount - a.installCount);

    // Apply search filter
    if (search) {
      apps = apps.filter(app => 
        app.displayName.toLowerCase().includes(search) ||
        app.publisher.toLowerCase().includes(search)
      );
    }

    // Build CSV content
    const headers = [
      'App Name',
      'Publisher',
      'Install Count',
      'Unique Versions',
      'Most Common Version',
      'Version Fragmentation',
      'License Risk',
    ];

    const rows = apps.map((app) => {
      const mostCommonVersion = app.versions[0]?.version || app.version;
      const versionFragmentation = app.hasMultipleVersions ? 'Yes' : 'No';
      
      // Calculate license risk
      const installPercentage = (app.installCount / allDevices.length) * 100;
      let licenseRisk = 'Low';
      
      if (installPercentage < 20 && 
          (app.displayName.toLowerCase().includes('professional') ||
           app.displayName.toLowerCase().includes('enterprise') ||
           app.displayName.toLowerCase().includes('premium') ||
           app.displayName.toLowerCase().includes('pro'))) {
        licenseRisk = 'High - Potential waste';
      } else if (installPercentage < 50) {
        licenseRisk = 'Medium - Review usage';
      }

      return [
        app.displayName,
        app.publisher,
        app.installCount.toString(),
        app.versionCount.toString(),
        mostCommonVersion,
        versionFragmentation,
        licenseRisk,
      ].map(escapeCSV);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Audit log
    console.log('[AUDIT] App inventory exported', {
      exportedBy: session?.user?.email,
      exportedAt: new Date().toISOString(),
      appCount: apps.length,
      totalDevices: allDevices.length,
      filters: { search, minInstalls },
    });

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="app-inventory-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export app inventory:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to export app inventory',
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
