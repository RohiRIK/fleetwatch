import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { conditional_access_policies, named_locations } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeLocations = searchParams.get('includeLocations') === 'true';
    const state = searchParams.get('state') || '';

    let policies = await db
      .select()
      .from(conditional_access_policies);

    if (state) {
      policies = policies.filter(p => p.state === state);
    }

    const response: any = {
      success: true,
      policies,
    };

    if (includeLocations) {
      const locations = await db
        .select()
        .from(named_locations);
      response.locations = locations;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Failed to fetch conditional access policies:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
