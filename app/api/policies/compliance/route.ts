import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { device_compliance_policies } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || '';

    let policies = await db
      .select()
      .from(device_compliance_policies);

    if (platform) {
      policies = policies.filter(p => p.platformType === platform);
    }

    return NextResponse.json({
      success: true,
      policies,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch compliance policies:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
