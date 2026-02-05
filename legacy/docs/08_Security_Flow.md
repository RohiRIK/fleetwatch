# Document 08: Security Flow

## 1. Authentication Architecture

### Identity Provider
Microsoft Entra ID (formerly Azure AD) serves as the primary Identity Provider (IdP) for both user and machine authentication.

### Authentication Flows
1.  **User Authentication (SAML/OIDC):**
    *   **Flow:** Authorization Code Flow.
    *   **Implementation:** Users are redirected to Microsoft login. Upon success, an authorization code is exchanged for tokens.
    *   **Session:** Validated sessions are stored in **Redis**. The client receives a secure, HTTP-only cookie (`device_inventory_session`).
    *   **Middleware:** `session-auth.middleware.ts` intercepts requests, validates the cookie against Redis, and populates the user context.

2.  **Service Authentication (Machine-to-Machine):**
    *   **Principal:** The Fetcher service.
    *   **Method:** Bearer Token.
    *   **Validation:** `createIngestAuthMiddleware` verifies the token against the secret stored in the configuration/Redis.

## 2. Secure Provisioning ("Zero-Touch")
The system includes an `AutoProvisioningService` designed to bootstrap the Azure environment programmatically.

### Workflow:
1.  **Admin Authorization:** An administrator authenticates via Device Code Flow (`microsoft-graph.service.ts`).
2.  **App Registration:** The service creates two Azure App Registrations:
    *   **Fetcher App:** For background data sync (Application Permissions).
    *   **SSO App:** For user login (Delegated Permissions).
3.  **Certificate Management:** 
    *   Generates a 2048-bit RSA key pair locally.
    *   Uploads the public key (PFX) to the Azure App Registration.
4.  **Credential Protection:**
    *   The private key and generated secrets are **encrypted** using a master encryption key.
    *   Encrypted credentials are persistent in **Redis** and written to the `.env` file for redundancy.
