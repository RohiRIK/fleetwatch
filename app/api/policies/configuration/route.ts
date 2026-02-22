import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { device_configuration_profiles } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || '';

    let profiles = await db
      .select()
      .from(device_configuration_profiles);

    if (platform) {
      profiles = profiles.filter(p => p.platformType === platform);
    }

    return NextResponse.json({
      success: true,
      profiles,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch configuration profiles:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
