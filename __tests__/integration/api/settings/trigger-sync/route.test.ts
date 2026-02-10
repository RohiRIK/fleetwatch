/**
 * Integration Tests: POST /api/settings/trigger-sync
 * 
 * Tests the manual device sync trigger endpoint that allows SUPERADMIN users
 * to manually trigger a device sync from Microsoft Intune.
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

// Mock device sync service
vi.mock('@/lib/services/deviceSync', () => ({
  syncDevices: vi.fn(),
}))

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/settings/trigger-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should return 401 if not authenticated', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
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

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('Sync Trigger', () => {
    it('should successfully trigger full sync by default', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockResolvedValue({
        success: true,
        mode: 'full',
        devicesProcessed: 50,
        devicesCreated: 5,
        devicesUpdated: 45,
        devicesFailed: 0,
        errors: [],
        durationMs: 5000,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Sync completed')
      expect(data.result).toBeDefined()
      expect(data.result.mode).toBe('full')
      expect(data.result.devicesProcessed).toBe(50)
      expect(syncDevices).toHaveBeenCalledWith('full')
    })

    it('should support incremental sync mode', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockResolvedValue({
        success: true,
        mode: 'incremental',
        devicesProcessed: 10,
        devicesCreated: 2,
        devicesUpdated: 8,
        devicesFailed: 0,
        errors: [],
        durationMs: 1000,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({ mode: 'incremental' }),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.mode).toBe('incremental')
      expect(syncDevices).toHaveBeenCalledWith('incremental')
    })

    it('should support deep sync mode', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockResolvedValue({
        success: true,
        mode: 'deep',
        devicesProcessed: 50,
        devicesCreated: 0,
        devicesUpdated: 50,
        devicesFailed: 0,
        errors: [],
        durationMs: 15000,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({ mode: 'deep' }),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.mode).toBe('deep')
      expect(syncDevices).toHaveBeenCalledWith('deep')
    })

    it('should handle sync with partial failures', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockResolvedValue({
        success: true,
        mode: 'full',
        devicesProcessed: 50,
        devicesCreated: 5,
        devicesUpdated: 43,
        devicesFailed: 2,
        errors: [
          { deviceId: 'device-1', error: 'Network timeout' },
          { deviceId: 'device-2', error: 'Invalid data format' },
        ],
        durationMs: 5500,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.devicesFailed).toBe(2)
      expect(data.result.errors).toHaveLength(2)
    })

    it('should handle sync failure', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockResolvedValue({
        success: false,
        mode: 'full',
        devicesProcessed: 0,
        devicesCreated: 0,
        devicesUpdated: 0,
        devicesFailed: 0,
        errors: [],
        durationMs: 100,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Sync failed')
    })
  })

  describe('Validation', () => {
    it('should return 400 for invalid sync mode', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({ mode: 'invalid-mode' }),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sync mode')
    })
  })

  describe('Error Handling', () => {
    it('should handle service exceptions gracefully', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac')
      ;(protectRouteWithRole as any).mockResolvedValue({
        error: null,
      })

      const { syncDevices } = await import('@/lib/services/deviceSync')
      ;(syncDevices as any).mockRejectedValue(new Error('Database connection failed'))

      const req = new NextRequest('http://localhost:3000/api/settings/trigger-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const { POST } = await import('@/app/api/settings/trigger-sync/route')
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to trigger sync')
    })
  })
})
