import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * API endpoint for device compliance analytics
 * Returns aggregated statistics for dashboard visualizations
 */
export async function GET() {
  try {
    // Get total counts
    const [totalDevicesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices);
    
    const totalDevices = totalDevicesResult.count;

    // Compliance breakdown
    const [compliantResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.isCompliant, true));
    
    const [nonCompliantResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.isCompliant, false));

    // Encryption breakdown
    const [encryptedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.isEncrypted, true));

    const [notEncryptedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.isEncrypted, false));

    // OS distribution
    const osDistribution = await db
      .select({
        name: devices.operatingSystem,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL`)
      .groupBy(devices.operatingSystem)
      .orderBy(sql`count(*) DESC`);

    // Manufacturer distribution
    const manufacturerDistribution = await db
      .select({
        name: devices.manufacturer,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.manufacturer} IS NOT NULL`)
      .groupBy(devices.manufacturer)
      .orderBy(sql`count(*) DESC`)
      .limit(10); // Top 10 manufacturers

    // Compliance state breakdown
    const complianceStateDistribution = await db
      .select({
        name: devices.complianceState,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.complianceState} IS NOT NULL`)
      .groupBy(devices.complianceState)
      .orderBy(sql`count(*) DESC`);

    // Device type (chassis) distribution
    const deviceTypeDistribution = await db
      .select({
        name: devices.chassisType,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.chassisType} IS NOT NULL`)
      .groupBy(devices.chassisType)
      .orderBy(sql`count(*) DESC`);

    // Enrollment type distribution
    const enrollmentDistribution = await db
      .select({
        name: devices.enrollmentType,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.enrollmentType} IS NOT NULL`)
      .groupBy(devices.enrollmentType)
      .orderBy(sql`count(*) DESC`);

    // Management state distribution
    const managementStateDistribution = await db
      .select({
        name: devices.managementState,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.managementState} IS NOT NULL`)
      .groupBy(devices.managementState)
      .orderBy(sql`count(*) DESC`);

    // Get non-compliant devices for the list
    const nonCompliantDevices = await db
      .select({
        id: devices.id,
        deviceName: devices.deviceName,
        manufacturer: devices.manufacturer,
        model: devices.model,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        complianceState: devices.complianceState,
        userPrincipalName: devices.userPrincipalName,
        userDisplayName: devices.userDisplayName,
        lastSyncAt: devices.lastSyncAt,
      })
      .from(devices)
      .where(eq(devices.isCompliant, false))
      .orderBy(devices.lastSyncAt)
      .limit(20); // Latest 20 non-compliant devices

    // Calculate percentages
    const complianceRate = totalDevices > 0 ? (compliantResult.count / totalDevices) * 100 : 0;
    const encryptionRate = totalDevices > 0 ? (encryptedResult.count / totalDevices) * 100 : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalDevices,
        compliantDevices: compliantResult.count,
        nonCompliantDevices: nonCompliantResult.count,
        complianceRate: Math.round(complianceRate * 10) / 10,
        encryptedDevices: encryptedResult.count,
        notEncryptedDevices: notEncryptedResult.count,
        encryptionRate: Math.round(encryptionRate * 10) / 10,
      },
      charts: {
        complianceBreakdown: [
          { name: 'Compliant', value: compliantResult.count, fill: '#22c55e' },
          { name: 'Non-Compliant', value: nonCompliantResult.count, fill: '#ef4444' },
        ],
        encryptionBreakdown: [
          { name: 'Encrypted', value: encryptedResult.count, fill: '#3b82f6' },
          { name: 'Not Encrypted', value: notEncryptedResult.count, fill: '#f59e0b' },
        ],
        osDistribution: osDistribution.map((item, index) => ({
          name: item.name,
          value: item.count,
          fill: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][index % 5],
        })),
        manufacturerDistribution: manufacturerDistribution.map((item, index) => ({
          name: item.name,
          value: item.count,
          fill: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#a855f7'][index % 10],
        })),
        complianceStateDistribution: complianceStateDistribution.map((item, index) => ({
          name: item.name || 'Unknown',
          value: item.count,
          fill: ['#ef4444', '#f59e0b', '#10b981'][index % 3],
        })),
        deviceTypeDistribution: deviceTypeDistribution.map((item, index) => ({
          name: item.name || 'Unknown',
          value: item.count,
          fill: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'][index % 4],
        })),
        enrollmentDistribution: enrollmentDistribution.map((item, index) => ({
          name: item.name || 'Unknown',
          value: item.count,
          fill: ['#3b82f6', '#8b5cf6', '#ec4899'][index % 3],
        })),
        managementStateDistribution: managementStateDistribution.map((item, index) => ({
          name: item.name || 'Unknown',
          value: item.count,
          fill: ['#10b981', '#f59e0b', '#ef4444'][index % 3],
        })),
      },
      nonCompliantDevices,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch analytics:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
