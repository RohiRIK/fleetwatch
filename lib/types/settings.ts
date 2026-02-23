/**
 * Settings Types & Constants
 * Type-safe settings management for FleetWatch
 */

// ============================================================================
// Setting Categories
// ============================================================================

export const SETTING_CATEGORIES = {
  SYNC: 'sync',
  NOTIFICATIONS: 'notifications',
  AZURE: 'azure',
  SYSTEM: 'system',
} as const;

export type SettingCategory = typeof SETTING_CATEGORIES[keyof typeof SETTING_CATEGORIES];

// ============================================================================
// Setting Keys (Type-Safe)
// ============================================================================

export const SETTING_KEYS = {
  // Sync settings
  SYNC_SCHEDULE: 'sync.schedule',
  SYNC_MODE: 'sync.mode',
  SYNC_ENABLED: 'sync.enabled',
  
  // Notification settings
  NOTIFICATIONS_EMAIL_ENABLED: 'notifications.email.enabled',
  NOTIFICATIONS_EMAIL_RECIPIENTS: 'notifications.email.recipients',
  NOTIFICATIONS_WEBHOOK_URL: 'notifications.webhook.url',
  NOTIFICATIONS_THRESHOLD_COMPLIANCE: 'notifications.thresholds.compliance',
  NOTIFICATIONS_THRESHOLD_SYNC_ERRORS: 'notifications.thresholds.syncErrors',
  
  // Azure AD settings (read-only)
  AZURE_TENANT_ID: 'azure.tenantId',
  AZURE_CLIENT_ID: 'azure.clientId',
  
  // System settings
  SYSTEM_MAINTENANCE: 'system.maintenance',
} as const;

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS];

// ============================================================================
// Setting Value Types
// ============================================================================

export type SyncMode = 'full' | 'incremental' | 'deep';

export type SettingValue = 
  | string 
  | number 
  | boolean 
  | string[] 
  | Record<string, any>;

// ============================================================================
// Setting Type Map (for validation)
// ============================================================================

export interface SettingTypeMap {
  // Sync
  'sync.schedule': string; // cron expression
  'sync.mode': SyncMode;
  'sync.enabled': boolean;
  
  // Notifications
  'notifications.email.enabled': boolean;
  'notifications.email.recipients': string[]; // email addresses
  'notifications.webhook.url': string; // URL
  'notifications.thresholds.compliance': number; // percentage 0-100
  'notifications.thresholds.syncErrors': number; // count
  
  // Azure (read-only)
  'azure.tenantId': string;
  'azure.clientId': string;
  
  // System
  'system.maintenance': boolean;
}

// ============================================================================
// Setting Interface
// ============================================================================

export interface Setting {
  id: string;
  category: SettingCategory;
  key: SettingKey;
  value: SettingValue;
  encrypted: boolean;
  description: string | null;
  defaultValue: SettingValue | null;
  updatedBy: string | null;
  updatedAt: Date;
  createdAt: Date;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_SETTINGS: Record<SettingKey, SettingValue> = {
  // Sync defaults
  'sync.schedule': '0 */6 * * *', // Every 6 hours
  'sync.mode': 'full',
  'sync.enabled': true,
  
  // Notification defaults
  'notifications.email.enabled': false,
  'notifications.email.recipients': [],
  'notifications.webhook.url': '',
  'notifications.thresholds.compliance': 80, // Alert if <80% compliant
  'notifications.thresholds.syncErrors': 5, // Alert if >=5 errors
  
  // Entra ID defaults (from ENV)
  'azure.tenantId': process.env.ENTRA_TENANT_ID || '',
  'azure.clientId': process.env.ENTRA_CLIENT_ID || '',
  
  // System defaults
  'system.maintenance': false,
};

// ============================================================================
// Setting Descriptions
// ============================================================================

export const SETTING_DESCRIPTIONS: Record<SettingKey, string> = {
  'sync.schedule': 'Cron expression for automatic device sync schedule',
  'sync.mode': 'Sync mode: full (all data), incremental (changes only), deep (full + enrichment)',
  'sync.enabled': 'Enable automatic device synchronization',
  
  'notifications.email.enabled': 'Enable email notifications for system alerts',
  'notifications.email.recipients': 'Email addresses to receive system notifications',
  'notifications.webhook.url': 'Webhook URL for external alert integrations',
  'notifications.thresholds.compliance': 'Alert when device compliance drops below this percentage',
  'notifications.thresholds.syncErrors': 'Alert when sync errors exceed this count',
  
  'azure.tenantId': 'Azure AD Tenant ID (read-only)',
  'azure.clientId': 'Azure AD Client ID (read-only)',
  
  'system.maintenance': 'Enable maintenance mode (disables sync and alerts)',
};
