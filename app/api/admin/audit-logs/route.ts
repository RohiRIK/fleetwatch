import { NextRequest, NextResponse } from 'next/server';
import { protectRouteWithRole } from '@/lib/auth/api-rbac';
import { getAuditLogs } from '@/lib/services/auditLog';

/**
 * GET /api/admin/audit-logs
 * 
 * Fetch audit logs for compliance review.
 * Requires SUPERADMIN role.
 */
export async function GET(request: NextRequest) {
  // Authentication & Authorization - only SUPERADMIN can view audit logs
  const { error } = await protectRouteWithRole('SUPERADMIN');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const userEmail = searchParams.get('userEmail') || undefined;

    const logs = await getAuditLogs({
      limit,
      offset,
      action,
      entityType,
      userEmail,
    });

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
