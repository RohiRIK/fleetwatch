/**
 * Single Setting API Route
 * GET /api/settings/[key] - Fetch a specific setting by key
 * PUT /api/settings/[key] - Update a specific setting
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';
import { getSetting } from '@/lib/services/settings';
import type { SettingKey, SettingValue } from '@/lib/types/settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/[key]
 * Fetch a single setting by its key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const { key } = await params;

    // Fetch setting
    const setting = await getSetting(key as SettingKey);

    if (!setting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      setting,
    });
  } catch (err) {
    console.error('Error fetching setting:', err);
    return NextResponse.json(
      { error: 'Failed to fetch setting' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/[key]
 * Update a specific setting
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Protect route - require SUPERADMIN role
  const { error, session } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const { key } = await params;
    const body = await request.json();
    const { value } = body;

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid mocking issues in tests
    const { updateSetting } = await import('@/lib/services/settings');

    // Update setting
    const updatedSetting = await updateSetting(
      key as SettingKey,
      value as SettingValue,
      session!.user!.id!
    );

    return NextResponse.json({
      setting: updatedSetting,
    });
  } catch (err: any) {
    console.error('Error updating setting:', err);
    
    // Handle validation errors
    if (err.message?.includes('Invalid')) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
