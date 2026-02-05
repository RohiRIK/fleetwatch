/**
 * Session Authentication Middleware
 *
 * Validates session cookies and attaches user to request.
 * Supports both session-based and token-based auth for backward compatibility.
 */

import type { Request, Response, NextFunction } from 'express';
import { redisSessionService, type Session, type SessionUser } from '../services/redis-session.service';
import { configCache } from '../utils/config-cache';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      user?: SessionUser;
      isAuthenticated?: boolean;
    }
  }
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'device_inventory_session';

/**
 * Session middleware - attaches session to request if valid
 * Also checks for Bearer token (ADMIN_TOKEN) for API access
 */
export function sessionMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check for Bearer token first (API/Dev access)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const adminToken = configCache.get('ADMIN_TOKEN') || process.env.ADMIN_TOKEN;
      
      if (token && adminToken && token === adminToken) {
        req.isAuthenticated = true;
        // Mock admin user
        req.user = {
          id: 'admin-token-user',
          email: 'admin@system.local',
          displayName: 'Admin (Token)',
          upn: 'admin@system.local',
          tenantId: 'system',
          roles: ['admin']
        };
        return next();
      }
    }

    // 2. Check for Session Cookie
    const sessionId = req.cookies?.[COOKIE_NAME];

    if (!sessionId) {
      req.isAuthenticated = false;
      return next();
    }

    try {
      const session = await redisSessionService.getSession(sessionId);

      if (!session) {
        // Clear invalid cookie
        res.clearCookie(COOKIE_NAME);
        req.isAuthenticated = false;
        return next();
      }

      // Check token expiry
      if (Date.now() > session.tokenExpiry) {
        // Token expired - clear session
        await redisSessionService.deleteSession(sessionId);
        res.clearCookie(COOKIE_NAME);
        req.isAuthenticated = false;
        return next();
      }

      req.session = session;
      req.user = session.user;
      req.isAuthenticated = true;
      next();
    } catch (error) {
      console.error('[SessionAuth] Error validating session:', error);
      req.isAuthenticated = false;
      next();
    }
  };
}

/**
 * Require authentication middleware
 * Returns 401 if not authenticated
 */
export function requireAuth(role?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        loginUrl: '/api/auth/microsoft',
      });
    }

    if (role && !req.user?.roles?.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${role}`,
      });
    }

    next();
  };
}

/**
 * Optional auth middleware
 * Doesn't require auth but sets user if available
 */
export function optionalAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Session is already attached by sessionMiddleware
    next();
  };
}

/**
 * Set session cookie helper
 */
export function setSessionCookie(res: Response, sessionId: string): void {
  const maxAge = parseInt(process.env.SESSION_MAX_AGE || '86400000');
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

/**
 * Clear session cookie helper
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
