import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { storageHistory, devices, complianceHistory } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Storage Growth Over Time (last 30 days)
    const storageGrowth = await db
      .select({
        date: sql<string>`DATE(${storageHistory.recordedAt})`.as('date'),
        totalStorage: sql<number>`AVG(${storageHistory.storageTotal})::bigint`.as('total'),
        usedStorage: sql<number>`AVG(${storageHistory.storageTotal} - ${storageHistory.storageFree})::bigint`.as('used'),
        freeStorage: sql<number>`AVG(${storageHistory.storageFree})::bigint`.as('free'),
        avgUtilization: sql<number>`AVG(${storageHistory.utilizationPercent})::numeric`.as('utilization'),
      })
      .from(storageHistory)
      .groupBy(sql`DATE(${storageHistory.recordedAt})`)
      .orderBy(sql`DATE(${storageHistory.recordedAt}) ASC`)
      .limit(30);

    // 2. Compliance Trend Over Time (last 30 days)
    const complianceTrend = await db
      .select({
        date: sql<string>`DATE(${complianceHistory.recordedAt})`.as('date'),
        compliant: sql<number>`SUM(CASE WHEN ${complianceHistory.isCompliant} = true THEN 1 ELSE 0 END)::int`.as('compliant'),
        nonCompliant: sql<number>`SUM(CASE WHEN ${complianceHistory.isCompliant} = false THEN 1 ELSE 0 END)::int`.as('nonCompliant'),
        total: sql<number>`COUNT(*)::int`.as('total'),
      })
      .from(complianceHistory)
      .groupBy(sql`DATE(${complianceHistory.recordedAt})`)
      .orderBy(sql`DATE(${complianceHistory.recordedAt}) ASC`)
      .limit(30);

    const formattedComplianceTrend = complianceTrend.map((day) => ({
      date: day.date,
      compliant: Number(day.compliant),
      nonCompliant: Number(day.nonCompliant),
      complianceRate: day.total > 0 ? (Number(day.compliant) / Number(day.total)) * 100 : 0,
    }));

    // 3. Device Age Distribution (based on enrollment date)
    const now = new Date();
    const deviceAgeDistribution = await db
      .select({
        ageCategory: sql<string>`
          CASE 
            WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '3 months' THEN '0-3 months'
            WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '6 months' THEN '3-6 months'
            WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '1 year' THEN '6-12 months'
            WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '2 years' THEN '1-2 years'
            WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '3 years' THEN '2-3 years'
            ELSE '3+ years'
          END
        `.as('age_category'),
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(devices)
      .where(sql`${devices.enrolledAt} IS NOT NULL`)
      .groupBy(sql`
        CASE 
          WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '3 months' THEN '0-3 months'
          WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '6 months' THEN '3-6 months'
          WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '1 year' THEN '6-12 months'
          WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '2 years' THEN '1-2 years'
          WHEN ${devices.enrolledAt} >= NOW() - INTERVAL '3 years' THEN '2-3 years'
          ELSE '3+ years'
        END
      `);

    // Sort device age by category order
    const ageCategoryOrder = ['0-3 months', '3-6 months', '6-12 months', '1-2 years', '2-3 years', '3+ years'];
    const sortedDeviceAge = deviceAgeDistribution.sort((a, b) => {
      return ageCategoryOrder.indexOf(a.ageCategory) - ageCategoryOrder.indexOf(b.ageCategory);
    });

    // 4. Policy Failure Trends (from compliance_history JSONB)
    const policyFailureTrends = await db
      .select({
        date: sql<string>`DATE(${complianceHistory.recordedAt})`.as('date'),
        totalFailures: sql<number>`COUNT(*) FILTER (WHERE ${complianceHistory.isCompliant} = false)::int`.as('total_failures'),
        avgFailuresPerDevice: sql<number>`AVG(CASE WHEN ${complianceHistory.isCompliant} = false THEN jsonb_array_length(COALESCE(${complianceHistory.policyFailures}, '[]'::jsonb)) ELSE 0 END)::numeric`.as('avg_failures'),
      })
      .from(complianceHistory)
      .groupBy(sql`DATE(${complianceHistory.recordedAt})`)
      .orderBy(sql`DATE(${complianceHistory.recordedAt}) ASC`)
      .limit(30);

    // 5. Encryption Adoption Trend Over Time
    const encryptionTrend = await db
      .select({
        date: sql<string>`DATE(${devices.updatedAt})`.as('date'),
        encrypted: sql<number>`COUNT(*) FILTER (WHERE ${devices.isEncrypted} = true)::int`.as('encrypted'),
        notEncrypted: sql<number>`COUNT(*) FILTER (WHERE ${devices.isEncrypted} = false)::int`.as('not_encrypted'),
        total: sql<number>`COUNT(*)::int`.as('total'),
      })
      .from(devices)
      .groupBy(sql`DATE(${devices.updatedAt})`)
      .orderBy(sql`DATE(${devices.updatedAt}) ASC`)
      .limit(30);

    const formattedEncryptionTrend = encryptionTrend.map((day) => ({
      date: day.date,
      encrypted: Number(day.encrypted),
      notEncrypted: Number(day.notEncrypted),
      encryptionRate: day.total > 0 ? (Number(day.encrypted) / Number(day.total)) * 100 : 0,
    }));

    // 6. OS Version Distribution (identify outdated versions)
    const osVersionTrend = await db
      .select({
        os: devices.operatingSystem,
        version: devices.osVersion,
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL AND ${devices.osVersion} IS NOT NULL`)
      .groupBy(devices.operatingSystem, devices.osVersion)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    // 7. User Compliance Ranking (users with most non-compliant devices)
    const userComplianceRanking = await db
      .select({
        userDisplayName: devices.userDisplayName,
        userEmail: devices.userEmail,
        department: devices.userDepartment,
        totalDevices: sql<number>`COUNT(*)::int`.as('total_devices'),
        nonCompliantDevices: sql<number>`COUNT(*) FILTER (WHERE ${devices.isCompliant} = false)::int`.as('non_compliant'),
        complianceRate: sql<number>`(COUNT(*) FILTER (WHERE ${devices.isCompliant} = true)::float / COUNT(*)::float * 100)::numeric`.as('compliance_rate'),
      })
      .from(devices)
      .where(sql`${devices.userDisplayName} IS NOT NULL`)
      .groupBy(devices.userDisplayName, devices.userEmail, devices.userDepartment)
      .having(sql`COUNT(*) > 0`)
      .orderBy(sql`COUNT(*) FILTER (WHERE ${devices.isCompliant} = false) DESC`)
      .limit(10);

    // 8. Storage Capacity Planning (devices running out of space)
    const storageCapacityWarnings = await db
      .select({
        utilizationRange: sql<string>`
          CASE 
            WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.9 THEN '90-100% Full'
            WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.8 THEN '80-90% Full'
            WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.7 THEN '70-80% Full'
            WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.5 THEN '50-70% Full'
            ELSE '0-50% Full'
          END
        `.as('utilization_range'),
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(devices)
      .where(sql`${devices.storageTotal} IS NOT NULL AND ${devices.storageFree} IS NOT NULL AND ${devices.storageTotal} > 0`)
      .groupBy(sql`
        CASE 
          WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.9 THEN '90-100% Full'
          WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.8 THEN '80-90% Full'
          WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.7 THEN '70-80% Full'
          WHEN (${devices.storageTotal} - ${devices.storageFree})::float / ${devices.storageTotal}::float >= 0.5 THEN '50-70% Full'
          ELSE '0-50% Full'
        END
      `);

    // Sort storage warnings by severity
    const storageOrder = ['90-100% Full', '80-90% Full', '70-80% Full', '50-70% Full', '0-50% Full'];
    const sortedStorageWarnings = storageCapacityWarnings.sort((a, b) => {
      return storageOrder.indexOf(a.utilizationRange) - storageOrder.indexOf(b.utilizationRange);
    });

    // 9. Windows/macOS OS Build Tracking (last 30 days)
    const osBuildTrend = await db
      .select({
        date: sql<string>`DATE(${devices.updatedAt})`.as('date'),
        windowsCount: sql<number>`COUNT(*) FILTER (WHERE LOWER(${devices.operatingSystem}) LIKE '%windows%')::int`.as('windows_count'),
        macosCount: sql<number>`COUNT(*) FILTER (WHERE LOWER(${devices.operatingSystem}) LIKE '%mac%')::int`.as('macos_count'),
      })
      .from(devices)
      .where(sql`${devices.operatingSystem} IS NOT NULL`)
      .groupBy(sql`DATE(${devices.updatedAt})`)
      .orderBy(sql`DATE(${devices.updatedAt}) ASC`)
      .limit(30);

    // 10. Device Health Score Trend (composite score based on compliance, encryption, recent sync)
    const healthScoreTrend = await db
      .select({
        date: sql<string>`DATE(${devices.updatedAt})`.as('date'),
        avgHealthScore: sql<number>`
          AVG(
            CASE WHEN ${devices.isCompliant} THEN 40 ELSE 0 END +
            CASE WHEN ${devices.isEncrypted} THEN 30 ELSE 0 END +
            CASE WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '7 days' THEN 30 ELSE 0 END
          )::numeric
        `.as('avg_health'),
        totalDevices: sql<number>`COUNT(*)::int`.as('total'),
      })
      .from(devices)
      .groupBy(sql`DATE(${devices.updatedAt})`)
      .orderBy(sql`DATE(${devices.updatedAt}) ASC`)
      .limit(30);

    // 11. User Activity Patterns (last login distribution)
    const userActivityPatterns = await db
      .select({
        activityCategory: sql<string>`
          CASE 
            WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '24 hours' THEN 'Active (24h)'
            WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '7 days' THEN 'Recent (7d)'
            WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '30 days' THEN 'Inactive (30d)'
            WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '90 days' THEN 'Stale (90d)'
            ELSE 'Dormant (90d+)'
          END
        `.as('activity_category'),
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(devices)
      .where(sql`${devices.lastSyncAt} IS NOT NULL`)
      .groupBy(sql`
        CASE 
          WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '24 hours' THEN 'Active (24h)'
          WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '7 days' THEN 'Recent (7d)'
          WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '30 days' THEN 'Inactive (30d)'
          WHEN ${devices.lastSyncAt} >= NOW() - INTERVAL '90 days' THEN 'Stale (90d)'
          ELSE 'Dormant (90d+)'
        END
      `);

    // Sort activity patterns
    const activityOrder = ['Active (24h)', 'Recent (7d)', 'Inactive (30d)', 'Stale (90d)', 'Dormant (90d+)'];
    const sortedActivityPatterns = userActivityPatterns.sort((a, b) => {
      return activityOrder.indexOf(a.activityCategory) - activityOrder.indexOf(b.activityCategory);
    });

    // 12. Hardware Refresh Candidates (devices older than 3 years OR with outdated specs)
    const hardwareRefreshCandidates = await db
      .select({
        deviceName: devices.deviceName,
        manufacturer: devices.manufacturer,
        model: devices.model,
        operatingSystem: devices.operatingSystem,
        osVersion: devices.osVersion,
        enrolledAt: devices.enrolledAt,
        userDisplayName: devices.userDisplayName,
        userEmail: devices.userEmail,
        reason: sql<string>`
          CASE 
            WHEN ${devices.enrolledAt} < NOW() - INTERVAL '3 years' THEN 'Device older than 3 years'
            ELSE 'Outdated specifications'
          END
        `.as('reason'),
      })
      .from(devices)
      .where(sql`
        ${devices.enrolledAt} < NOW() - INTERVAL '3 years'
        OR ${devices.osVersion} IS NOT NULL
      `)
      .orderBy(sql`${devices.enrolledAt} ASC`)
      .limit(20);

    return NextResponse.json({
      success: true,
      storageGrowth: storageGrowth.map(s => ({
        date: s.date,
        totalStorage: Number(s.totalStorage),
        usedStorage: Number(s.usedStorage),
        freeStorage: Number(s.freeStorage),
        avgUtilization: Number(s.avgUtilization),
      })),
      complianceTrend: formattedComplianceTrend,
      deviceAgeDistribution: sortedDeviceAge,
      policyFailureTrends: policyFailureTrends.map(p => ({
        date: p.date,
        totalFailures: Number(p.totalFailures),
        avgFailuresPerDevice: Number(p.avgFailuresPerDevice),
      })),
      encryptionTrend: formattedEncryptionTrend,
      osVersionTrend: osVersionTrend.map(v => ({
        os: v.os,
        version: v.version,
        count: Number(v.count),
      })),
      userComplianceRanking: userComplianceRanking.map(u => ({
        userDisplayName: u.userDisplayName,
        userEmail: u.userEmail,
        department: u.department,
        totalDevices: Number(u.totalDevices),
        nonCompliantDevices: Number(u.nonCompliantDevices),
        complianceRate: Number(u.complianceRate),
      })),
      storageCapacityWarnings: sortedStorageWarnings,
      osBuildTrend: osBuildTrend.map(o => ({
        date: o.date,
        windowsCount: Number(o.windowsCount),
        macosCount: Number(o.macosCount),
      })),
      healthScoreTrend: healthScoreTrend.map(h => ({
        date: h.date,
        avgHealthScore: Number(h.avgHealthScore),
        totalDevices: Number(h.totalDevices),
      })),
      userActivityPatterns: sortedActivityPatterns,
      hardwareRefreshCandidates: hardwareRefreshCandidates.map(h => ({
        deviceName: h.deviceName,
        manufacturer: h.manufacturer,
        model: h.model,
        operatingSystem: h.operatingSystem,
        osVersion: h.osVersion,
        enrolledAt: h.enrolledAt,
        userDisplayName: h.userDisplayName,
        userEmail: h.userEmail,
        reason: h.reason,
      })),
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends data' },
      { status: 500 }
    );
  }
}
