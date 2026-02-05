/**
 * Authentication Routes
 *
 * Handles Microsoft Entra ID SSO flow:
 * - GET /auth/microsoft - Initiate login
 * - GET /auth/microsoft/callback - OAuth callback
 * - GET /auth/me - Get current user
 * - POST /auth/logout - Logout
 * - GET /auth/status - Check auth status
 */

import { Router, type Request, type Response } from 'express';
import { ssoAuthService } from '../services/sso-auth.service';
import { redisSessionService } from '../services/redis-session.service';
import { platformUserService } from '../services/platform-user.service';
import { localUserService } from '../services/local-user.service';
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/session-auth.middleware';

export function createAuthRoutes(): Router {
  const router = Router();

  /**
   * @swagger
   * /api/auth/microsoft:
   *   get:
   *     tags: [Authentication]
   *     summary: Initiate Microsoft SSO login
   *     description: Redirects user to Microsoft login page
   *     parameters:
   *       - name: returnUrl
   *         in: query
   *         schema:
   *           type: string
   *         description: URL to redirect after login
   *     responses:
   *       302:
   *         description: Redirect to Microsoft login
   *       503:
   *         description: SSO not configured
   */
  router.get('/microsoft', (req: Request, res: Response) => {
    if (!ssoAuthService.isConfigured()) {
      return res.status(503).json({
        error: 'SSO Not Configured',
        message: 'Microsoft SSO is not configured on this server',
      });
    }

    const returnUrl = req.query.returnUrl as string | undefined;
    const authUrl = ssoAuthService.getAuthorizationUrl(returnUrl);

    console.log('[Auth] Initiating SSO login, redirecting to Microsoft');
    res.redirect(authUrl);
  });

  /**
   * @swagger
   * /api/auth/microsoft/callback:
   *   get:
   *     tags: [Authentication]
   *     summary: OAuth callback handler
   *     description: Handles the callback from Microsoft after authentication
   *     parameters:
   *       - name: code
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code from Microsoft
   *       - name: state
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: State parameter for CSRF protection
   *       - name: error
   *         in: query
   *         schema:
   *           type: string
   *         description: Error code if authentication failed
   *       - name: error_description
   *         in: query
   *         schema:
   *           type: string
   *         description: Error description
   *     responses:
   *       302:
   *         description: Redirect to dashboard or login with error
   */
  router.get('/microsoft/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors from Microsoft
      if (error) {
        console.error('[Auth] OAuth error from Microsoft:', error, error_description);
        return res.redirect(
          `/login?error=${encodeURIComponent(String(error_description || error))}`
        );
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('[Auth] Missing code or state in callback');
        return res.redirect('/login?error=missing_params');
      }

      // Validate state (CSRF protection)
      const stateData = ssoAuthService.validateState(String(state));
      if (!stateData) {
        console.error('[Auth] Invalid or expired state parameter');
        return res.redirect('/login?error=invalid_state');
      }

      // Exchange code for tokens
      console.log('[Auth] Exchanging authorization code for tokens');
      const tokens = await ssoAuthService.exchangeCodeForTokens(String(code));

      // Get user info from Microsoft Graph
      console.log('[Auth] Fetching user info from Microsoft Graph');
      const userInfo = await ssoAuthService.getUserInfo(tokens.access_token);

      // Sync user to platform users index
      await platformUserService.syncSSOUser({
        id: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.displayName,
        upn: userInfo.upn,
        tenantId: userInfo.tenantId,
      });

      // Get user from platform index to get their roles/status
      const platformUser = await platformUserService.getUserById(userInfo.id);

      // Create session in Redis
      console.log('[Auth] Creating session for user:', userInfo.email);
      const sessionId = await redisSessionService.createSession(
        {
          id: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.displayName,
          upn: userInfo.upn,
          tenantId: userInfo.tenantId,
          roles: platformUser?.role ? [platformUser.role] : ['viewer'],
        },
        tokens.access_token,
        tokens.refresh_token,
        Date.now() + tokens.expires_in * 1000
      );

      // Set session cookie
      setSessionCookie(res, sessionId);

      // Redirect to return URL or dashboard
      const returnUrl = stateData.returnUrl || '/dashboard';
      console.log('[Auth] Login successful, redirecting to:', returnUrl);
      res.redirect(returnUrl);
    } catch (error) {
      console.error('[Auth] Callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      res.redirect(
        `/login?error=${encodeURIComponent(errorMessage)}`
      );
    }
  });

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     tags: [Authentication]
   *     summary: Get current authenticated user
   *     description: Returns information about the currently logged-in user
   *     responses:
   *       200:
   *         description: Current user info
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       type: object
   *                     session:
   *                       type: object
   *       401:
   *         description: Not authenticated
   */
  router.get('/me', requireAuth(), (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        user: req.user,
        session: {
          createdAt: req.session?.createdAt,
          lastAccessed: req.session?.lastAccessed,
        },
      },
    });
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     tags: [Authentication]
   *     summary: Logout and clear session
   *     description: Clears the user session and redirects to login
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  router.post('/logout', async (req: Request, res: Response) => {
    if (req.session) {
      console.log('[Auth] Logging out user:', req.user?.email);
      await redisSessionService.deleteSession(req.session.id);
    }

    clearSessionCookie(res);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  /**
   * @swagger
   * /api/auth/status:
   *   get:
   *     tags: [Authentication]
   *     summary: Check authentication status
   *     description: Returns current authentication status without requiring auth
   *     responses:
   *       200:
   *         description: Auth status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     authenticated:
   *                       type: boolean
   *                     user:
   *                       type: object
   *                     ssoConfigured:
   *                       type: boolean
   */
  router.get('/status', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        authenticated: req.isAuthenticated || false,
        user: req.user || null,
        ssoConfigured: ssoAuthService.isConfigured(),
        localAuthEnabled: localUserService.isEnabled(),
      },
    });
  });

  // ============================================
  // Local Authentication Routes
  // ============================================

  /**
   * @swagger
   * /api/auth/local/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Login with local credentials
   *     description: Authenticates a user with email and password
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   *       503:
   *         description: Local auth not available
   */
  router.post('/local/login', async (req: Request, res: Response) => {
    try {
      if (!localUserService.isEnabled()) {
        return res.status(503).json({
          error: 'Local authentication is not enabled',
        });
      }

      if (!localUserService.isAvailable()) {
        return res.status(503).json({
          error: 'Local authentication service unavailable',
        });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
        });
      }

      // Validate credentials
      const result = await localUserService.validateCredentials(email, password);

      if (!result.success || !result.user) {
        return res.status(401).json({
          error: result.error || 'Invalid credentials',
        });
      }

      // Create session
      const sessionId = await redisSessionService.createSession(
        {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
          upn: result.user.email, // Use email as UPN for local users
          tenantId: 'local', // Special tenant ID for local users
          roles: [result.user.role],
        },
        'local-auth', // No access token for local users
        undefined, // No refresh token
        Date.now() + 86400000 // 24 hours
      );

      // Set session cookie
      setSessionCookie(res, sessionId);

      console.log(`[Auth] Local login successful for ${result.user.email}`);

      res.json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName: result.user.displayName,
            role: result.user.role,
          },
        },
      });
    } catch (error: any) {
      console.error('[Auth] Local login error:', error.message);
      res.status(500).json({
        error: 'Login failed',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/auth/local/users:
   *   get:
   *     tags: [Authentication]
   *     summary: List all local users (admin only)
   *     responses:
   *       200:
   *         description: List of users
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Not authorized
   */
  router.get('/local/users', requireAuth(), async (req: Request, res: Response) => {
    try {
      // Check if user is admin
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({
          error: 'Admin access required',
        });
      }

      const users = await localUserService.listUsers();

      res.json({
        success: true,
        data: { users },
      });
    } catch (error: any) {
      console.error('[Auth] List users error:', error.message);
      res.status(500).json({
        error: 'Failed to list users',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/auth/local/users:
   *   post:
   *     tags: [Authentication]
   *     summary: Create a local user (admin only)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - displayName
   *               - role
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               displayName:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, viewer]
   *     responses:
   *       201:
   *         description: User created
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Not authorized
   */
  router.post('/local/users', requireAuth(), async (req: Request, res: Response) => {
    try {
      // Check if user is admin
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({
          error: 'Admin access required',
        });
      }

      const { email, password, displayName, role } = req.body;

      // Validate required fields
      if (!email || !password || !displayName || !role) {
        return res.status(400).json({
          error: 'Email, password, displayName, and role are required',
        });
      }

      // Validate role
      if (!['admin', 'viewer'].includes(role)) {
        return res.status(400).json({
          error: 'Role must be "admin" or "viewer"',
        });
      }

      // Validate password
      const passwordValidation = localUserService.validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Invalid password',
          details: passwordValidation.errors,
        });
      }

      const user = await localUserService.createUser({
        email,
        password,
        displayName,
        role,
      });

      console.log(`[Auth] Local user created: ${user.email} by ${req.user?.email}`);

      res.status(201).json({
        success: true,
        data: { user },
      });
    } catch (error: any) {
      console.error('[Auth] Create user error:', error.message);
      res.status(500).json({
        error: 'Failed to create user',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/auth/local/users/{id}:
   *   delete:
   *     tags: [Authentication]
   *     summary: Delete a local user (admin only)
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User deleted
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Not authorized
   */
  router.delete('/local/users/:id', requireAuth(), async (req: Request, res: Response) => {
    try {
      // Check if user is admin
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({
          error: 'Admin access required',
        });
      }

      const { id } = req.params;

      // Prevent self-deletion
      if (id === req.user?.id) {
        return res.status(400).json({
          error: 'Cannot delete your own account',
        });
      }

      await localUserService.deleteUser(id);

      console.log(`[Auth] Local user deleted: ${id} by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'User deleted',
      });
    } catch (error: any) {
      console.error('[Auth] Delete user error:', error.message);
      res.status(500).json({
        error: 'Failed to delete user',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/auth/local/users/{id}:
   *   patch:
   *     tags: [Authentication]
   *     summary: Update a local user (admin only)
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               displayName:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, viewer]
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: User updated
   *       401:
   *         description: Not authenticated
   *       403:
   *         description: Not authorized
   */
  router.patch('/local/users/:id', requireAuth(), async (req: Request, res: Response) => {
    try {
      // Check if user is admin
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({
          error: 'Admin access required',
        });
      }

      const { id } = req.params;
      const { displayName, role, isActive } = req.body;

      // Validate role if provided
      if (role && !['admin', 'viewer'].includes(role)) {
        return res.status(400).json({
          error: 'Role must be "admin" or "viewer"',
        });
      }

      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;

      const user = await localUserService.updateUser(id, updates);

      console.log(`[Auth] Local user updated: ${id} by ${req.user?.email}`);

      res.json({
        success: true,
        data: { user },
      });
    } catch (error: any) {
      console.error('[Auth] Update user error:', error.message);
      res.status(500).json({
        error: 'Failed to update user',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /api/auth/local/change-password:
   *   post:
   *     tags: [Authentication]
   *     summary: Change own password
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *     responses:
   *       200:
   *         description: Password changed
   *       400:
   *         description: Invalid password
   *       401:
   *         description: Not authenticated or wrong current password
   */
  router.post('/local/change-password', requireAuth(), async (req: Request, res: Response) => {
    try {
      // Only for local users
      if (req.user?.tenantId !== 'local') {
        return res.status(400).json({
          error: 'Password change is only available for local users',
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required',
        });
      }

      // Verify current password
      const validation = await localUserService.validateCredentials(
        req.user?.email || '',
        currentPassword
      );

      if (!validation.success) {
        return res.status(401).json({
          error: 'Current password is incorrect',
        });
      }

      // Validate new password
      const passwordValidation = localUserService.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Invalid new password',
          details: passwordValidation.errors,
        });
      }

      // Update password
      await localUserService.updatePassword(req.user?.id || '', newPassword);

      console.log(`[Auth] Password changed for ${req.user?.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      console.error('[Auth] Change password error:', error.message);
      res.status(500).json({
        error: 'Failed to change password',
        message: error.message,
      });
    }
  });

  return router;
}
