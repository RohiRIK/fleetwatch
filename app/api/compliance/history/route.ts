import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { complianceHistory } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Fetch aggregated compliance history by date
    const history = await db
      .select({
        date: sql<string>`DATE(${complianceHistory.recordedAt})`.as('date'),
        compliant: sql<number>`SUM(CASE WHEN ${complianceHistory.isCompliant} = true THEN 1 ELSE 0 END)`.as('compliant'),
        nonCompliant: sql<number>`SUM(CASE WHEN ${complianceHistory.isCompliant} = false THEN 1 ELSE 0 END)`.as('nonCompliant'),
        total: sql<number>`COUNT(*)`.as('total'),
      })
      .from(complianceHistory)
      .groupBy(sql`DATE(${complianceHistory.recordedAt})`)
      .orderBy(sql`DATE(${complianceHistory.recordedAt}) ASC`)
      .limit(30); // Last 30 days

    // Calculate compliance rate for each day
    const formattedHistory = history.map((day) => ({
      date: day.date,
      compliant: Number(day.compliant),
      nonCompliant: Number(day.nonCompliant),
      complianceRate: day.total > 0 ? (Number(day.compliant) / Number(day.total)) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      history: formattedHistory,
    });
  } catch (error) {
    console.error('Failed to fetch compliance history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance history' },
      { status: 500 }
    );
  }
}
