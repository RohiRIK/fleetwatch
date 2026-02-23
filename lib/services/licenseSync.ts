/**
 * License Sync Service
 * 
 * Syncs user license assignments from Microsoft Graph API to local database
 * Issue #60: Add License Sync Service for user_licenses table
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, user_licenses } from '@/lib/db/schema';
import { getUserLicenseDetails } from '@/lib/graph/client';

/**
 * Sync licenses for a single user
 * 
 * Fetches license details from Graph API and updates the user_licenses table.
 * 
 * @param azureId Azure AD user ID
 * @param userId Internal user ID (UUID)
 */
export async function syncUserLicenses(azureId: string, userId: string): Promise<void> {
  try {
    const response = await getUserLicenseDetails(azureId);
    
    const licenseDetails = Array.isArray(response) ? response : [];
    
    if (licenseDetails.length === 0) {
      await db
        .delete(user_licenses)
        .where(eq(user_licenses.userId, userId));
      
      console.log(`[LicenseSync] Cleared licenses for user ${userId} (no licenses)`);
      return;
    }

    for (const license of licenseDetails) {
      try {
        await db
          .insert(user_licenses)
          .values({
            userId,
            skuId: license.skuId,
            skuPartNumber: license.skuPartNumber,
            skuName: license.skuDescription || null,
            capabilityStatus: license.capabilityStatus?.toLowerCase() || 'enabled',
            servicePlans: license.servicePlans || null,
            prepaidUnitsEnabled: license.prepaidUnits?.enabled || null,
            prepaidUnitsSuspended: license.prepaidUnits?.suspended || null,
            prepaidUnitsWarning: license.prepaidUnits?.warning || null,
            consumedUnits: license.consumedUnits || null,
            assignedAt: license.assignedOn ? new Date(license.assignedOn) : null,
          })
          .onConflictDoUpdate({
            target: [user_licenses.userId, user_licenses.skuId],
            set: {
              skuName: license.skuDescription || null,
              capabilityStatus: license.capabilityStatus?.toLowerCase() || 'enabled',
              servicePlans: license.servicePlans || null,
              prepaidUnitsEnabled: license.prepaidUnits?.enabled || null,
              prepaidUnitsSuspended: license.prepaidUnits?.suspended || null,
              prepaidUnitsWarning: license.prepaidUnits?.warning || null,
              consumedUnits: license.consumedUnits || null,
              assignedAt: license.assignedOn ? new Date(license.assignedOn) : null,
              updatedAt: new Date(),
            },
          });
      } catch (insertError) {
        console.error(`[LicenseSync] Failed to insert license ${license.skuId} for user ${userId}:`, insertError);
      }
    }

    console.log(`[LicenseSync] Synced ${licenseDetails.length} licenses for user ${userId}`);
  } catch (error) {
    console.error(`[LicenseSync] Failed to sync licenses for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Sync licenses for all users in the database
 * 
 * @returns Number of users processed
 */
export async function syncAllUserLicenses(): Promise<number> {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        azureId: users.azureId,
      })
      .from(users)
      .limit(1000);

    console.log(`[LicenseSync] Starting license sync for ${allUsers.length} users`);

    let processed = 0;
    let failed = 0;

    for (const user of allUsers) {
      if (!user.azureId) {
        console.log(`[LicenseSync] Skipping user ${user.id} - no Azure ID`);
        continue;
      }

      try {
        await syncUserLicenses(user.azureId, user.id);
        processed++;
      } catch (error) {
        failed++;
        console.error(`[LicenseSync] Failed to sync licenses for user ${user.id}:`, error);
      }
    }

    console.log(`[LicenseSync] License sync complete. Processed: ${processed}, Failed: ${failed}`);
    return processed;
  } catch (error) {
    console.error('[LicenseSync] Failed to sync all user licenses:', error);
    throw error;
  }
}
