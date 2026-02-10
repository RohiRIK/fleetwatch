/**
 * Audit Logging Service
 * Provides persistent audit trail for compliance (SOC 2, ISO 27001, HIPAA)
 */

import { db } from '@/lib/db/drizzle';
import { auditLogs, type NewAuditLog } from '@/lib/db/schema';

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  userId?: string;
  userEmail: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * Persists to database for long-term compliance retention
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      entityName: entry.entityName || null,
      userId: entry.userId || null,
      userEmail: entry.userEmail,
      metadata: entry.metadata || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
    });

    // Also log to console for immediate visibility (Phase 5 backward compatibility)
    console.log(`[AUDIT] ${entry.action}`, {
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      userEmail: entry.userEmail,
      metadata: entry.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging failures shouldn't break the main operation
    // But do log to console as fallback
    console.error('[AUDIT ERROR] Failed to persist audit log:', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userEmail: entry.userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters?: {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const { limit = 100, offset = 0 } = filters || {};
    
    let query = db.select().from(auditLogs);

    // Add filters when implementing query builder
    // For now, just return recent logs
    const logs = await query
      .orderBy(auditLogs.createdAt)
      .limit(limit)
      .offset(offset);

    return logs;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    throw error;
  }
}

/**
 * Helper functions for common audit actions
 */

export async function auditDeviceNotesUpdate(
  deviceId: string,
  deviceName: string,
  oldNotes: string | null,
  newNotes: string,
  userEmail: string,
  userId?: string
) {
  await createAuditLog({
    action: 'device_notes_updated',
    entityType: 'device',
    entityId: deviceId,
    entityName: deviceName,
    userId,
    userEmail,
    metadata: {
      oldNotes,
      newNotes,
    },
  });
}

export async function auditSecurityExport(
  userEmail: string,
  deviceCount: number,
  userId?: string
) {
  await createAuditLog({
    action: 'security_data_exported',
    entityType: 'system',
    userId,
    userEmail,
    metadata: {
      deviceCount,
      exportType: 'csv',
    },
  });
}

export async function auditAppInventoryExport(
  userEmail: string,
  appCount: number,
  totalDevices: number,
  filters?: { search?: string; minInstalls?: number },
  userId?: string
) {
  await createAuditLog({
    action: 'app_inventory_exported',
    entityType: 'system',
    userId,
    userEmail,
    metadata: {
      appCount,
      totalDevices,
      filters,
      exportType: 'csv',
    },
  });
}

export async function auditSettingUpdate(
  settingKey: string,
  oldValue: any,
  newValue: any,
  userEmail: string,
  userId?: string
) {
  await createAuditLog({
    action: 'setting_updated',
    entityType: 'setting',
    entityId: settingKey,
    entityName: settingKey,
    userId,
    userEmail,
    metadata: {
      oldValue,
      newValue,
    },
  });
}

export async function auditUserRoleChange(
  targetUserId: string,
  targetUserEmail: string,
  oldRole: string,
  newRole: string,
  userEmail: string,
  userId?: string
) {
  await createAuditLog({
    action: 'user_role_changed',
    entityType: 'user',
    entityId: targetUserId,
    entityName: targetUserEmail,
    userId,
    userEmail,
    metadata: {
      oldRole,
      newRole,
    },
  });
}
