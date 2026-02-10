/**
 * Settings API Route
 * GET /api/settings - Fetch all settings or filter by category
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';
import { getSettings } from '@/lib/services/settings';
import type { SettingCategory } from '@/lib/types/settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 * Query params:
 *   - category?: 'sync' | 'notifications' | 'azure' | 'system'
 */
export async function GET(request: NextRequest) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as SettingCategory | null;

    // Fetch settings (all or filtered by category)
    const settings = category 
      ? await getSettings(category)
      : await getSettings();

    return NextResponse.json({
      settings,
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
