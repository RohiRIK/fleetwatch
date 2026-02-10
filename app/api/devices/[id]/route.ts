import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
