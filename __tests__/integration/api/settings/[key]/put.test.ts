/**
 * Settings API Integration Tests - Update Setting
 * Tests for PUT /api/settings/[key] endpoint
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
  getSetting: vi.fn(),
  updateSetting: vi.fn(),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockUpdatedSetting: Setting = {
  id: 'sync.schedule',
  category: 'sync',
  key: 'schedule',
  value: '0 */12 * * *',
  encrypted: false,
  description: 'Cron expression for sync schedule',
  defaultValue: '0 */6 * * *',
  updatedBy: 'user-123',
  updatedAt: new Date('2026-02-10T12:00:00Z'),
  createdAt: new Date('2026-02-01T10:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('PUT /api/settings/[key]', () => {
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

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({ value: '0 */12 * * *' }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
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

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({ value: '0 */12 * * *' }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  // ==========================================================================
  // Update Setting Tests
  // ==========================================================================

  describe('Update Setting', () => {
    it('should update setting value successfully', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockResolvedValue(mockUpdatedSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({ value: '0 */12 * * *' }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting).toBeDefined();
      expect(data.setting.value).toBe('0 */12 * * *');
      expect(updateSetting).toHaveBeenCalledWith('sync.schedule', '0 */12 * * *', 'user-123');
    });

    it('should update boolean setting', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      const booleanSetting: Setting = {
        ...mockUpdatedSetting,
        id: 'sync.enabled',
        key: 'enabled',
        value: false,
      };

      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockResolvedValue(booleanSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.enabled', {
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.enabled' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting.value).toBe(false);
      expect(updateSetting).toHaveBeenCalledWith('sync.enabled', false, 'user-123');
    });

    it('should update array setting', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      const arraySetting: Setting = {
        ...mockUpdatedSetting,
        id: 'notifications.email.recipients',
        key: 'email.recipients',
        value: ['admin@example.com', 'ops@example.com'],
      };

      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockResolvedValue(arraySetting);

      const request = new NextRequest('http://localhost:3000/api/settings/notifications.email.recipients', {
        method: 'PUT',
        body: JSON.stringify({ value: ['admin@example.com', 'ops@example.com'] }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'notifications.email.recipients' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(Array.isArray(data.setting.value)).toBe(true);
      expect(data.setting.value).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Validation', () => {
    it('should return 400 if value is missing', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(400);
      expect(data.error).toBe('Value is required');
    });

    it('should return 400 for invalid cron expression', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockRejectedValue(new Error('Invalid cron expression'));

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({ value: 'invalid-cron' }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid');
    });

    it('should return 400 for invalid email format', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockRejectedValue(new Error('Invalid email format'));

      const request = new NextRequest('http://localhost:3000/api/settings/notifications.email.recipients', {
        method: 'PUT',
        body: JSON.stringify({ value: ['not-an-email'] }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'notifications.email.recipients' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { updateSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (updateSetting as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule', {
        method: 'PUT',
        body: JSON.stringify({ value: '0 */12 * * *' }),
      });

      // ACT
      const { PUT } = await import('@/app/api/settings/[key]/route');
      const response = await PUT(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update setting');
    });
  });
});
