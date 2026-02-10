/**
 * Trigger Sync API Route
 * POST /api/settings/trigger-sync - Manually trigger device sync
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server'
import { protectRouteWithRole } from '@/lib/auth/api-rbac'
import type { SyncMode } from '@/lib/services/deviceSync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/trigger-sync
 * Manually trigger a device sync from Microsoft Intune
 */
export async function POST(request: NextRequest) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN')
  if (error) return error

  try {
    const body = await request.json()
    const { mode = 'full' } = body

    // Validate sync mode
    const validModes: SyncMode[] = ['full', 'incremental', 'deep']
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid sync mode. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      )
    }

    // Dynamically import to avoid mock conflicts in tests
    const { syncDevices } = await import('@/lib/services/deviceSync')

    // Trigger sync
    const result = await syncDevices(mode)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sync failed to complete',
          result,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed successfully: ${result.devicesProcessed} devices processed (${result.devicesCreated} created, ${result.devicesUpdated} updated${result.devicesFailed > 0 ? `, ${result.devicesFailed} failed` : ''}) in ${result.durationMs}ms`,
      result,
    })
  } catch (error) {
    console.error('[POST /api/settings/trigger-sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}
