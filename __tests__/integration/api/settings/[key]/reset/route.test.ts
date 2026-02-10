/**
 * Settings API Integration Tests - Reset Setting
 * Tests for POST /api/settings/[key]/reset endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { Setting } from '@/lib/db/schema';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/auth/api-rbac', () => ({
  protectRouteWithRole: vi.fn(),
}));

vi.mock('@/lib/services/settings', () => ({
  resetSetting: vi.fn(),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockResetSetting: Setting = {
  id: 'sync.schedule',
  category: 'sync',
  key: 'schedule',
  value: '0 */6 * * *', // Reset to default
  encrypted: false,
  description: 'Cron expression for sync schedule',
  defaultValue: '0 */6 * * *',
  updatedBy: null,
  updatedAt: new Date('2026-02-10T12:00:00Z'),
  createdAt: new Date('2026-02-01T10:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/settings/[key]/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Authentication & Authorization Tests
  // ==========================================================================

  describe('Authentication & Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      (protectRouteWithRole as any).mockResolvedValue({
        error: NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 }),
        session: null,
        role: null,
      });

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      const response = await POST(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not SUPERADMIN', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      (protectRouteWithRole as any).mockResolvedValue({
        error: NextResponse.json(
          { error: 'Forbidden', message: 'SUPERADMIN role required' },
          { status: 403 }
        ),
        session: null,
        role: 'ADMIN',
      });

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      const response = await POST(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should call protectRouteWithRole with SUPERADMIN', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { resetSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (resetSetting as any).mockResolvedValue(mockResetSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      await POST(request, { params: { key: 'sync.schedule' } });

      // ASSERT
      expect(protectRouteWithRole).toHaveBeenCalledWith('SUPERADMIN');
    });
  });

  // ==========================================================================
  // Reset Setting Tests
  // ==========================================================================

  describe('Reset Setting', () => {
    it('should reset setting to default value', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { resetSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (resetSetting as any).mockResolvedValue(mockResetSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      const response = await POST(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting).toBeDefined();
      expect(data.setting.value).toBe('0 */6 * * *'); // Default value
      expect(data.message).toBe('Setting reset to default value');
      expect(resetSetting).toHaveBeenCalledWith('sync.schedule');
    });

    it('should reset different setting keys', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { resetSetting } = await import('@/lib/services/settings');
      
      const booleanReset: Setting = {
        ...mockResetSetting,
        id: 'sync.enabled',
        key: 'enabled',
        value: true,
        defaultValue: true,
      };

      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (resetSetting as any).mockResolvedValue(booleanReset);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.enabled/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      const response = await POST(request, { params: { key: 'sync.enabled' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting.value).toBe(true);
      expect(resetSetting).toHaveBeenCalledWith('sync.enabled');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { resetSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (resetSetting as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule/reset', {
        method: 'POST',
      });

      // ACT
      const { POST } = await import('@/app/api/settings/[key]/reset/route');
      const response = await POST(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to reset setting');
    });
  });
});
