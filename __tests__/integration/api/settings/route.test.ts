/**
 * Settings API Integration Tests
 * Tests for GET /api/settings endpoint
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
  getSettings: vi.fn(),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSettings: Setting[] = [
  {
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
  },
  {
    id: 'sync.enabled',
    category: 'sync',
    key: 'enabled',
    value: true,
    encrypted: false,
    description: 'Enable automatic sync',
    defaultValue: true,
    updatedBy: 'user-123',
    updatedAt: new Date('2026-02-10T10:00:00Z'),
    createdAt: new Date('2026-02-01T10:00:00Z'),
  },
  {
    id: 'notifications.email.enabled',
    category: 'notifications',
    key: 'email.enabled',
    value: false,
    encrypted: false,
    description: 'Enable email notifications',
    defaultValue: false,
    updatedBy: null,
    updatedAt: new Date('2026-02-10T10:00:00Z'),
    createdAt: new Date('2026-02-01T10:00:00Z'),
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/settings', () => {
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

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
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

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should call protectRouteWithRole with SUPERADMIN', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      await GET(request);

      // ASSERT
      expect(protectRouteWithRole).toHaveBeenCalledWith('SUPERADMIN');
    });
  });

  // ==========================================================================
  // Fetch All Settings Tests
  // ==========================================================================

  describe('Fetch All Settings', () => {
    it('should return all settings when no category filter is provided', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue(mockSettings);

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.settings).toHaveLength(3);
      expect(data.settings[0].id).toBe(mockSettings[0].id);
      expect(data.settings[1].id).toBe(mockSettings[1].id);
      expect(data.settings[2].id).toBe(mockSettings[2].id);
      expect(getSettings).toHaveBeenCalled();
    });

    it('should return empty array when no settings exist', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.settings).toEqual([]);
    });
  });

  // ==========================================================================
  // Category Filter Tests
  // ==========================================================================

  describe('Category Filtering', () => {
    it('should filter settings by category when ?category=sync is provided', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      const syncSettings = mockSettings.filter(s => s.category === 'sync');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue(syncSettings);

      const request = new NextRequest('http://localhost:3000/api/settings?category=sync');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.settings).toHaveLength(2);
      expect(data.settings.every((s: Setting) => s.category === 'sync')).toBe(true);
      expect(getSettings).toHaveBeenCalledWith('sync');
    });

    it('should filter settings by category when ?category=notifications is provided', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      const notificationSettings = mockSettings.filter(s => s.category === 'notifications');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue(notificationSettings);

      const request = new NextRequest('http://localhost:3000/api/settings?category=notifications');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.settings).toHaveLength(1);
      expect(data.settings[0].category).toBe('notifications');
      expect(getSettings).toHaveBeenCalledWith('notifications');
    });

    it('should return empty array when filtering by non-existent category', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/settings?category=azure');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(200);
      expect(data.settings).toEqual([]);
      expect(getSettings).toHaveBeenCalledWith('azure');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      // ARRANGE
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { getSettings } = await import('@/lib/services/settings');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (getSettings as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/settings');

      // ACT
      const { GET } = await import('@/app/api/settings/route');
      const response = await GET(request);
      const data = await response.json();

      // ASSERT
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch settings');
    });
  });
});
