import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { syncLogs } from '@/lib/db/schema';
import { syncDevices } from '@/lib/services/deviceSync';
import { syncUsers } from '@/lib/services/userSync';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

/**
 * Cron job endpoint for syncing devices and users from Microsoft Intune
 * 
 * Schedule:
 * - Incremental sync: Every hour (delta queries)
 * - Deep refresh: Daily at 2 AM (full enrichment)
 * - Full resync: Weekly on Sunday at 2 AM
 * 
 * Usage:
 * - Manual trigger: POST /api/cron/sync-devices?mode=full
 * - Vercel Cron: Configure in vercel.json
 * - Local testing: curl -X POST http://localhost:3000/api/cron/sync-devices?mode=full
 */

export async function POST(request: NextRequest) {
  // Protect route - require 'trigger_sync' permission (ADMIN or SUPERADMIN)
  const { error } = await protectRouteWithPermission('trigger_sync');
  if (error) return error;

  const startTime = Date.now();
  
  try {
    // Get sync mode from query params (default: incremental)
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') as 'full' | 'incremental' | 'deep') || 'incremental';
    const syncUsersFlag = searchParams.get('syncUsers') === 'true';

    console.log(`[SyncCron] Starting ${mode} sync (syncUsers: ${syncUsersFlag})`);

    // Run user sync first (if requested)
    let userSyncResult = null;
    if (syncUsersFlag) {
      console.log('[SyncCron] Syncing users...');
      userSyncResult = await syncUsers();
      console.log(`[SyncCron] User sync completed: ${userSyncResult.usersProcessed} users processed`);
    }

    // Run device sync
    console.log(`[SyncCron] Syncing devices in ${mode} mode...`);
    const deviceSyncResult = await syncDevices(mode);

    const durationMs = Date.now() - startTime;

    // Log sync results to database
    await db.insert(syncLogs).values({
      syncType: `${mode}_sync`,
      recordsSynced: deviceSyncResult.devicesProcessed + (userSyncResult?.usersProcessed || 0),
      recordsFailed: deviceSyncResult.devicesFailed + (userSyncResult?.usersFailed || 0),
      errorMessage: deviceSyncResult.errors.length > 0 
        ? JSON.stringify(deviceSyncResult.errors.slice(0, 10)) // Store first 10 errors
        : null,
      durationMs,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    console.log(
      `[SyncCron] Sync completed in ${durationMs}ms. ` +
      `Devices: ${deviceSyncResult.devicesProcessed} processed ` +
      `(${deviceSyncResult.devicesCreated} created, ${deviceSyncResult.devicesUpdated} updated, ` +
      `${deviceSyncResult.devicesFailed} failed)`
    );

    return NextResponse.json({
      success: true,
      mode,
      devices: {
        processed: deviceSyncResult.devicesProcessed,
        created: deviceSyncResult.devicesCreated,
        updated: deviceSyncResult.devicesUpdated,
        failed: deviceSyncResult.devicesFailed,
      },
      users: userSyncResult ? {
        processed: userSyncResult.usersProcessed,
        created: userSyncResult.usersCreated,
        updated: userSyncResult.usersUpdated,
        failed: userSyncResult.usersFailed,
      } : null,
      durationMs,
      errors: deviceSyncResult.errors.slice(0, 10), // Return first 10 errors
    });

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    
    console.error('[SyncCron] Sync failed:', error);

    // Log failure to database
    try {
      await db.insert(syncLogs).values({
        syncType: 'sync_failed',
        recordsSynced: 0,
        recordsFailed: 0,
        errorMessage: error.message,
        durationMs,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });
    } catch (dbError) {
      console.error('[SyncCron] Failed to log error to database:', dbError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        durationMs,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking sync status
 * Returns recent sync logs
 */
export async function GET() {
  // Protect route - require 'view_monitoring' permission (ADMIN or SUPERADMIN)
  const { error } = await protectRouteWithPermission('view_monitoring');
  if (error) return error;

  try {
    // Get last 10 sync logs
    const recentSyncs = await db
      .select()
      .from(syncLogs)
      .orderBy(desc(syncLogs.startedAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      recentSyncs,
    });
  } catch (error: any) {
    console.error('[SyncCron] Failed to fetch sync logs:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
