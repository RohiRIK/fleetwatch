import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { syncLogs } from '@/lib/db/schema';
import { syncAllPolicies } from '@/lib/services/policySync';
import { protectRouteWithPermission } from '@/lib/auth/api-rbac';

/**
 * Cron job endpoint for syncing Intune policies and Conditional Access
 * 
 * Schedule:
 * - Daily at 4 AM (after license sync)
 * 
 * Usage:
 * - Manual trigger: POST /api/cron/sync-policies
 * - Vercel Cron: Configure in vercel.json
 * - Local testing: curl -X POST http://localhost:3000/api/cron/sync-policies
 */

export async function POST(request: NextRequest) {
  const { error } = await protectRouteWithPermission('trigger_sync');
  if (error) return error;

  const startTime = Date.now();
  
  try {
    console.log('[PolicyCron] Starting policy sync...');

    const results = await syncAllPolicies();

    const totalPolicies = 
      results.conditionalAccess + 
      results.namedLocations + 
      results.compliancePolicies + 
      results.configurationProfiles;

    const durationMs = Date.now() - startTime;

    // Log sync results to database
    await db.insert(syncLogs).values({
      syncType: 'policy_sync',
      recordsSynced: totalPolicies,
      recordsFailed: 0,
      errorMessage: null,
      durationMs,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    });

    console.log(`[PolicyCron] Policy sync completed in ${durationMs}ms.`);
    console.log(`  - Conditional Access Policies: ${results.conditionalAccess}`);
    console.log(`  - Named Locations: ${results.namedLocations}`);
    console.log(`  - Compliance Policies: ${results.compliancePolicies}`);
    console.log(`  - Configuration Profiles: ${results.configurationProfiles}`);

    return NextResponse.json({
      success: true,
      ...results,
      totalPolicies,
      durationMs,
    });

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    
    console.error('[PolicyCron] Policy sync failed:', error);

    try {
      await db.insert(syncLogs).values({
        syncType: 'policy_sync_failed',
        recordsSynced: 0,
        recordsFailed: 0,
        errorMessage: error.message,
        durationMs,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });
    } catch (dbError) {
      console.error('[PolicyCron] Failed to log error to database:', dbError);
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
 * GET endpoint for checking policy sync status
 * Returns recent policy sync logs
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

    const policySyncs = recentSyncs.filter(
      s => s.syncType.startsWith('policy')
    );

    return NextResponse.json({
      success: true,
      recentSyncs: policySyncs,
    });
  } catch (error: any) {
    console.error('[PolicyCron] Failed to fetch sync logs:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
