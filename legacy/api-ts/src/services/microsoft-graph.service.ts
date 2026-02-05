/**
 * Microsoft Graph API Client Service
 *
 * Handles interactions with Microsoft Graph API for:
 * - OAuth token exchange
 * - App registration creation
 * - Permission grants
 * - Certificate uploads
 * - Certificate-based authentication validation
 */

import crypto from 'crypto';
import forge from 'node-forge';
import { envManager } from './env-manager.service';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

interface AppRegistrationResponse {
  id: string; // Object ID
  appId: string; // Client ID (Application ID)
  displayName: string;
  signInAudience: string;
  createdDateTime: string;
}

interface ServicePrincipalResponse {
  id: string;
  appId: string;
  displayName: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

interface DeviceCodePollResponse {
  status: 'pending' | 'completed' | 'error';
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export class MicrosoftGraphClient {
  private readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private readonly AUTH_BASE = 'https://login.microsoftonline.com';
  // Well-known client ID for Microsoft Graph PowerShell (public client)
  private readonly GRAPH_POWERSHELL_CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';

  /**
   * Get app-only access token using managed certificate credentials
   * (Automatically retrieves certs from envManager)
   */
  async getAppOnlyToken(): Promise<{ access_token: string }> {
    const clientId = process.env.CLIENT_ID;
    const tenantId = process.env.TENANT_ID;

    if (!clientId || !tenantId) {
      throw new Error('CLIENT_ID or TENANT_ID not configured');
    }

    // Get certificate info
    const certInfo = await envManager.getCertificateInfo();
    if (!certInfo.hasCert) {
      throw new Error('Certificate not found - cannot get app-only token');
    }

    const accessToken = await this.getAppOnlyTokenWithCertificate(
      tenantId,
      clientId,
      certInfo.thumbprint!,
      certInfo.privateKeyPem!
    );

    return { access_token: accessToken };
  }

  /**
   * Initiate device code flow for setup purposes
   * Used for creating OAuth helper app
   */
  async initiateDeviceCodeFlow(scopes: string[] = []): Promise<DeviceCodeResponse> {
    const tokenUrl = `${this.AUTH_BASE}/organizations/oauth2/v2.0/devicecode`;

    const scopeString = scopes.length > 0
      ? scopes.join(' ')
      : 'Application.ReadWrite.All offline_access';

    const params = new URLSearchParams({
      client_id: this.GRAPH_POWERSHELL_CLIENT_ID,
      scope: scopeString
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Device code initiation failed: ${response.status} ${error}`);
    }

    return await response.json() as DeviceCodeResponse;
  }

  /**
   * Poll device code for token
   */
  async pollDeviceCodeForToken(deviceCode: string): Promise<DeviceCodePollResponse> {
    const tokenUrl = `${this.AUTH_BASE}/organizations/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.GRAPH_POWERSHELL_CLIENT_ID,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json() as any;

    if (!response.ok) {
      if (data.error === 'authorization_pending') {
        return { status: 'pending' };
      }

      return {
        status: 'error',
        error: data.error,
        error_description: data.error_description
      };
    }

    return {
      status: 'completed',
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      scope: data.scope
    };
  }

  /**
   * Create PUBLIC CLIENT app registration (for OAuth helper)
   */
  async createPublicClientApp(
    accessToken: string,
    displayName: string,
    redirectUri: string
  ): Promise<AppRegistrationResponse> {
    const url = `${this.GRAPH_API_BASE}/applications`;

    const appDefinition = {
      displayName,
      signInAudience: 'AzureADMyOrg',
      publicClient: {
        redirectUris: [redirectUri]
      },
      requiredResourceAccess: [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: [
            {
              id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
              type: 'Scope'
            },
            {
              id: '1bfefb4e-e0b5-418b-a88f-73c46d2cc8e9', // Application.ReadWrite.All (Delegated)
              type: 'Scope'
            },
            {
              id: '84bccea3-f856-4a8a-967b-dbe0a3d53a64', // AppRoleAssignment.ReadWrite.All (Delegated)
              type: 'Scope'
            },
            {
              id: '06da0dbc-49e2-44d2-8312-53f166ab848a', // Directory.Read.All (Delegated)
              type: 'Scope'
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appDefinition)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Public client app creation failed: ${response.status} ${error}`);
    }

    return await response.json() as AppRegistrationResponse;
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Redirect URI used in OAuth flow
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret (optional for public clients)
   * @returns Access token response
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<TokenResponse> {
    const tokenUrl = `${this.AUTH_BASE}/common/oauth2/v2.0/token`;

    // Use environment variables if not provided
    const effectiveClientId = clientId || process.env.OAUTH_HELPER_CLIENT_ID;
    const effectiveClientSecret = clientSecret || process.env.OAUTH_HELPER_CLIENT_SECRET;

    if (!effectiveClientId) {
      throw new Error('OAuth client ID not provided');
    }

    const params = new URLSearchParams({
      client_id: effectiveClientId,
      scope: 'https://graph.microsoft.com/.default offline_access',
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    // Add client_secret if available (confidential client)
    if (effectiveClientSecret) {
      params.append('client_secret', effectiveClientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    return await response.json() as TokenResponse;
  }

  /**
   * Create Azure App Registration
   *
   * @param accessToken - Access token with Application.ReadWrite.All permission
   * @param displayName - Display name for the app registration
   * @param tags - Tags to identify the app (for cleanup/management)
   * @returns App registration details
   */
  async createAppRegistration(
    accessToken: string,
    displayName: string = 'Device Inventory Data Collector',
    tags?: string[]
  ): Promise<AppRegistrationResponse> {
    const url = `${this.GRAPH_API_BASE}/applications`;

    const appDefinition: any = {
      displayName,
      signInAudience: 'AzureADMyOrg', // Single tenant
      requiredResourceAccess: [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: [
            // Device Management - Managed Devices
            {
              id: '2f51be20-0bb4-4fed-bf7b-db946066c75e', // DeviceManagementManagedDevices.Read.All
              type: 'Role'
            },
            // Device Management - Configuration
            {
              id: 'dc377aa6-52d8-4e23-b271-2a7ae04cedf3', // DeviceManagementConfiguration.Read.All
              type: 'Role'
            },
            // Device Management - Apps
            {
              id: '7a6ee1e7-141e-4cec-ae74-d9db155731ff', // DeviceManagementApps.Read.All
              type: 'Role'
            },
            // Device Management - Service Configuration (for policies, baselines, etc.)
            {
              id: '06a5fe6d-c49d-46a7-b082-56b1b14103c7', // DeviceManagementServiceConfig.Read.All
              type: 'Role'
            },
            // Device Management - RBAC (for device categories, role assignments)
            {
              id: '58ca0d9a-1575-47e1-a3cb-007ef2e4583b', // DeviceManagementRBAC.Read.All
              type: 'Role'
            },
            // Azure AD Devices
            {
              id: '7438b122-aefc-4978-80ed-43db9fcc7715', // Device.Read.All
              type: 'Role'
            },
            // Directory - Read (for organization info, domains, etc.)
            {
              id: '7ab1d382-f21e-4acd-a863-ba3e13f7da61', // Directory.Read.All
              type: 'Role'
            },
            // Users
            {
              id: 'df021288-bdef-4463-88db-98f22de89214', // User.Read.All
              type: 'Role'
            },
            // Groups (for device group memberships)
            {
              id: '5b567255-7703-4780-807c-7be8301ae99b', // Group.Read.All
              type: 'Role'
            },
            // Reports - Read (for device compliance reports, analytics)
            {
              id: '230c1aed-a721-4c5d-9cb4-a90514e508ef', // Reports.Read.All
              type: 'Role'
            },
            // Organization - Read (for license info, subscriptions)
            {
              id: '498476ce-e0fe-48b0-b801-37ba7e2685c6', // Organization.Read.All
              type: 'Role'
            },
            // Audit Logs - Read (for compliance, change tracking)
            {
              id: 'b0afded3-3588-46d8-8b3d-9842eff778da', // AuditLog.Read.All
              type: 'Role'
            },
            // Security Events - Read (for threat detection, security alerts)
            {
              id: 'bf394140-e372-4bf9-a898-299cfc7564e5', // SecurityEvents.Read.All
              type: 'Role'
            },
            // Threat Assessment - Read (for security baseline assessments)
            {
              id: 'f8f035bb-2cce-47fb-8bf5-7baf3ecbee48', // ThreatAssessment.Read.All
              type: 'Role'
            }
          ]
        }
      ],
      web: {
        redirectUris: [],
        implicitGrantSettings: {
          enableIdTokenIssuance: false,
          enableAccessTokenIssuance: false
        }
      }
    };

    // Add tags if provided (for identification and cleanup)
    if (tags && tags.length > 0) {
      appDefinition.tags = tags;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appDefinition)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`App registration creation failed: ${response.status} ${error}`);
    }

    return await response.json() as AppRegistrationResponse;
  }

  /**
   * Create Service Principal for the app
   *
   * @param accessToken - Access token
   * @param appId - Application (client) ID
   * @returns Service principal details
   */
  async createServicePrincipal(
    accessToken: string,
    appId: string
  ): Promise<ServicePrincipalResponse> {
    const url = `${this.GRAPH_API_BASE}/servicePrincipals`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Service principal creation failed: ${response.status} ${error}`);
    }

    return await response.json() as ServicePrincipalResponse;
  }

  /**
   * Grant admin consent for app permissions
   *
   * @param accessToken - Access token
   * @param servicePrincipalId - Service principal object ID
   * @param resourceId - Microsoft Graph service principal ID
   * @param permissionIds - Array of permission IDs to grant
   */
  async grantAdminConsent(
    accessToken: string,
    servicePrincipalId: string,
    resourceId: string,
    permissionIds: string[]
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const permissionId of permissionIds) {
      const url = `${this.GRAPH_API_BASE}/servicePrincipals/${servicePrincipalId}/appRoleAssignments`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            principalId: servicePrincipalId,
            resourceId: resourceId,
            appRoleId: permissionId
          })
        });

        if (response.ok) {
          succeeded.push(permissionId);
          console.log(`✓ Granted permission ${permissionId}`);
        } else {
          const error = await response.text();
          failed.push(permissionId);
          console.warn(`✗ Failed to grant permission ${permissionId}: ${error}`);
        }
      } catch (error: any) {
        failed.push(permissionId);
        console.warn(`✗ Error granting permission ${permissionId}: ${error.message}`);
      }
    }

