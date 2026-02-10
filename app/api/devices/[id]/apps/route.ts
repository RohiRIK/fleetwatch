import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/devices/[id]/apps
 * 
 * Exposes detected_apps_details JSONB data for a specific device.
 * This includes all installed applications detected by Intune.
 * 
 * Returns: Array of detected applications with metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get search query parameter for filtering apps
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase();

    const deviceResults = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        detectedAppsDetails: devices.detectedAppsDetails,
      })
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);

    if (deviceResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Device not found',
        },
        { status: 404 }
      );
    }

    const device = deviceResults[0];

    // Parse detected apps or return empty array if null
    let apps = Array.isArray(device.detectedAppsDetails) 
      ? device.detectedAppsDetails 
      : [];

    // Filter apps if search query provided
    if (search && apps.length > 0) {
      apps = apps.filter((app: any) => {
        const displayName = app.displayName?.toLowerCase() || '';
        const publisher = app.publisher?.toLowerCase() || '';
        return displayName.includes(search) || publisher.includes(search);
      });
    }

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceName: device.deviceName,
      apps,
      totalCount: apps.length,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch device apps:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
