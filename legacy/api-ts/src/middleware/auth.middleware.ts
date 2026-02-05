import type { Request, Response, NextFunction } from 'express';
import { configCache } from '../utils/config-cache';

export interface AuthConfig {
  ingestSecret?: string;
  adminToken?: string;
  requireAuth: boolean;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig) {
  const { requireAuth } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip auth if not required (dev mode)
    if (!requireAuth) {
      return next();
    }

    // Helper to validate token against current cache
    const validate = (): boolean => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      const currentIngestSecret = configCache.get('INGEST_SECRET');
      const currentAdminToken = configCache.get('ADMIN_TOKEN');

      return !!(token && (
        (currentIngestSecret && token === currentIngestSecret) ||
        (currentAdminToken && token === currentAdminToken)
      ));
    };

    // 1. First attempt with current cache
    if (validate()) {
      return next();
    }

    // 2. Lazy Fallback: If failed, force a disk reload and try one last time
    // This handles cases where the file watcher might have missed an event
    await configCache.forceReload();

    if (validate()) {
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  };
}

/**
 * Combined middleware that allows either token-based auth OR session-based auth
 */
export function createCombinedAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check for token-based auth (Fetcher)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      const validate = (): boolean => {
        const currentIngestSecret = configCache.get('INGEST_SECRET');
        const currentAdminToken = configCache.get('ADMIN_TOKEN');

        return !!((currentIngestSecret && token === currentIngestSecret) ||
               (currentAdminToken && token === currentAdminToken));
      };

      // Try cache first
      let isValid = validate();

      // Lazy Fallback if cache failed
      if (!isValid) {
        await configCache.forceReload();
        isValid = validate();
      }
      
      if (isValid) {
        // Mock a user object for token-based requests so downstream logic works
        req.user = {
          id: 'system-fetcher',
          email: 'fetcher@system.local',
          roles: ['admin', 'fetcher'],
          displayName: 'System Fetcher',
          upn: 'fetcher@system.local',
          tenantId: 'system-local'
        };
        req.isAuthenticated = true;
        return next();
      }
    }

    // 2. Check for session-based auth (UI User)
    if (req.isAuthenticated) {
      return next();
    }

    // 3. Neither worked
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid token or active session required'
    });
  };
}

/**
 * Middleware for ingest-only endpoints (more restrictive)
 */
export function createIngestAuthMiddleware(ingestSecret?: string, requireAuth: boolean = true, adminToken?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip auth if not required (dev mode)
    if (!requireAuth) {
      return next();
    }

    const validate = (): boolean => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      const currentIngestSecret = configCache.get('INGEST_SECRET') || ingestSecret;
      const currentAdminToken = configCache.get('ADMIN_TOKEN') || adminToken;

      return !!(token && (
        (currentIngestSecret && token === currentIngestSecret) ||
        (currentAdminToken && token === currentAdminToken)
      ));
    };

    if (validate()) {
      return next();
    }

    // Lazy Fallback
    await configCache.forceReload();

    if (validate()) {
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid ingest token'
    });
  };
}