    console.log(`[GrantAdminConsent] Results: ${succeeded.length} succeeded, ${failed.length} failed`);
    return { succeeded, failed };
  }

  /**
   * Upload certificate to app registration
   *
   * @param accessToken - Access token
   * @param appObjectId - App registration object ID
   * @param certificateBase64 - Base64-encoded DER certificate
   * @param thumbprint - SHA-1 thumbprint (uppercase hex)
   */
  async uploadCertificate(
    accessToken: string,
    appObjectId: string,
    certificateBase64: string,
    thumbprint: string
  ): Promise<void> {
    const url = `${this.GRAPH_API_BASE}/applications/${appObjectId}`;

    // Get current keyCredentials
    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!getResponse.ok) {
      throw new Error('Failed to get current app registration');
    }

    const currentApp = await getResponse.json() as any;
    const existingKeys = currentApp.keyCredentials || [];

    // Add new certificate
    const newKey = {
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
      key: certificateBase64,
      displayName: `Device Inventory Certificate (${new Date().toISOString().split('T')[0]})`,
      customKeyIdentifier: thumbprint
    };

    const updatedKeys = [...existingKeys, newKey];

    // Update app registration
    const patchResponse = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keyCredentials: updatedKeys
      })
    });

    if (!patchResponse.ok) {
      const error = await patchResponse.text();
      throw new Error(`Certificate upload failed: ${patchResponse.status} ${error}`);
    }
  }

  /**
   * Get Microsoft Graph service principal ID for permission grants
   *
   * @param accessToken - Access token
   * @returns Microsoft Graph service principal object ID
   */
  async getGraphServicePrincipalId(accessToken: string): Promise<string> {
    const url = `${this.GRAPH_API_BASE}/servicePrincipals?$filter=appId eq '00000003-0000-0000-c000-000000000000'`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get Microsoft Graph service principal');
    }

    const data = await response.json() as any;
    if (!data.value || data.value.length === 0) {
      throw new Error('Microsoft Graph service principal not found');
    }

    return data.value[0].id;
  }

  /**
   * Get tenant ID from access token
   *
   * @param accessToken - JWT access token
   * @returns Tenant ID
   */
  getTenantIdFromToken(accessToken: string): string {
    // Decode JWT (base64 decode middle part)
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    if (!payload.tid) {
      throw new Error('Token does not contain tenant ID');
    }

    return payload.tid;
  }

  /**
   * Get user email from access token
   *
   * @param accessToken - JWT access token
   * @returns User email or UPN
   */
  getUserEmailFromToken(accessToken: string): string {
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    return payload.upn || payload.email || payload.preferred_username || 'unknown';
  }

  /**
   * Create SSO App Registration (for user login)
   * Uses delegated permissions instead of application permissions
   *
   * @param accessToken - Access token with Application.ReadWrite.All permission
   * @param displayName - Display name for the app registration
   * @param redirectUri - OAuth callback URL
   * @param tags - Tags to identify the app (for cleanup/management)
   * @returns App registration details with client secret
   */
  async createSSOAppRegistration(
    accessToken: string,
    displayName: string = 'Device Inventory SSO',
    redirectUri: string,
    tags?: string[]
  ): Promise<AppRegistrationResponse & { clientSecret: string; clientSecretExpiry: string }> {
    const url = `${this.GRAPH_API_BASE}/applications`;

    const appDefinition: any = {
      displayName,
      signInAudience: 'AzureADMyOrg', // Single tenant
      requiredResourceAccess: [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: [
            // User.Read (Delegated) - For getting user profile
            {
              id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d',
              type: 'Scope'
            },
            // openid (Delegated) - Required for OIDC
            {
              id: '37f7f235-527c-4136-accd-4a02d197296e',
              type: 'Scope'
            },
            // profile (Delegated) - For user profile info
            {
              id: '14dad69e-099b-42c9-810b-d002981feec1',
              type: 'Scope'
            },
            // email (Delegated) - For email address
            {
              id: '64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0',
              type: 'Scope'
            }
          ]
        }
      ],
      web: {
        redirectUris: [redirectUri],
        implicitGrantSettings: {
          enableIdTokenIssuance: true,
          enableAccessTokenIssuance: false
        }
      }
    };

    // Add tags if provided (for identification and cleanup)
    if (tags && tags.length > 0) {
      appDefinition.tags = tags;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(appDefinition)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SSO app registration creation failed: ${response.status} ${error}`);
    }

    const appRegistration = await response.json() as AppRegistrationResponse;

    // Create client secret for the SSO app
    const secretResponse = await this.addClientSecret(
      accessToken,
      appRegistration.id,
      'Device Inventory SSO Secret',
      365 // 1 year validity
    );

    return {
      ...appRegistration,
      clientSecret: secretResponse.secretText,
      clientSecretExpiry: secretResponse.endDateTime
    };
  }

  /**
   * Add client secret to an app registration
   *
   * @param accessToken - Access token
   * @param appObjectId - App registration object ID
   * @param displayName - Secret display name
   * @param validityDays - Number of days the secret is valid
   * @returns Secret value and expiry date
   */
  async addClientSecret(
    accessToken: string,
    appObjectId: string,
    displayName: string = 'Client Secret',
    validityDays: number = 365
  ): Promise<{ secretText: string; endDateTime: string }> {
    const url = `${this.GRAPH_API_BASE}/applications/${appObjectId}/addPassword`;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + validityDays);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        passwordCredential: {
          displayName,
          endDateTime: endDate.toISOString()
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Add password failed: ${response.status} ${error}`);
    }

    const data = await response.json() as any;

    return {
      secretText: data.secretText,
      endDateTime: data.endDateTime
    };
  }

  /**
   * Delete an app registration (for rollback)
   *
   * @param accessToken - Access token
   * @param appObjectId - App registration object ID
   */
  async deleteAppRegistration(accessToken: string, appObjectId: string): Promise<void> {
    const url = `${this.GRAPH_API_BASE}/applications/${appObjectId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`App registration deletion failed: ${response.status} ${error}`);
    }

    console.log(`[MicrosoftGraph] Deleted app registration ${appObjectId}`);
  }

  /**
   * Delete a service principal (for rollback)
   *
   * @param accessToken - Access token
   * @param servicePrincipalId - Service principal object ID
   */
  async deleteServicePrincipal(accessToken: string, servicePrincipalId: string): Promise<void> {
    const url = `${this.GRAPH_API_BASE}/servicePrincipals/${servicePrincipalId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Service principal deletion failed: ${response.status} ${error}`);
    }

    console.log(`[MicrosoftGraph] Deleted service principal ${servicePrincipalId}`);
  }

  /**
   * Get app registration by object ID
   *
   * @param accessToken - Access token
   * @param appObjectId - App registration object ID
   * @returns App registration details or null if not found
   */
  async getAppRegistration(accessToken: string, appObjectId: string): Promise<AppRegistrationResponse | null> {
    const url = `${this.GRAPH_API_BASE}/applications/${appObjectId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get app registration: ${response.status} ${error}`);
    }

    return await response.json() as AppRegistrationResponse | null;
  }

  /**
   * Get service principal by app ID
   *
   * @param accessToken - Access token
   * @param appId - Application (client) ID
   * @returns Service principal details or null if not found
   */
  async getServicePrincipalByAppId(accessToken: string, appId: string): Promise<ServicePrincipalResponse | null> {
    const url = `${this.GRAPH_API_BASE}/servicePrincipals?$filter=appId eq '${appId}'`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

        if (!response.ok) {

          const error = await response.text();

          throw new Error(`Failed to get service principal: ${response.status} ${error}`);

        }

    

        const data = await response.json() as any;

    

        if (!data.value || data.value.length === 0) {
      return null;
    }

    return data.value[0];
  }

    /**
     * Validate certificate authentication by attempting to get an access token
     * using client credentials flow with certificate assertion
     * 
     * @param clientId - Application (client) ID
     * @param tenantId - Azure AD tenant ID
     * @param certPem - Certificate in PEM format
     * @param privateKeyPem - Private key in PEM format
     * @param thumbprint - Certificate thumbprint (SHA-1, uppercase hex)
     * @param pfxBase64 - Optional raw PFX data in base64
     * @param pfxPassword - Optional PFX password
     * @returns Validation result with access token if successful
     */
    async validateCertificateAuth(
      clientId: string,
      tenantId: string,
      certPem: string,
      privateKeyPem: string,
      thumbprint: string,
      pfxBase64?: string,
      pfxPassword?: string
    ): Promise<{ success: boolean; accessToken?: string; error?: string }> {
      try {
        let jwtAssertion: string;
  
        // If PFX is provided, we use it to generate the assertion if we had a library for it,
        // but for simplicity in this node environment without heavy deps, we'll use the PEM assertion logic
        // as the primary method since we always have PEM keys generated by our service.
        
        if (!privateKeyPem && pfxBase64) {
          // If we only have PFX, we'd need to extract PEM first or use a different library.
          // But our certificateService always provides both.
          return { success: false, error: 'PEM private key required for assertion generation' };
        }
  
        // Create JWT assertion for client credentials flow
        jwtAssertion = this.createJwtAssertion(clientId, tenantId, privateKeyPem, thumbprint);
  
        const tokenUrl = `${this.AUTH_BASE}/${tenantId}/oauth2/v2.0/token`;
  
        const params = new URLSearchParams({
          client_id: clientId,
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: jwtAssertion,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default'
        });
  
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
  
        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error_description: 'Unknown error' }))) as any;
          return {
            success: false,
            error: errorData.error_description || `Authentication failed: ${response.status}`
          };
        }
  
        const data = (await response.json()) as any;
  
        // Verify we got a valid token by making a simple Graph API call
        const verifyResponse = await fetch(`${this.GRAPH_API_BASE}/organization`, {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
  
        if (!verifyResponse.ok) {
          return {
            success: false,
            error: 'Token validation failed - unable to access Graph API'
          };
        }
  
        console.log('[MicrosoftGraph] Certificate authentication validated successfully');
  
        return {
          success: true,
          accessToken: data.access_token
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Certificate authentication validation failed'
        };
      }
    }
  
    /**
     * Get app-only access token using certificate authentication
     * 
     * @param tenantId - Azure AD tenant ID
     * @param clientId - Application (client) ID
     * @param thumbprint - Certificate thumbprint (SHA-1, uppercase hex)
     * @param privateKeyPem - Private key in PEM format
     * @param pfxBase64 - Optional raw PFX data
     * @param pfxPassword - Optional PFX password
     * @returns Access token
     */
    async getAppOnlyTokenWithCertificate(
      tenantId: string,
      clientId: string,
      thumbprint: string,
      privateKeyPem: string,
      pfxBase64?: string,
      pfxPassword?: string
    ): Promise<string> {
      const authResult = await this.validateCertificateAuth(
        clientId,
        tenantId,
        '', // certPem not used by validateCertificateAuth for token exchange
        privateKeyPem,
        thumbprint,
        pfxBase64,
        pfxPassword
      );
      if (!authResult.success || !authResult.accessToken) {
      throw new Error(`Certificate authentication failed: ${authResult.error}`);
    }

    return authResult.accessToken;
  }

  /**
   * Create a JWT assertion for certificate-based client credentials flow
   *
   * @param clientId - Application (client) ID
   * @param tenantId - Azure AD tenant ID
   * @param privateKeyPem - Private key in PEM format
   * @param thumbprint - Certificate thumbprint (SHA-1, uppercase hex)
   * @returns Signed JWT assertion
   */
  private createJwtAssertion(
    clientId: string,
    tenantId: string,
    privateKeyPem: string,
    thumbprint: string
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const audience = `${this.AUTH_BASE}/${tenantId}/oauth2/v2.0/token`;

    // Create header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      x5t: this.thumbprintToBase64Url(thumbprint)
    };

    // Create payload
    const payload = {
      aud: audience,
      exp: now + 600, // 10 minutes
      iss: clientId,
      jti: crypto.randomUUID(),
      nbf: now,
      sub: clientId,
      iat: now
    };

    // Encode header and payload
    const headerBase64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadBase64 = this.base64UrlEncode(JSON.stringify(payload));

    // Create signature input
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    // Sign with private key using node-forge
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const md = forge.md.sha256.create();
    md.update(signatureInput, 'utf8');

    const signature = privateKey.sign(md);
    const signatureBase64 = this.base64UrlEncode(signature);

    return `${signatureInput}.${signatureBase64}`;
  }

  /**
   * Convert SHA-1 thumbprint to base64url format for JWT x5t claim
   *
   * @param thumbprint - Uppercase hex thumbprint
   * @returns Base64url encoded thumbprint
   */
  private thumbprintToBase64Url(thumbprint: string): string {
    // Convert hex to binary
    const bytes = Buffer.from(thumbprint, 'hex');
    // Convert to base64url
    return bytes.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64url encode a string
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str, 'binary')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Find app registrations by tags
   * Useful for identifying and cleaning up apps created by auto-provisioning
   *
   * @param accessToken - Access token
   * @param tag - Tag to search for (e.g., "DeviceInventory:AutoProvisioned")
   * @returns Array of app registrations with the specified tag
   */
  async findAppsByTag(accessToken: string, tag: string): Promise<AppRegistrationResponse[]> {
    const url = `${this.GRAPH_API_BASE}/applications?$filter=tags/any(t:t eq '${tag}')`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to search apps by tag: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return data.value || [];
  }

  /**
   * Delete multiple app registrations by tags
   * Useful for cleaning up orphaned apps from failed provisioning attempts
   *
   * @param accessToken - Access token
   * @param tag - Tag to identify apps to delete
   * @returns Number of apps deleted
   */
  async deleteAppsByTag(accessToken: string, tag: string): Promise<{ deleted: number; errors: string[] }> {
    console.log(`[MicrosoftGraph] Finding apps with tag: ${tag}`);
    const apps = await this.findAppsByTag(accessToken, tag);

    console.log(`[MicrosoftGraph] Found ${apps.length} apps to delete`);
    const errors: string[] = [];
    let deleted = 0;

    for (const app of apps) {
      try {
        await this.deleteAppRegistration(accessToken, app.id);
        deleted++;
        console.log(`[MicrosoftGraph] Deleted app: ${app.displayName} (${app.appId})`);
      } catch (error: any) {
        const errorMsg = `Failed to delete ${app.displayName}: ${error.message}`;
        console.error(`[MicrosoftGraph] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return { deleted, errors };
  }
}

// Export singleton instance
export const microsoftGraphClient = new MicrosoftGraphClient();
