import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { syncLogs } from '@/lib/db/schema';
import { syncAllUserLicenses } from '@/lib/services/licenseSync';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

/**
 * Cron job endpoint for syncing user licenses from Microsoft Graph API
 * 
 * Schedule:
 * - Daily at 3 AM (license sync after user sync)
 * 
 * Usage:
 * - Manual trigger: POST /api/cron/sync-licenses
 * - Vercel Cron: Configure in vercel.json
 * - Local testing: curl -X POST http://localhost:3000/api/cron/sync-licenses
 */

export async function POST(request: NextRequest) {
  const { error } = await protectRouteWithPermission('trigger_sync');
  if (error) return error;

  const startTime = Date.now();
  
  try {
    console.log('[LicenseCron] Starting license sync...');

    const usersProcessed = await syncAllUserLicenses();

    const durationMs = Date.now() - startTime;

    // Log sync results to database
    await db.insert(syncLogs).values({
      syncType: 'license_sync',
      recordsSynced: usersProcessed,
      recordsFailed: 0,
      errorMessage: null,
      durationMs,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    console.log(`[LicenseCron] License sync completed in ${durationMs}ms. ${usersProcessed} users processed.`);

    return NextResponse.json({
      success: true,
      usersProcessed,
      durationMs,
    });

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    
    console.error('[LicenseCron] License sync failed:', error);

    try {
      await db.insert(syncLogs).values({
        syncType: 'license_sync_failed',
        recordsSynced: 0,
        recordsFailed: 0,
        errorMessage: error.message,
        durationMs,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });
    } catch (dbError) {
      console.error('[LicenseCron] Failed to log error to database:', dbError);
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
 * GET endpoint for checking license sync status
 * Returns recent license sync logs
 */
export async function GET() {
  const { error } = await protectRouteWithPermission('view_monitoring');
  if (error) return error;

  try {
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
    console.error('[LicenseCron] Failed to fetch sync logs:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
