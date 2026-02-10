import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, devices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Fetch user details
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const user = userResult[0];
    
    // Fetch user's devices
    const userDevices = await db
      .select({
        id: devices.id,
        azureId: devices.azureId,
        deviceName: devices.deviceName,
        serialNumber: devices.serialNumber,
        manufacturer: devices.manufacturer,
        model: devices.model,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        complianceState: devices.complianceState,
        isEncrypted: devices.isEncrypted,
        managementState: devices.managementState,
        enrolledAt: devices.enrolledAt,
        lastSyncAt: devices.lastSyncAt,
        chassisType: devices.chassisType,
      })
      .from(devices)
      .where(eq(devices.userId, id))
      .orderBy(desc(devices.lastSyncAt));
    
    return NextResponse.json({
      user: {
        ...user,
        // Remove sensitive fields
        passwordHash: undefined,
      },
      devices: userDevices,
      deviceCount: userDevices.length,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}
