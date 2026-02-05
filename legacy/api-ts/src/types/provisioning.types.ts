/**
 * Provisioning Types
 *
 * Type definitions for the auto-provisioning system.
 * Handles Azure App Registration creation, certificate generation,
 * and system configuration.
 */

import type { LocalUserPublic } from './local-user.types';

/**
 * Provisioning session status
 */
export type ProvisioningStatus =
  | 'pending'           // Waiting to start
  | 'authenticating'    // Device code flow in progress
  | 'authenticated'     // User authenticated, ready to execute
  | 'executing'         // Provisioning in progress
  | 'in_progress'       // Generic in progress state
  | 'completed'         // Successfully completed
  | 'failed'            // Failed (may be rolling back)
  | 'rolling_back'      // Rollback in progress
  | 'rolled_back';      // Rollback completed

/**
 * Types of resources that can be created during provisioning
 */
export type CreatedResourceType =
  | 'app_registration'
  | 'service_principal'
  | 'certificate'
  | 'local_user'
  | 'env_backup'
  | 'file';

/**
 * A resource created during provisioning (for rollback tracking)
 */
export interface CreatedResource {
  /** Resource type */
  type: CreatedResourceType;
  /** Resource identifier */
  id: string;
  /** Azure Object ID (for Graph API resources) */
  objectId?: string;
  /** Human-readable name */
  name: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Provisioning step definition
 */
export interface ProvisioningStep {
  /** Step identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Step order */
  order: number;
}

/**
 * All provisioning steps
 */
export const PROVISIONING_STEPS: ProvisioningStep[] = [
  { id: 'authenticate', label: 'Authenticate with Microsoft', order: 1 },
  { id: 'create_fetcher_app', label: 'Create Fetcher App Registration', order: 2 },
  { id: 'create_sso_app', label: 'Create SSO App Registration', order: 3 },
  { id: 'generate_secrets', label: 'Generate Security Tokens', order: 4 },
  { id: 'generate_certificate', label: 'Generate Certificate', order: 5 },
  { id: 'upload_certificate', label: 'Upload Certificate to Azure', order: 6 },
  { id: 'grant_fetcher_permissions', label: 'Grant Fetcher Permissions', order: 7 },
  { id: 'grant_sso_permissions', label: 'Grant SSO Permissions', order: 8 },
  { id: 'create_admin_user', label: 'Create Admin User', order: 9 },
  { id: 'write_configuration', label: 'Write Configuration', order: 10 },
  { id: 'verify_configuration', label: 'Verify Configuration', order: 11 },
];

/**
 * Provisioning progress tracking
 */
export interface ProvisioningProgress {
  /** Current step ID */
  currentStep: string;
  /** Completed step IDs */
  completedSteps: string[];
  /** Total number of steps */
  totalSteps: number;
  /** Completion percentage (0-100) */
  percentComplete: number;
}

/**
 * Provisioning error details
 */
export interface ProvisioningError {
  /** Step where error occurred */
  step: string;
  /** Error message */
  message: string;
  /** Error code (if available) */
  code?: string;
  /** Full error details (for logging) */
  details?: string;
  /** Rollback status */
  rollbackStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Details of what was rolled back */
  rollbackDetails: string[];
}

/**
 * Complete provisioning state (stored in Redis)
 */
export interface ProvisioningState {
  /** Provisioning session ID */
  provisioningId: string;
  /** Current status */
  status: ProvisioningStatus;
  /** Unix timestamp of start */
  startedAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
  /** Unix timestamp of completion (success or failure) */
  completedAt?: number;
  /** Current step ID */
  currentStep: string;
  /** Completed step IDs */
  completedSteps: string[];
  /** Resources created (for rollback) */
  createdResources: CreatedResource[];
  /** Microsoft tenant ID */
  tenantId?: string;
  /** Admin user email (from Microsoft auth) */
  adminEmail?: string;
  /** Access token (encrypted, for rollback) */
  accessToken?: string;
  /** Error details (if failed) */
  error?: ProvisioningError;
}

/**
 * Input for initiating provisioning
 */
export interface InitiateProvisioningInput {
  /** Optional: pre-specified redirect URI */
  redirectUri?: string;
}

/**
 * Response from initiating provisioning (device code flow)
 */
export interface InitiateProvisioningResponse {
  success: boolean;
  data?: {
    /** Provisioning session ID */
    provisioningId: string;
    /** Device code for polling */
    deviceCode: string;
    /** User code to display */
    userCode: string;
    /** Microsoft verification URL */
    verificationUri: string;
    /** Seconds until expiration */
    expiresIn: number;
    /** Polling interval in seconds */
    interval: number;
    /** Instructions for user */
    message: string;
  };
  error?: string;
}

/**
 * Input for polling device code
 */
export interface PollProvisioningInput {
  provisioningId: string;
  deviceCode: string;
}

/**
 * Response from polling device code
 */
export interface PollProvisioningResponse {
  success: boolean;
  status: 'pending' | 'authenticated' | 'expired' | 'error';
  data?: {
    adminUserEmail: string;
    tenantId: string;
  };
  error?: string;
}

/**
 * Input for executing provisioning
 */
export interface ExecuteProvisioningInput {
  provisioningId: string;
  adminUser: {
    email: string;
    password: string;
    displayName: string;
  };
}

/**
 * App registration result
 */
export interface AppRegistrationResult {
  /** Azure App ID (client ID) */
  clientId: string;
  /** Azure Object ID */
  objectId: string;
  /** Display name */
  displayName: string;
  /** Service Principal ID */
  servicePrincipalId?: string;
  /** Client secret (for SSO app only) */
  clientSecret?: string;
}

/**
 * Certificate result
 */
export interface CertificateResult {
  /** Certificate thumbprint (SHA-1) */
  thumbprint: string;
  /** Path to certificate file */
  certPath: string;
  /** Path to private key file */
  keyPath: string;
  /** Expiration date */
  expiresAt: string;
}

/**
 * Security tokens result
 */
export interface TokensResult {
  /** Admin API token */
  adminToken: string;
  /** Ingest secret */
  ingestSecret: string;
  /** Session secret */
  sessionSecret: string;
}

/**
 * Result of executing provisioning
 */
export interface ProvisioningExecutionResult {
  success: boolean;
  config?: any;
  duration: number;
  message?: string;
  error?: string;
}

/**
 * Complete provisioning results
 */
export interface ProvisioningResults {
  /** Fetcher app registration */
  fetcherApp: AppRegistrationResult;
  /** SSO app registration */
  ssoApp: AppRegistrationResult;
  /** Certificate info */
  certificate: CertificateResult;
  /** Local admin user */
  localAdmin: LocalUserPublic;
  /** Generated tokens */
  tokens: TokensResult;
  /** Tenant ID */
  tenantId: string;
}

/**
 * Response from executing provisioning
 */
export interface ExecuteProvisioningResponse {
  success: boolean;
  status: ProvisioningStatus;
  progress: ProvisioningProgress;
  results?: ProvisioningResults;
  error?: ProvisioningError;
}

/**
 * Response from getting provisioning progress
 */
export interface GetProgressResponse {
  provisioningId: string;
  status: ProvisioningStatus;
  progress: ProvisioningProgress;
  createdResources: CreatedResource[];
  error?: ProvisioningError;
}

/**
 * Input for manual rollback
 */
export interface RollbackInput {
  provisioningId: string;
}

/**
 * Response from rollback
 */
export interface RollbackResponse {
  success: boolean;
  rolledBackResources: string[];
  failedRollbacks: Array<{
    resource: string;
    error: string;
  }>;
}

/**
 * System configuration status
 */
export interface ConfigurationStatus {
  /** Whether system needs setup */
  needsSetup: boolean;
  /** Configuration state details */
  configurationState: {
    hasFetcherApp: boolean;
    hasSSOApp: boolean;
    hasCertificate: boolean;
    hasLocalAdmin: boolean;
    hasSecurityTokens: boolean;
  };
  /** Whether all dependencies are met */
  canProceed: boolean;
}

/**
 * Redis key prefixes for provisioning
 */
export const PROVISIONING_KEYS = {
  /** Provisioning state: provisioning:{id} */
  STATE: 'provisioning:',
} as const;

/**
 * Provisioning state TTL (1 hour)
 */
export const PROVISIONING_STATE_TTL = 3600;

/**
 * Permissions required for provisioning
 */
export const PROVISIONING_PERMISSIONS = [
  'Application.ReadWrite.All',
  'AppRoleAssignment.ReadWrite.All',
  'Directory.Read.All',
] as const;

/**
 * Fetcher app permissions (application permissions - no user)
 */
export const FETCHER_APP_PERMISSIONS = [
  'DeviceManagementManagedDevices.Read.All',
  'DeviceManagementConfiguration.Read.All',
  'DeviceManagementApps.Read.All',
  'DeviceManagementRBAC.Read.All',
  'Device.Read.All',
  'Directory.Read.All',
  'User.Read.All',
  'Group.Read.All',
  'Reports.Read.All',
  'AuditLog.Read.All',
  'Organization.Read.All',
  'Policy.Read.All',
  'SecurityEvents.Read.All',
  'IdentityRiskyUser.Read.All',
] as const;

/**
 * SSO app permissions (delegated permissions - user consent)
 */
export const SSO_APP_PERMISSIONS = [
  'openid',
  'profile',
  'email',
  'User.Read',
] as const;
