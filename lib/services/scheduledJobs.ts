import { db } from '@/lib/db/drizzle';
import { activityLogs, complianceHistory, storageHistory, devices } from '@/lib/db/schema';
import { lt, sql } from 'drizzle-orm';

/**
 * Scheduled Jobs Service
 * 
 * Background tasks that run on a schedule (daily, hourly, etc.)
 * - Cleanup old activity logs (30 days retention)
 * - Take daily snapshots for compliance/storage history
 */

/**
 * Clean up activity logs older than 30 days
 * Should run daily (recommended: 2 AM)
 */
export async function cleanupOldActivityLogs(): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  try {
    console.log('[ScheduledJobs] Starting activity log cleanup...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db
      .delete(activityLogs)
      .where(lt(activityLogs.createdAt, thirtyDaysAgo))
      .returning({ id: activityLogs.id });
    
    const deletedCount = result.length;
    console.log(`[ScheduledJobs] Deleted ${deletedCount} activity logs older than 30 days`);
    
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('[ScheduledJobs] Failed to cleanup activity logs:', error);
    return { success: false, deletedCount: 0, error: error.message };
  }
}

/**
 * Take daily snapshots of compliance state for all devices
 * Should run daily (recommended: 1 AM)
 */
export async function takeComplianceSnapshots(): Promise<{
  success: boolean;
  snapshotCount: number;
  error?: string;
}> {
  try {
    console.log('[ScheduledJobs] Taking compliance snapshots...');
    
    // Get all devices with compliance data
    const allDevices = await db
      .select({
        id: devices.id,
        isCompliant: devices.isCompliant,
        complianceState: devices.complianceState,
        complianceDetails: devices.complianceDetails,
      })
      .from(devices)
      .where(sql`${devices.deletedAt} IS NULL`); // Exclude soft-deleted devices
    
    let snapshotCount = 0;
    
    for (const device of allDevices) {
      // Extract failed policies
      const policyFailures = Array.isArray(device.complianceDetails)
        ? device.complianceDetails.filter((policy: any) => policy.state !== 'compliant')
        : [];
      
      await db.insert(complianceHistory).values({
        deviceId: device.id,
        isCompliant: device.isCompliant,
        complianceState: device.complianceState,
        policyFailures: policyFailures.length > 0 ? policyFailures : null,
      });
      
      snapshotCount++;
    }
    
    console.log(`[ScheduledJobs] Created ${snapshotCount} compliance snapshots`);
    return { success: true, snapshotCount };
  } catch (error: any) {
    console.error('[ScheduledJobs] Failed to take compliance snapshots:', error);
    return { success: false, snapshotCount: 0, error: error.message };
  }
}

/**
 * Take daily snapshots of storage utilization for all devices
 * Should run daily (recommended: 1 AM)
 */
export async function takeStorageSnapshots(): Promise<{
  success: boolean;
  snapshotCount: number;
  error?: string;
}> {
  try {
    console.log('[ScheduledJobs] Taking storage snapshots...');
    
    // Get all devices with storage data
    const allDevices = await db
      .select({
        id: devices.id,
        storageTotal: devices.storageTotal,
        storageFree: devices.storageFree,
      })
      .from(devices)
      .where(sql`${devices.deletedAt} IS NULL AND ${devices.storageTotal} IS NOT NULL`);
    
    let snapshotCount = 0;
    
    for (const device of allDevices) {
      if (device.storageTotal && device.storageFree !== null) {
        const storageUsed = device.storageTotal - (device.storageFree || 0);
        const utilizationPercent = device.storageTotal > 0
          ? Math.round((storageUsed / device.storageTotal) * 100)
          : 0;
        
        await db.insert(storageHistory).values({
          deviceId: device.id,
          storageTotal: device.storageTotal,
          storageFree: device.storageFree,
          storageUsed,
          utilizationPercent,
        });
        
        snapshotCount++;
      }
    }
    
    console.log(`[ScheduledJobs] Created ${snapshotCount} storage snapshots`);
    return { success: true, snapshotCount };
  } catch (error: any) {
    console.error('[ScheduledJobs] Failed to take storage snapshots:', error);
    return { success: false, snapshotCount: 0, error: error.message };
  }
}

/**
 * Run all daily maintenance jobs
 * Convenience function to run all scheduled tasks at once
 */
export async function runDailyMaintenance(): Promise<{
  success: boolean;
  results: {
    cleanup: any;
    compliance: any;
    storage: any;
  };
}> {
  console.log('[ScheduledJobs] Running daily maintenance...');
  
  const cleanup = await cleanupOldActivityLogs();
  const compliance = await takeComplianceSnapshots();
  const storage = await takeStorageSnapshots();
  
  const success = cleanup.success && compliance.success && storage.success;
  
  console.log('[ScheduledJobs] Daily maintenance completed:', {
    success,
    logsDeleted: cleanup.deletedCount,
    complianceSnapshots: compliance.snapshotCount,
    storageSnapshots: storage.snapshotCount,
  });
  
  return {
    success,
    results: { cleanup, compliance, storage },
  };
}
