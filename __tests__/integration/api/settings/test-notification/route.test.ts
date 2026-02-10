/**
 * Integration Tests: POST /api/settings/test-notification
 * 
 * Tests the test notification endpoint that allows SUPERADMIN users to test
 * email and webhook notification configurations.
 * 
 * TDD Phase: RED - Tests written first, implementation follows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ============================================================================
// Mocks
// ============================================================================

// Mock auth
vi.mock('@/lib/auth/api-rbac', () => ({
  protectRouteWithRole: vi.fn(),
}))

// Mock notification service
vi.mock('@/lib/services/notifications', () => ({
  sendTestEmail: vi.fn(),
  sendTestWebhook: vi.fn(),
}))

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/settings/test-notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should return 401 if not authenticated', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'email' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 if not SUPERADMIN', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'email' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('Email Notification Tests', () => {
    it('should successfully send test email', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { sendTestEmail } = await import('@/lib/services/notifications')
      ;(sendTestEmail as any).mockResolvedValue({ success: true, message: 'Test email sent successfully' })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'email' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('email sent')
      expect(sendTestEmail).toHaveBeenCalledOnce()
    })

    it('should handle email sending failure', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { sendTestEmail } = await import('@/lib/services/notifications')
      ;(sendTestEmail as any).mockResolvedValue({ success: false, message: 'SMTP connection failed' })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'email' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('SMTP connection failed')
    })
  })

  describe('Webhook Notification Tests', () => {
    it('should successfully send test webhook', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { sendTestWebhook } = await import('@/lib/services/notifications')
      ;(sendTestWebhook as any).mockResolvedValue({ success: true, message: 'Webhook delivered successfully' })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'webhook' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Webhook delivered')
      expect(sendTestWebhook).toHaveBeenCalledOnce()
    })

    it('should handle webhook delivery failure', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { sendTestWebhook } = await import('@/lib/services/notifications')
      ;(sendTestWebhook as any).mockResolvedValue({ success: false, message: 'Connection timeout' })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'webhook' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Connection timeout')
    })
  })

  describe('Validation', () => {
    it('should return 400 for invalid notification type', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'sms' }), // Invalid type
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid notification type')
    })

    it('should return 400 for missing type', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('type')
    })
  })

  describe('Error Handling', () => {
    it('should handle service exceptions gracefully', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { sendTestEmail } = await import('@/lib/services/notifications')
      ;(sendTestEmail as any).mockRejectedValue(new Error('Unexpected error'))

      const req = new NextRequest('http://localhost:3000/api/settings/test-notification', {
        method: 'POST',
        body: JSON.stringify({ type: 'email' }),
      })

      const { POST } = await import('@/app/api/settings/test-notification/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to test notification')
    })
  })
})
