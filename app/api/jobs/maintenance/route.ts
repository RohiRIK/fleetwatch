import { NextRequest, NextResponse } from 'next/server';
import { runDailyMaintenance, cleanupOldActivityLogs, takeComplianceSnapshots, takeStorageSnapshots } from '@/lib/services/scheduledJobs';

/**
 * API Route: POST /api/jobs/maintenance
 * 
 * Triggers scheduled maintenance jobs manually or via cron
 * 
 * Query params:
 * - job: 'all' | 'cleanup' | 'compliance' | 'storage' (default: 'all')
 * - secret: Authorization secret (must match CRON_SECRET env var)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization (protect this endpoint!)
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
    const authHeader = request.headers.get('authorization');
    const urlSecret = request.nextUrl.searchParams.get('secret');
    
    if (authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const job = request.nextUrl.searchParams.get('job') || 'all';
    
    let result;
    
    switch (job) {
      case 'cleanup':
        result = await cleanupOldActivityLogs();
        break;
      case 'compliance':
        result = await takeComplianceSnapshots();
        break;
      case 'storage':
        result = await takeStorageSnapshots();
        break;
      case 'all':
      default:
        result = await runDailyMaintenance();
        break;
    }
    
    return NextResponse.json({
      success: result.success,
      job,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API] Failed to run maintenance job:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to view job status/configuration
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    jobs: {
      cleanup: {
        description: 'Delete activity logs older than 30 days',
        schedule: 'Daily at 2 AM',
        endpoint: '/api/jobs/maintenance?job=cleanup',
      },
      compliance: {
        description: 'Take compliance state snapshots for all devices',
        schedule: 'Daily at 1 AM',
        endpoint: '/api/jobs/maintenance?job=compliance',
      },
      storage: {
        description: 'Take storage utilization snapshots for all devices',
        schedule: 'Daily at 1 AM',
        endpoint: '/api/jobs/maintenance?job=storage',
      },
      all: {
        description: 'Run all maintenance jobs',
        schedule: 'Daily at 1 AM',
        endpoint: '/api/jobs/maintenance?job=all',
      },
    },
    note: 'Add Authorization header with Bearer token or ?secret= query param to run jobs',
  });
}
