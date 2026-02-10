import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/devices/[id]/security
 * 
 * Exposes security_details JSONB data for a specific device.
 * This includes BitLocker, Windows Defender, Firewall, TPM, Secure Boot status.
 * 
 * Returns: Security details extracted from JSONB column
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deviceResults = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        securityDetails: devices.securityDetails,
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

    // Parse security details or return empty object if null
    const securityData = device.securityDetails || {};

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceName: device.deviceName,
      security: securityData,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch device security details:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
