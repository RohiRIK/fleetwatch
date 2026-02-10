/**
 * Test Notification API Route
 * POST /api/settings/test-notification - Test email or webhook notification
 * Protected: SUPERADMIN only
 */

import { NextRequest, NextResponse } from 'next/server'
import { protectRouteWithRole } from '@/lib/auth/api-rbac'

export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/test-notification
 * Test notification configuration (email or webhook)
 */
export async function POST(request: NextRequest) {
  // Protect route - require SUPERADMIN role
  const { error } = await protectRouteWithRole('SUPERADMIN')
  if (error) return error

  try {
    const body = await request.json()
    const { type } = body

    // Validate request
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      )
    }

    if (!['email', 'webhook'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type. Must be "email" or "webhook"' },
        { status: 400 }
      )
    }

    // Dynamically import to avoid mock conflicts in tests
    const { sendTestEmail, sendTestWebhook } = await import('@/lib/services/notifications')

    // Send test notification based on type
    let result
    if (type === 'email') {
      result = await sendTestEmail()
    } else {
      result = await sendTestWebhook()
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error) {
    console.error('[POST /api/settings/test-notification] Error:', error)
    return NextResponse.json(
      { error: 'Failed to test notification' },
      { status: 500 }
    )
  }
}
