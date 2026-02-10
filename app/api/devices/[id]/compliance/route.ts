import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/devices/[id]/compliance
 * 
 * Exposes compliance_details JSONB data for a specific device.
 * This includes compliance policies, failed policies, and compliance state details.
 * 
 * Returns: Compliance details with policy information
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
        isCompliant: devices.isCompliant,
        complianceState: devices.complianceState,
        complianceGracePeriodExpiration: devices.complianceGracePeriodExpiration,
        complianceDetails: devices.complianceDetails,
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

    // Parse compliance details or return empty object if null
    const complianceData = device.complianceDetails || {};

    // Extract failed policies if available
    const failedPolicies = Array.isArray(complianceData) 
      ? complianceData.filter((policy: any) => policy.state !== 'compliant')
      : [];

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceName: device.deviceName,
      isCompliant: device.isCompliant,
      complianceState: device.complianceState,
      gracePeriodExpiration: device.complianceGracePeriodExpiration,
      compliance: complianceData,
      failedPolicies,
      failedPolicyCount: failedPolicies.length,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch device compliance details:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
