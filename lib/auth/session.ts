import { auth } from './config';
import { cache } from 'react';

/**
 * Get the current session (cached for React Server Components)
 * Returns null if no session exists
 */
export const getSession = cache(async () => {
  return await auth();
});

/**
 * Require authentication - throws if no session
 * Use this in Server Actions and API routes
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session?.user) {
    throw new Error('Unauthorized: You must be logged in to access this resource');
  }
  
  return session;
}

/**
 * Get current user ID from session
 * Returns null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id || null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}
