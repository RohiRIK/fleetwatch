import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { getUsers, getUser } from '@/lib/graph/client';

/**
 * User Sync Service
 * 
 * Syncs Azure AD users to local database
 * Enriches user data with department, job title, etc.
 */

export interface UserSyncResult {
  success: boolean;
  usersProcessed: number;
  usersCreated: number;
  usersUpdated: number;
  usersFailed: number;
  errors: Array<{ userId: string; error: string }>;
  durationMs: number;
}

/**
 * Sync all users from Azure AD to local database
 * 
 * @returns Sync result summary
 */
export async function syncUsers(): Promise<UserSyncResult> {
  const startTime = Date.now();
  const result: UserSyncResult = {
    success: true,
    usersProcessed: 0,
    usersCreated: 0,
    usersUpdated: 0,
    usersFailed: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    console.log('[UserSync] Starting user sync...');

    // Fetch all users from Azure AD
    const azureUsers = await getUsers({
      top: 999,
      select: [
        'id',
        'userPrincipalName',
        'displayName',
        'mail',
        'givenName',
        'surname',
        'jobTitle',
        'department',
        'officeLocation',
        'mobilePhone',
        'businessPhones',
      ],
    });

    console.log(`[UserSync] Found ${azureUsers.length} users in Azure AD`);

    // Process users in batches
    const BATCH_SIZE = 20;
    const batches = [];
    
    for (let i = 0; i < azureUsers.length; i += BATCH_SIZE) {
      batches.push(azureUsers.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const promises = batch.map((azureUser) =>
        syncSingleUser(azureUser)
          .then((syncResult) => {
            result.usersProcessed++;
            if (syncResult.created) result.usersCreated++;
            if (syncResult.updated) result.usersUpdated++;
          })
          .catch((error) => {
            result.usersFailed++;
            result.errors.push({
              userId: azureUser.id || 'unknown',
              error: error.message,
            });
            console.error(`[UserSync] Failed to sync user ${azureUser.userPrincipalName}:`, error);
          })
      );

      await Promise.all(promises);

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    result.durationMs = Date.now() - startTime;
    console.log(
      `[UserSync] Completed sync in ${result.durationMs}ms. ` +
      `Processed: ${result.usersProcessed}, Created: ${result.usersCreated}, ` +
      `Updated: ${result.usersUpdated}, Failed: ${result.usersFailed}`
    );

    return result;
  } catch (error: any) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    console.error('[UserSync] Sync failed:', error);
    throw error;
  }
}

/**
 * Sync a single user from Azure AD to database
 * 
 * @param azureUser Raw user object from Azure AD
 * @returns Object indicating if user was created or updated
 */
async function syncSingleUser(
  azureUser: any
): Promise<{ created: boolean; updated: boolean }> {
  const azureId = azureUser.id;
  const email = azureUser.mail || azureUser.userPrincipalName;

  // Check if user exists by Azure ID
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.azureId, azureId))
    .limit(1);

  const existingUser = existingUsers[0];
  const isNewUser = !existingUser;

  // Transform Azure AD user data to database format
  const userData = {
    azureId,
    email: email.toLowerCase(),
    name: azureUser.displayName || azureUser.userPrincipalName || 'Unknown User',
    displayName: azureUser.displayName || null,
    jobTitle: azureUser.jobTitle || null,
    department: azureUser.department || null,
    updatedAt: new Date(),
  };

  if (isNewUser) {
    // Insert new user
    await db.insert(users).values({
      ...userData,
      createdAt: new Date(),
    });
    console.log(`[UserSync] Created user: ${userData.name} (${email})`);
    return { created: true, updated: false };
  } else {
    // Update existing user
    await db
      .update(users)
      .set(userData)
      .where(eq(users.azureId, azureId));

    console.log(`[UserSync] Updated user: ${userData.name} (${email})`);
    return { created: false, updated: true };
  }
}

/**
 * Sync a single user by Azure ID
 * 
 * @param azureId Azure AD user ID
 * @returns Success status
 */
export async function syncUserById(azureId: string): Promise<boolean> {
  try {
    console.log(`[UserSync] Syncing single user: ${azureId}`);
    
    const azureUser = await getUser(azureId);
    await syncSingleUser(azureUser);
    
    console.log(`[UserSync] Successfully synced user ${azureId}`);
    return true;
  } catch (error) {
    console.error(`[UserSync] Failed to sync user ${azureId}:`, error);
    return false;
  }
}
