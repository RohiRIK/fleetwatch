/**
 * Local User Types
 *
 * Type definitions for local user authentication system.
 * Local users are stored in Redis as a backup to Microsoft SSO.
 */

/**
 * Local user roles
 */
export type LocalUserRole = 'admin' | 'viewer';

/**
 * Local user stored in Redis
 */
export interface LocalUser {
  /** UUID v4 identifier */
  id: string;
  /** User's email address (unique) */
  email: string;
  /** Display name */
  displayName: string;
  /** bcrypt hashed password */
  passwordHash: string;
  /** User role */
  role: LocalUserRole;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last login */
  lastLogin?: number;
  /** Whether the user can log in */
  isActive: boolean;
}

/**
 * Local user without sensitive fields (for API responses)
 */
export interface LocalUserPublic {
  id: string;
  email: string;
  displayName: string;
  role: LocalUserRole;
  createdAt: number;
  lastLogin?: number;
  isActive: boolean;
}

/**
 * Input for creating a local user
 */
export interface CreateLocalUserInput {
  email: string;
  password: string;
  displayName: string;
  role: LocalUserRole;
}

/**
 * Input for local user login
 */
export interface LocalLoginInput {
  email: string;
  password: string;
}

/**
 * Result of local user authentication
 */
export interface LocalAuthResult {
  success: boolean;
  user?: LocalUserPublic;
  error?: string;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Local user service configuration
 */
export interface LocalUserConfig {
  /** Minimum password length */
  minPasswordLength: number;
  /** bcrypt cost factor (rounds) */
  bcryptRounds: number;
  /** Whether local auth is enabled */
  enabled: boolean;
}

/**
 * Redis key prefixes for local users
 */
export const LOCAL_USER_KEYS = {
  /** User data: local_user:{id} */
  USER: 'local_user:',
  /** Email index: local_user:email:{email} */
  EMAIL_INDEX: 'local_user:email:',
} as const;
