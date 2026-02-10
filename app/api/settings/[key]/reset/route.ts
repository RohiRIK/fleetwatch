/**
 * Reset Setting API Route
 * POST /api/settings/[key]/reset - Reset a setting to its default value
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';
import { resetSetting } from '@/lib/services/settings';
import type { SettingKey } from '@/lib/types/settings';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/[key]/reset
 * Reset a setting to its default value
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const { key } = await params;

    // Reset setting to default
    const setting = await resetSetting(key as SettingKey);

    return NextResponse.json({
      setting,
      message: 'Setting reset to default value',
    });
  } catch (err) {
    console.error('Error resetting setting:', err);
    return NextResponse.json(
      { error: 'Failed to reset setting' },
      { status: 500 }
    );
  }
}
