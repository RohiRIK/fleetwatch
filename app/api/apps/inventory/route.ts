import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';

/**
 * GET /api/apps/inventory
 * 
 * Aggregates detected applications across all devices in the fleet.
 * Uses the detected_apps_details JSONB column from Phase 2/3.
 * 
 * Query params:
 * - search: Optional search term to filter apps
 * - minInstalls: Minimum number of installs to show (default: 1)
 * 
 * Returns:
 * - Total unique apps
 * - Total app installations
 * - App list with install counts
 * - License optimization opportunities
 */
export async function GET(request: Request) {
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

    // Map to aggregate apps across all devices
    const appMap = new Map<string, {
      displayName: string;
      publisher: string;
      version: string;
      installCount: number;
      devices: Array<{
        id: string;
        deviceName: string;
        operatingSystem: string;
        userDisplayName: string;
        userEmail: string;
        version: string;
        installedOn?: string;
      }>;
      versions: Map<string, number>; // Track different versions
    }>();

    let totalApps = 0;

    // Process each device
    allDevices.forEach((device) => {
      if (!device.detectedAppsDetails) return;

      const appsArray = Array.isArray(device.detectedAppsDetails) 
        ? device.detectedAppsDetails 
        : [device.detectedAppsDetails];

      appsArray.forEach((app: any) => {
        if (!app || !app.displayName) return;

        totalApps++;
        const displayName = app.displayName;
        const publisher = app.publisher || 'Unknown Publisher';
        const version = app.version || 'Unknown';
        const installedOn = app.installedDateTime || app.installedOn;

        // Use displayName as key for aggregation
        const key = displayName.toLowerCase();

        if (!appMap.has(key)) {
          appMap.set(key, {
            displayName,
            publisher,
            version,
            installCount: 0,
            devices: [],
            versions: new Map(),
          });
        }

        const appData = appMap.get(key)!;
        appData.installCount++;
        
        // Track version distribution
        const versionCount = appData.versions.get(version) || 0;
        appData.versions.set(version, versionCount + 1);

        // Add device to app's device list
        appData.devices.push({
          id: device.id,
          deviceName: device.deviceName || 'Unknown Device',
          operatingSystem: device.operatingSystem || 'Unknown',
          userDisplayName: device.userDisplayName || 'Unknown User',
          userEmail: device.userEmail || 'No email',
          version,
          installedOn,
        });
      });
    });

    // Convert map to array and sort by install count
    let apps = Array.from(appMap.values())
      .filter(app => app.installCount >= minInstalls)
      .map(app => ({
        ...app,
        versions: Array.from(app.versions.entries()).map(([version, count]) => ({
          version,
          count,
        })).sort((a, b) => b.count - a.count),
        hasMultipleVersions: app.versions.size > 1,
      }))
      .sort((a, b) => b.installCount - a.installCount);

    // Apply search filter if provided
    if (search) {
      apps = apps.filter(app => 
        app.displayName.toLowerCase().includes(search) ||
        app.publisher.toLowerCase().includes(search)
      );
    }

    // Identify license optimization opportunities
    const licenseOpportunities = apps
      .filter(app => 
        // Apps installed on fewer than 20% of devices might be waste
        app.installCount < allDevices.length * 0.2 &&
        // Apps with "Professional", "Enterprise", "Premium" in name often have licenses
        (app.displayName.toLowerCase().includes('professional') ||
         app.displayName.toLowerCase().includes('enterprise') ||
         app.displayName.toLowerCase().includes('premium') ||
         app.displayName.toLowerCase().includes('office') ||
         app.displayName.toLowerCase().includes('adobe'))
      )
      .slice(0, 10);

    // Apps with version fragmentation (potential update issues)
    const versionFragmentation = apps
      .filter(app => app.hasMultipleVersions && app.installCount >= 3)
      .map(app => ({
        displayName: app.displayName,
        publisher: app.publisher,
        installCount: app.installCount,
        versionCount: app.versions.length,
        versions: app.versions,
      }))
      .slice(0, 10);

    // Top apps by install count
    const topApps = apps.slice(0, 20);

    // Microsoft apps breakdown
    const microsoftApps = apps.filter(app => 
      app.publisher.toLowerCase().includes('microsoft')
    );

    // Adobe apps breakdown
    const adobeApps = apps.filter(app => 
      app.publisher.toLowerCase().includes('adobe')
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalDevices: allDevices.length,
        totalUniqueApps: appMap.size,
        totalAppInstallations: totalApps,
        averageAppsPerDevice: (totalApps / allDevices.length).toFixed(1),
        microsoftAppsCount: microsoftApps.length,
        adobeAppsCount: adobeApps.length,
      },
      apps,
      topApps,
      licenseOpportunities,
      versionFragmentation,
      microsoftApps: microsoftApps.slice(0, 10),
      adobeApps: adobeApps.slice(0, 10),
    });
  } catch (error) {
    console.error('Failed to fetch app inventory:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch app inventory',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
