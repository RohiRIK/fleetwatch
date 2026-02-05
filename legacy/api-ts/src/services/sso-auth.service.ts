/**
 * SSO Authentication Service
 *
 * Handles Microsoft Entra ID OAuth2 flow:
 * - Authorization URL generation
 * - Code exchange for tokens
 * - Token validation
 * - User info extraction
 */

import { oauthStateManager } from './oauth-state.service';

interface SSOConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  id_token?: string;
}

interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  upn: string;
  tenantId: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
}

export class SSOAuthService {
  private config: SSOConfig;
  private readonly AUTH_BASE = 'https://login.microsoftonline.com';
  private readonly GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

  constructor() {
    this.config = {
      clientId: process.env.SSO_CLIENT_ID || '',
      clientSecret: process.env.SSO_CLIENT_SECRET || '',
      tenantId: process.env.SSO_TENANT_ID || '',
      redirectUri: process.env.SSO_REDIRECT_URI || '',
    };

    if (!this.config.clientId || !this.config.tenantId) {
      console.warn('[SSOAuth] SSO configuration incomplete - SSO will be disabled');
    } else {
      console.log('[SSOAuth] SSO configured for tenant:', this.config.tenantId);
    }
  }

  /**
   * Check if SSO is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.tenantId &&
      this.config.redirectUri
    );
  }

  /**
   * Generate authorization URL
   */
  getAuthorizationUrl(returnUrl?: string): string {
    const state = oauthStateManager.generateState({ returnUrl });

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      response_mode: 'query',
      scope: 'openid profile email User.Read',
      state,
      prompt: 'select_account', // Always show account picker
    });

    return `${this.AUTH_BASE}/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const tokenUrl = `${this.AUTH_BASE}/${this.config.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'openid profile email User.Read',
      code,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SSOAuth] Token exchange failed:', response.status, error);
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = `${this.AUTH_BASE}/${this.config.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'openid profile email User.Read',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SSOAuth] Token refresh failed:', response.status, error);
      throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  /**
   * Get user info from Microsoft Graph
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(`${this.GRAPH_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SSOAuth] Failed to get user info:', response.status, error);
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = (await response.json()) as any;

    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      displayName: data.displayName,
      upn: data.userPrincipalName,
      tenantId: this.config.tenantId,
      givenName: data.givenName,
      surname: data.surname,
      jobTitle: data.jobTitle,
      department: data.department,
    };
  }

  /**
   * Validate state parameter (CSRF protection)
   */
  validateState(state: string): { returnUrl?: string } | null {
    return oauthStateManager.consumeState(state);
  }

  /**
   * Decode ID token to get claims (without verification - for display only)
   */
  decodeIdToken(idToken: string): Record<string, any> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  }

  /**
   * Get logout URL for Microsoft
   */
  getLogoutUrl(postLogoutRedirectUri?: string): string {
    const params = new URLSearchParams();
    if (postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    const queryString = params.toString();
    const baseUrl = `${this.AUTH_BASE}/${this.config.tenantId}/oauth2/v2.0/logout`;
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}

// Export singleton instance
export const ssoAuthService = new SSOAuthService();
