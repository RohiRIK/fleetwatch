/**
 * Test Connection API Tests
 * Tests for POST /api/settings/test-connection endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/lib/auth/api-rbac', () => ({
  protectRouteWithRole: vi.fn(),
}));

vi.mock('@/lib/graph/client', () => ({
  testGraphConnection: vi.fn(),
}));

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/settings/test-connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      (protectRouteWithRole as any).mockResolvedValue({
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        session: null,
        role: null,
      });

      const request = new NextRequest('http://localhost:3000/api/settings/test-connection', {
        method: 'POST',
      });

      const { POST } = await import('@/app/api/settings/test-connection/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not SUPERADMIN', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      (protectRouteWithRole as any).mockResolvedValue({
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        session: null,
        role: 'ADMIN',
      });

      const request = new NextRequest('http://localhost:3000/api/settings/test-connection', {
        method: 'POST',
      });

      const { POST } = await import('@/app/api/settings/test-connection/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Test Connection', () => {
    it('should return success when connection test passes', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { testGraphConnection } = await import('@/lib/graph/client');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (testGraphConnection as any).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost:3000/api/settings/test-connection', {
        method: 'POST',
      });

      const { POST } = await import('@/app/api/settings/test-connection/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Azure connection test successful');
    });

    it('should return error when connection test fails', async () => {
      const { protectRouteWithRole } = await import('@/lib/auth/api-rbac');
      const { testGraphConnection } = await import('@/lib/graph/client');
      
      (protectRouteWithRole as any).mockResolvedValue({
        error: null,
        session: { user: { id: 'user-123' } } as any,
        role: 'SUPERADMIN',
      });
      (testGraphConnection as any).mockRejectedValue(new Error('Invalid credentials'));

      const request = new NextRequest('http://localhost:3000/api/settings/test-connection', {
        method: 'POST',
      });

      const { POST } = await import('@/app/api/settings/test-connection/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to test connection');
    });
  });
});
