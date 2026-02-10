import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices, activityLogs, syncLogs } from '@/lib/db/schema';
import { sql, desc, lt } from 'drizzle-orm';

/**
 * API Route: GET /api/dashboard/overview
 * 
 * Returns dashboard overview data:
 * - Critical alerts (non-compliant, low disk space, failed syncs)
 * - Summary metrics
 * - Activity feed (recent events)
 * - Storage overview
 * - Device health
 * - Top devices needing attention
 */
export async function GET(request: NextRequest) {
  try {
    // Get all devices
    const allDevices = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        manufacturer: devices.manufacturer,
        model: devices.model,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        isCompliant: devices.isCompliant,
        complianceState: devices.complianceState,
        complianceDetails: devices.complianceDetails,
        isEncrypted: devices.isEncrypted,
        storageTotal: devices.storageTotal,
        storageFree: devices.storageFree,
        userPrincipalName: devices.userPrincipalName,
        userDisplayName: devices.userDisplayName,
        lastSyncAt: devices.lastSyncAt,
      })
      .from(devices)
      .where(sql`${devices.deletedAt} IS NULL`);

    // Calculate summary metrics
    const totalDevices = allDevices.length;
    const nonCompliantDevices = allDevices.filter(d => !d.isCompliant);
    const unencryptedDevices = allDevices.filter(d => !d.isEncrypted);
    
    // Find devices with low disk space (<10% free)
    const lowDiskSpaceDevices = allDevices.filter(d => {
      if (!d.storageTotal || !d.storageFree) return false;
      const percentFree = (d.storageFree / d.storageTotal) * 100;
      return percentFree < 10;
    });

    // Get failed syncs in last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const failedSyncsLast24h = await db
      .select({
        id: syncLogs.id,
        syncType: syncLogs.syncType,
        recordsFailed: syncLogs.recordsFailed,
        errorMessage: syncLogs.errorMessage,
        startedAt: syncLogs.startedAt,
      })
      .from(syncLogs)
      .where(
        sql`${syncLogs.startedAt} > ${twentyFourHoursAgo.toISOString()} AND ${syncLogs.errorMessage} IS NOT NULL`
      )
      .orderBy(desc(syncLogs.startedAt))
      .limit(10);

    // Get activity feed (last 20 events)
    const activityFeed = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(20);

    // Get recent sync logs
    const recentSyncs = await db
      .select({
        id: syncLogs.id,
        syncType: syncLogs.syncType,
        recordsSynced: syncLogs.recordsSynced,
        recordsFailed: syncLogs.recordsFailed,
        errorMessage: syncLogs.errorMessage,
        durationMs: syncLogs.durationMs,
        startedAt: syncLogs.startedAt,
        completedAt: syncLogs.completedAt,
      })
      .from(syncLogs)
      .orderBy(desc(syncLogs.startedAt))
      .limit(10);

    // Combine activity feed with sync logs
    const combinedActivity = [
      ...activityFeed.map(a => ({
        type: 'activity',
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        timestamp: a.createdAt,
      })),
      ...recentSyncs.map(s => ({
        type: 'sync',
        id: s.id,
        action: s.errorMessage ? 'SYNC_FAILED' : 'SYNC_COMPLETED',
        syncType: s.syncType,
        recordsSynced: s.recordsSynced,
        recordsFailed: s.recordsFailed,
        errorMessage: s.errorMessage,
        durationMs: s.durationMs,
        timestamp: s.startedAt,
        completedAt: s.completedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // Calculate storage overview
    const storageStats: {
      totalStorage: number;
      storageFree: number;
      storageUsed: number;
      utilizationPercent: string;
    } = allDevices.reduce(
      (acc, device) => {
        if (device.storageTotal) {
          acc.totalStorage += device.storageTotal;
          acc.storageFree += device.storageFree || 0;
        }
        return acc;
      },
      { totalStorage: 0, storageFree: 0, storageUsed: 0, utilizationPercent: '0' }
    );
    storageStats.storageUsed = storageStats.totalStorage - storageStats.storageFree;
    storageStats.utilizationPercent = storageStats.totalStorage > 0
      ? ((storageStats.storageUsed / storageStats.totalStorage) * 100).toFixed(1)
      : '0';

    // Get top devices needing attention (most non-compliant issues)
    const devicesNeedingAttention = nonCompliantDevices
      .map(device => {
        // Count number of failed policies
        const failedPolicies = Array.isArray(device.complianceDetails)
          ? device.complianceDetails.filter((p: any) => p.state !== 'compliant').length
          : 0;
        
        return {
          id: device.id,
          deviceName: device.deviceName,
          manufacturer: device.manufacturer,
          model: device.model,
          operatingSystem: device.operatingSystem,
          osVersion: device.osVersion,
          userPrincipalName: device.userPrincipalName,
          userDisplayName: device.userDisplayName,
          isCompliant: device.isCompliant,
          isEncrypted: device.isEncrypted,
          complianceState: device.complianceState,
          failedPoliciesCount: failedPolicies,
          lastSyncAt: device.lastSyncAt,
        };
      })
      .sort((a, b) => b.failedPoliciesCount - a.failedPoliciesCount)
      .slice(0, 5);

    // Return dashboard data
    return NextResponse.json({
      success: true,
      criticalAlerts: {
        nonCompliantCount: nonCompliantDevices.length,
        lowDiskSpaceCount: lowDiskSpaceDevices.length,
        failedSyncsCount: failedSyncsLast24h.length,
        unencryptedCount: unencryptedDevices.length,
      },
      summary: {
        totalDevices,
        nonCompliantDevices: nonCompliantDevices.length,
        unencryptedDevices: unencryptedDevices.length,
        failedSyncs24h: failedSyncsLast24h.length,
      },
      activityFeed: combinedActivity,
      storageOverview: {
        totalStorage: storageStats.totalStorage.toString(),
        storageFree: storageStats.storageFree.toString(),
        storageUsed: storageStats.storageUsed.toString(),
        utilizationPercent: storageStats.utilizationPercent,
      },
      deviceHealth: {
        compliant: totalDevices - nonCompliantDevices.length,
        nonCompliant: nonCompliantDevices.length,
        encrypted: allDevices.filter(d => d.isEncrypted).length,
        unencrypted: unencryptedDevices.length,
        complianceRate: totalDevices > 0 
          ? ((totalDevices - nonCompliantDevices.length) / totalDevices * 100).toFixed(1)
          : '0',
        encryptionRate: totalDevices > 0
          ? ((allDevices.filter(d => d.isEncrypted).length / totalDevices) * 100).toFixed(1)
          : '0',
      },
      devicesNeedingAttention,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch dashboard overview:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
