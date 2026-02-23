/**
 * Recommendation Generator Service
 * 
 * Batch generation of recommendations for all devices.
 * Issue #58: Intelligent Recommendation Engine for Fleet Health Analytics
 */

import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { devices, device_analytics, users, fleetRecommendations, type FleetRecommendation, type NewFleetRecommendation } from '@/lib/db/schema';
import { allRules, calculatePriorityScore, type Severity, type Category } from './recommendationEngine';

export interface GenerateOptions {
  severity?: Severity[];
  category?: Category[];
  deviceIds?: string[];
  userIds?: string[];
  dryRun?: boolean;
}

export interface GenerateResult {
  generated: number;
  errors: number;
  recommendations: NewFleetRecommendation[];
}

export async function generateRecommendationsForDevice(deviceId: string): Promise<NewFleetRecommendation[]> {
  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  });

  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const analytics = await db.query.device_analytics.findFirst({
    where: eq(device_analytics.deviceId, deviceId),
  });

  const user = device.userId 
    ? await db.query.users.findFirst({
        where: eq(users.id, device.userId),
      })
    : null;

  const recommendations: NewFleetRecommendation[] = [];

  for (const rule of allRules) {
    try {
      if (rule.evaluate(device as typeof devices.$inferSelect, analytics as typeof device_analytics.$inferSelect, user as typeof users.$inferSelect)) {
        const priorityScore = calculatePriorityScore(rule.severity);

        recommendations.push({
          deviceId: device.id,
          userId: device.userId || null,
          severity: rule.severity,
          category: rule.category,
          status: 'active',
          title: rule.getTitle(device as typeof devices.$inferSelect, analytics as typeof device_analytics.$inferSelect, user as typeof users.$inferSelect),
          description: rule.getDescription(device as typeof devices.$inferSelect, analytics as typeof device_analytics.$inferSelect, user as typeof users.$inferSelect),
          recommendationType: rule.name,
          ruleId: rule.id,
          actionUrl: `/devices/${device.id}`,
          actionLabel: 'View Device',
          deviceName: device.deviceName,
          deviceSerialNumber: device.serialNumber || null,
          userEmail: device.userEmail || null,
          priorityScore,
          acknowledgedAt: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id} for device ${deviceId}:`, error);
    }
  }

  return recommendations;
}

export async function generateAllRecommendations(options: GenerateOptions = {}): Promise<GenerateResult> {
  const { severity, category, deviceIds, userIds, dryRun = false } = options;

  let deviceQuery = db.select().from(devices);

  if (deviceIds && deviceIds.length > 0) {
    deviceQuery = deviceQuery.where(sql`${devices.id} IN ${deviceIds}`) as typeof deviceQuery;
  }

  const allDevices = await deviceQuery;
  const recommendations: NewFleetRecommendation[] = [];
  let errors = 0;

  for (const device of allDevices) {
    try {
      const deviceRecs = await generateRecommendationsForDevice(device.id);
      recommendations.push(...deviceRecs);
    } catch (error) {
      console.error(`Error generating recommendations for device ${device.id}:`, error);
      errors++;
    }
  }

  if (!dryRun && recommendations.length > 0) {
    await db.insert(fleetRecommendations).values(recommendations).onConflictDoNothing();
  }

  return {
    generated: recommendations.length,
    errors,
    recommendations,
  };
}

export async function getRecommendations(filters: {
  severity?: Severity[];
  category?: Category[];
  status?: string[];
  deviceId?: string;
  limit?: number;
  offset?: number;
}) {
  const { severity, category, status, deviceId, limit = 50, offset = 0 } = filters;

  let query = db.select().from(fleetRecommendations);

  const conditions = [];

  if (severity && severity.length > 0) {
    conditions.push(sql`${fleetRecommendations.severity} IN ${severity}`);
  }

  if (category && category.length > 0) {
    conditions.push(sql`${fleetRecommendations.category} IN ${category}`);
  }

  if (status && status.length > 0) {
    conditions.push(sql`${fleetRecommendations.status} IN ${status}`);
  }

  if (deviceId) {
    conditions.push(eq(fleetRecommendations.deviceId, deviceId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query
    .orderBy(desc(fleetRecommendations.priorityScore), desc(fleetRecommendations.createdAt))
    .limit(limit)
    .offset(offset);

  const countQuery = db.select({ count: sql`count(*)`.mapWith(Number) }).from(fleetRecommendations);
  const total = await (conditions.length > 0 
    ? countQuery.where(and(...conditions)) as Promise<{ count: number }[]>
    : countQuery
  );

  return {
    recommendations: results,
    total: total[0]?.count || 0,
  };
}

export async function acknowledgeRecommendation(id: string) {
  await db.update(fleetRecommendations)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fleetRecommendations.id, id));
}

export async function resolveRecommendation(id: string) {
  await db.update(fleetRecommendations)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fleetRecommendations.id, id));
}

export async function dismissRecommendation(id: string) {
  await db.update(fleetRecommendations)
    .set({
      status: 'dismissed',
      updatedAt: new Date(),
    })
    .where(eq(fleetRecommendations.id, id));
}

export async function getRecommendationStats() {
  const bySeverity = await db
    .select({
      severity: fleetRecommendations.severity,
      count: sql`count(*)`.mapWith(Number),
    })
    .from(fleetRecommendations)
    .where(eq(fleetRecommendations.status, 'active'))
    .groupBy(fleetRecommendations.severity);

  const byCategory = await db
    .select({
      category: fleetRecommendations.category,
      count: sql`count(*)`.mapWith(Number),
    })
    .from(fleetRecommendations)
    .where(eq(fleetRecommendations.status, 'active'))
    .groupBy(fleetRecommendations.category);

  const total = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(fleetRecommendations)
    .where(eq(fleetRecommendations.status, 'active'));

  return {
    bySeverity: bySeverity.reduce((acc, item) => {
      acc[item.severity] = item.count;
      return acc;
    }, {} as Record<string, number>),
    byCategory: byCategory.reduce((acc, item) => {
      acc[item.category] = item.count;
      return acc;
    }, {} as Record<string, number>),
    total: total[0]?.count || 0,
  };
}
