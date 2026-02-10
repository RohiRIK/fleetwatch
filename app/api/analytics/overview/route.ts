import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { devices } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Summary metrics
    const totalDevices = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices);

    const complianceStats = await db
      .select({
        compliant: sql<number>`count(*) filter (where is_compliant = true)::int`,
        nonCompliant: sql<number>`count(*) filter (where is_compliant = false)::int`,
      })
      .from(devices);

    const encryptionStats = await db
      .select({
        encrypted: sql<number>`count(*) filter (where is_encrypted = true)::int`,
        notEncrypted: sql<number>`count(*) filter (where is_encrypted = false)::int`,
      })
      .from(devices);

    // OS Distribution
    const osDistribution = await db
      .select({
        os: devices.operatingSystem,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL`)
      .groupBy(devices.operatingSystem)
      .orderBy(sql`count(*) DESC`);

    // OS Version Distribution (top 10)
    const osVersions = await db
      .select({
        version: sql<string>`${devices.operatingSystem} || ' ' || ${devices.osVersion}`,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL AND ${devices.osVersion} IS NOT NULL`)
      .groupBy(sql`${devices.operatingSystem} || ' ' || ${devices.osVersion}`)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // Manufacturer Distribution (top 10)
    const manufacturers = await db
      .select({
        manufacturer: devices.manufacturer,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.manufacturer} IS NOT NULL`)
      .groupBy(devices.manufacturer)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // Chassis Type Distribution
    const chassisTypes = await db
      .select({
        type: devices.chassisType,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.chassisType} IS NOT NULL`)
      .groupBy(devices.chassisType)
      .orderBy(sql`count(*) DESC`);

    // Storage Utilization Stats
    const storageStats = await db
      .select({
        totalStorage: sql<number>`sum(${devices.storageTotal})::bigint`,
        usedStorage: sql<number>`sum(${devices.storageTotal} - ${devices.storageFree})::bigint`,
        freeStorage: sql<number>`sum(${devices.storageFree})::bigint`,
        avgUtilization: sql<number>`avg(
          case 
            when ${devices.storageTotal} > 0 
            then ((${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float * 100)
            else 0 
          end
        )::numeric`,
      })
      .from(devices)
      .where(sql`${devices.storageTotal} IS NOT NULL AND ${devices.storageFree} IS NOT NULL`);

    // Enrollment trends (by month for last 6 months)
    const enrollmentTrends = await db
      .select({
        month: sql<string>`to_char(${devices.enrolledAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.enrolledAt} IS NOT NULL AND ${devices.enrolledAt} >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`to_char(${devices.enrolledAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${devices.enrolledAt}, 'YYYY-MM')`);

    // Last sync trends (by day for last 30 days)
    const syncTrends = await db
      .select({
        date: sql<string>`to_char(${devices.lastSyncAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.lastSyncAt} IS NOT NULL AND ${devices.lastSyncAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`to_char(${devices.lastSyncAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${devices.lastSyncAt}, 'YYYY-MM-DD')`);

    // Management State Distribution
    const managementStates = await db
      .select({
        state: devices.managementState,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.managementState} IS NOT NULL`)
      .groupBy(devices.managementState)
      .orderBy(sql`count(*) DESC`);

    // Join Type Distribution
    const joinTypes = await db
      .select({
        type: devices.joinType,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(sql`${devices.joinType} IS NOT NULL`)
      .groupBy(devices.joinType)
      .orderBy(sql`count(*) DESC`);

    return NextResponse.json({
      summary: {
        totalDevices: totalDevices[0]?.count || 0,
        compliant: complianceStats[0]?.compliant || 0,
        nonCompliant: complianceStats[0]?.nonCompliant || 0,
        complianceRate: totalDevices[0]?.count > 0
          ? ((complianceStats[0]?.compliant || 0) / totalDevices[0].count * 100).toFixed(1)
          : '0.0',
        encrypted: encryptionStats[0]?.encrypted || 0,
        notEncrypted: encryptionStats[0]?.notEncrypted || 0,
        encryptionRate: totalDevices[0]?.count > 0
          ? ((encryptionStats[0]?.encrypted || 0) / totalDevices[0].count * 100).toFixed(1)
          : '0.0',
      },
      osDistribution,
      osVersions,
      manufacturers,
      chassisTypes,
      storageStats: storageStats[0] || {},
      enrollmentTrends,
      syncTrends,
      managementStates,
      joinTypes,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
