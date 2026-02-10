/**
 * Test Connection API Route
 * POST /api/settings/test-connection - Test Azure Graph API connection
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';
import { testGraphConnection } from '@/lib/graph/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/test-connection
 * Test connection to Azure Graph API
 */
export async function POST(request: NextRequest) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    // Test the connection
    await testGraphConnection();

    return NextResponse.json({
      success: true,
      message: 'Azure connection test successful',
    });
  } catch (err: any) {
    console.error('Connection test failed:', err);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test connection',
        details: err.message 
      },
      { status: 500 }
    );
  }
}
