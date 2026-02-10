import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';
import { auditDeviceNotesUpdate } from '@/lib/services/auditLog';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deviceResults = await db
      .select()
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

    return NextResponse.json({
      success: true,
      device,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch device:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/devices/[id]
 * 
 * Updates device fields (currently supports notes field only).
 * Requires ADMIN role with manage_devices permission.
 * Logs all changes to audit log.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication & Authorization
  const { error, session } = await protectRouteWithPermission('manage_devices');
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate notes field
    if (body.notes !== undefined && typeof body.notes !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Notes must be a string' },
        { status: 400 }
      );
    }

    // Check device exists
    const deviceResults = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);

    if (deviceResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      );
    }

    const oldDevice = deviceResults[0];

    // Update device notes
    await db
      .update(devices)
      .set({
        notes: body.notes,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id));

    // Fetch updated device
    const updatedDevice = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);

    // Persistent audit log (replaces console.log from Phase 5)
    await auditDeviceNotesUpdate(
      id,
      oldDevice.deviceName || 'Unknown Device',
      oldDevice.notes || null,
      body.notes,
      session?.user?.email || 'unknown@example.com',
      session?.user?.id
    );

    return NextResponse.json({
      success: true,
      device: updatedDevice[0],
      message: 'Device notes updated successfully',
    });
  } catch (error: any) {
    console.error('[API] Failed to update device:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}