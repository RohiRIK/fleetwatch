/**
 * Settings API Integration Tests - Single Setting
 * Tests for GET /api/settings/[key] endpoint
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
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSetting: Setting = {
  id: 'sync.schedule',
  category: 'sync',
  key: 'schedule',
  value: '0 */6 * * *',
  encrypted: false,
  description: 'Cron expression for sync schedule',
  defaultValue: '0 */6 * * *',
  updatedBy: 'user-123',
  updatedAt: new Date('2026-02-10T10:00:00Z'),
  createdAt: new Date('2026-02-01T10:00:00Z'),
};

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/settings/[key]', () => {
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

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'sync.schedule' } });
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

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should call protectRouteWithRole with SUPERADMIN', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSetting as any).mockResolvedValue(mockSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      await GET(request, { params: { key: 'sync.schedule' } });

      // ASSERT
      expect(protectRouteWithRole).toHaveBeenCalledWith('SUPERADMIN');
    });
  });

  // ==========================================================================
  // Fetch Single Setting Tests
  // ==========================================================================

  describe('Fetch Single Setting', () => {
    it('should return setting when it exists', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSetting as any).mockResolvedValue(mockSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting).toBeDefined();
      expect(data.setting.id).toBe('sync.schedule');
      expect(data.setting.value).toBe('0 */6 * * *');
      expect(getSetting).toHaveBeenCalledWith('sync.schedule');
    });

    it('should return 404 when setting does not exist', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSetting as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/settings/nonexistent.key');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'nonexistent.key' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(404);
      expect(data.error).toBe('Setting not found');
    });

    it('should fetch different setting keys correctly', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSetting } = await import('@/lib/services/settings');
      
      const notificationSetting: Setting = {
        id: 'notifications.email.enabled',
        category: 'notifications',
        key: 'email.enabled',
        value: true,
        encrypted: false,
        description: 'Enable email notifications',
        defaultValue: false,
        updatedBy: 'user-456',
        updatedAt: new Date('2026-02-10T10:00:00Z'),
        createdAt: new Date('2026-02-01T10:00:00Z'),
      };

      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSetting as any).mockResolvedValue(notificationSetting);

      const request = new NextRequest('http://localhost:3000/api/settings/notifications.email.enabled');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'notifications.email.enabled' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.setting.id).toBe('notifications.email.enabled');
      expect(data.setting.value).toBe(true);
      expect(getSetting).toHaveBeenCalledWith('notifications.email.enabled');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSetting } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSetting as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/settings/sync.schedule');

      // ACT
      const { GET } = await import('@/app/api/settings/[key]/route');
      const response = await GET(request, { params: { key: 'sync.schedule' } });
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch setting');
    });
  });
});
