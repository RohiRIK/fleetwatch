import { pgTable, uuid, varchar, text, boolean, bigint, integer, timestamp, jsonb, pgEnum, unique, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const teamRoleEnum = pgEnum('team_role', ['OWNER', 'MEMBER']);
export const userRoleEnum = pgEnum('user_role', ['VIEWER', 'ADMIN', 'SUPERADMIN']);

// ============================================================================
// USERS TABLE
// ============================================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  jobTitle: varchar('job_title', { length: 255 }),
  department: varchar('department', { length: 255 }),
  givenName: varchar('given_name', { length: 255 }), // First name from Azure AD
  surname: varchar('surname', { length: 255 }), // Last name from Azure AD
  mobilePhone: varchar('mobile_phone', { length: 50 }), // Mobile phone number
  officeLocation: varchar('office_location', { length: 255 }), // Physical office location
  
  // ========== PHASE 3: EXTENDED USER FIELDS (15 new columns) ==========
  employeeId: varchar('employee_id', { length: 100 }), // Employee ID from Azure AD
  employeeType: varchar('employee_type', { length: 50 }), // Full-time, Contractor, etc.
  companyName: varchar('company_name', { length: 255 }), // Company name
  hireDate: timestamp('hire_date'), // Employment hire date
  leaveDate: timestamp('leave_date'), // Employment end date
  usageLocation: varchar('usage_location', { length: 100 }), // Country code
  onPremisesSyncEnabled: boolean('on_premises_sync_enabled'), // Synced from on-prem AD
  securityIdentifier: varchar('security_identifier', { length: 255 }), // Windows SID
  businessPhone: varchar('business_phone', { length: 50 }), // Business phone number
  totalDevices: integer('total_devices'), // Total managed devices count
  compliantDevices: integer('compliant_devices'), // Compliant devices count
  nonCompliantDevices: integer('non_compliant_devices'), // Non-compliant devices count
  devicesNeedingAttention: integer('devices_needing_attention'), // Devices with issues
  lastSignInDateTime: timestamp('last_sign_in_date_time'), // Last successful sign-in
  azureId: varchar('azure_id', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }), // For emergency admin fallback
  role: userRoleEnum('role').notNull().default('VIEWER'), // User's system role
  emailVerified: timestamp('email_verified'), // Required by NextAuth.js
  image: varchar('image', { length: 1024 }), // Optional profile image
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  accounts: many(accounts),
  sessions: many(sessions),
  licenses: many(user_licenses),
  userDevices: many(user_devices),
}));

// ============================================================================
// DEVICES TABLE - Extended Schema for Full Intune Data
// ============================================================================
export const devices = pgTable('devices', {
  // ========== CORE IDENTITY ==========
  id: uuid('id').primaryKey().defaultRandom(),
  azureId: varchar('azure_id', { length: 255 }).notNull().unique(),
  azureAdDeviceId: varchar('azure_ad_device_id', { length: 255 }),
  deviceName: varchar('device_name', { length: 255 }).notNull(),
  serialNumber: varchar('serial_number', { length: 255 }).unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // ========== BASIC DEVICE INFO ==========
  manufacturer: varchar('manufacturer', { length: 100 }),
  model: varchar('model', { length: 100 }),
  operatingSystem: varchar('operating_system', { length: 50 }), // Windows, iOS, Android, macOS
  osVersion: varchar('os_version', { length: 100 }),
  
  // ========== ENROLLMENT INFO ==========
  joinType: varchar('join_type', { length: 50 }), // AzureADJoined, Hybrid, AzureADRegistered
  enrollmentType: varchar('enrollment_type', { length: 50 }),
  managementState: varchar('management_state', { length: 50 }),
  managedDeviceOwnerType: varchar('managed_device_owner_type', { length: 50 }), // Company, Personal
  enrolledAt: timestamp('enrolled_at'),
  
  // ========== COMPLIANCE & SECURITY (HOT - frequently queried) ==========
  isCompliant: boolean('is_compliant').notNull().default(false),
  complianceState: varchar('compliance_state', { length: 50 }),
  isEncrypted: boolean('is_encrypted').notNull().default(false),
  isSupervised: boolean('is_supervised').notNull().default(false),
  jailBroken: varchar('jail_broken', { length: 50 }),
  complianceGracePeriodExpiration: timestamp('compliance_grace_period_expiration'),
  partnerReportedThreatState: varchar('partner_reported_threat_state', { length: 50 }),
  
  // ========== USER INFO (denormalized for performance) ==========
  userPrincipalName: varchar('user_principal_name', { length: 255 }),
  userDisplayName: varchar('user_display_name', { length: 255 }),
  userEmail: varchar('user_email', { length: 255 }),
  userDepartment: varchar('user_department', { length: 255 }),
  
  // ========== HARDWARE (commonly queried) ==========
  storageTotal: bigint('storage_total', { mode: 'number' }),
  storageFree: bigint('storage_free', { mode: 'number' }),
  memoryTotal: bigint('memory_total', { mode: 'number' }),
  batteryHealth: integer('battery_health'),
  chassisType: varchar('chassis_type', { length: 50 }), // Laptop, Desktop, Tablet, Phone
  notes: text('notes'), // Admin notes/comments for this device
  imei: varchar('imei', { length: 50 }), // Mobile device IMEI number
  phoneNumber: varchar('phone_number', { length: 50 }), // Mobile device phone number
  
  // ========== NETWORK (commonly queried) ==========
  ipAddressV4: varchar('ip_address_v4', { length: 45 }), // Changed from INET for compatibility
  wifiMac: varchar('wifi_mac', { length: 17 }),
  ethernetMac: varchar('ethernet_mac', { length: 17 }),
  
  // ========== JSONB COLUMNS FOR COMPLEX NESTED DATA ==========
  // Full raw device data from Graph API
  rawDeviceData: jsonb('raw_device_data'),
  
  // Enriched data from additional Graph API calls
  hardwareDetails: jsonb('hardware_details'), // Full hardware info (IMEI, MEID, Device Guard, etc.)
  networkDetails: jsonb('network_details'), // IPv6, subnet, full network config
  complianceDetails: jsonb('compliance_details'), // Policies, settings, failures
  configurationDetails: jsonb('configuration_details'), // Config profiles
  securityDetails: jsonb('security_details'), // Defender, BitLocker, TPM, Secure Boot
  autopilotDetails: jsonb('autopilot_details'), // Autopilot enrollment info
  exchangeActivesyncDetails: jsonb('exchange_activesync_details'), // EAS status
  lostModeDetails: jsonb('lost_mode_details'), // iOS lost mode
  malwareDetails: jsonb('malware_details'), // Windows malware detection
  actionsHistory: jsonb('actions_history'), // Recent device actions
  organizationDetails: jsonb('organization_details'), // Groups, categories
  analyticsDetails: jsonb('analytics_details'), // Endpoint analytics
  crashesDetails: jsonb('crashes_details'), // App crashes
  warrantyDetails: jsonb('warranty_details'), // Warranty info
  conditionalAccessDetails: jsonb('conditional_access_details'), // CA policies
  detectedAppsDetails: jsonb('detected_apps_details'), // Installed apps
  
  // Data quality indicators
  dataQuality: jsonb('data_quality'), // What data we have
  
  // Ingestion metadata
  ingestionMetadata: jsonb('ingestion_metadata'), // When/how synced
  
  // ========== PHASE 3: EXTENDED HARDWARE (25 new columns) ==========
  // Hardware deep dive fields
  meid: varchar('meid', { length: 50 }), // Mobile Equipment Identifier
  iccid: varchar('iccid', { length: 50 }), // SIM card identifier
  udid: varchar('udid', { length: 255 }), // Unique Device Identifier (Apple)
  subscriberCarrier: varchar('subscriber_carrier', { length: 100 }), // Mobile carrier
  batterySerialNumber: varchar('battery_serial_number', { length: 100 }),
  batteryChargeCycles: integer('battery_charge_cycles'),
  batteryLevelPercentage: integer('battery_level_percentage'),
  residentUsersCount: integer('resident_users_count'),
  productName: varchar('product_name', { length: 255 }), // Marketing product name
  deviceFullQualifiedDomainName: varchar('device_full_qualified_domain_name', { length: 255 }),

  // Management fields
  managementAgent: varchar('management_agent', { length: 50 }), // mdm, eas, etc.
  managementCertificateExpirationDate: timestamp('management_certificate_expiration_date'),
  managementFeatures: varchar('management_features', { length: 255 }),
  remoteAssistanceSessionUrl: text('remote_assistance_session_url'),
  remoteAssistanceSessionErrorDetails: text('remote_assistance_session_error_details'),
  requireUserEnrollmentApproval: boolean('require_user_enrollment_approval'),
  enrollmentProfileName: varchar('enrollment_profile_name', { length: 255 }),

  // Security hardware fields
  tpmPresent: boolean('tpm_present'),
  secureBootEnabled: boolean('secure_boot_enabled'),
  codeIntegrityEnabled: boolean('code_integrity_enabled'),
  bootDebuggingEnabled: boolean('boot_debugging_enabled'),

  // Exchange ActiveSync fields
  easActivated: boolean('eas_activated'),
  easDeviceId: varchar('eas_device_id', { length: 100 }),
  exchangeLastSuccessfulSyncDateTime: timestamp('exchange_last_successful_sync_date_time'),

  // Malware protection fields
  malwareActiveCount: integer('malware_active_count'),
  malwareRemediatedCount: integer('malware_remediated_count'),
  
  // ========== TIMESTAMPS ==========
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  groups: many(device_groups),
  userDevices: many(user_devices),
  analytics: one(device_analytics),
  warranty: one(device_warranty),
  compliancePolicyStates: many(device_compliance_policy_states),
  configurationProfileStates: many(device_configuration_profile_states),
  conditionalAccess: many(device_conditional_access),
}));

// ============================================================================
// TEAMS TABLE (from SaaS template)
// ============================================================================
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
}));

// ============================================================================
// TEAM_MEMBERS TABLE (from SaaS template)
// ============================================================================
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  role: teamRoleEnum('role').notNull().default('MEMBER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

// ============================================================================
// ACTIVITY_LOGS TABLE
// ============================================================================
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// SYNC_LOGS TABLE
// ============================================================================
export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  syncType: varchar('sync_type', { length: 50 }).notNull(),
  recordsSynced: integer('records_synced').notNull().default(0),
  recordsFailed: integer('records_failed').notNull().default(0),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ============================================================================
// COMPLIANCE_HISTORY TABLE - Track compliance state changes over time
// ============================================================================
export const complianceHistory = pgTable('compliance_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  isCompliant: boolean('is_compliant').notNull(),
  complianceState: varchar('compliance_state', { length: 50 }),
  policyFailures: jsonb('policy_failures'), // Array of failed policies
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

export const complianceHistoryRelations = relations(complianceHistory, ({ one }) => ({
  device: one(devices, {
    fields: [complianceHistory.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// STORAGE_HISTORY TABLE - Track storage utilization over time
// ============================================================================
export const storageHistory = pgTable('storage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  storageTotal: bigint('storage_total', { mode: 'number' }),
  storageFree: bigint('storage_free', { mode: 'number' }),
  storageUsed: bigint('storage_used', { mode: 'number' }),
  utilizationPercent: integer('utilization_percent'), // Calculated field for easier querying
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

export const storageHistoryRelations = relations(storageHistory, ({ one }) => ({
  device: one(devices, {
    fields: [storageHistory.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// NEXTAUTH.JS TABLES
// ============================================================================

// Accounts table - Links users to OAuth providers
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'oauth' or 'credentials'
  provider: varchar('provider', { length: 50 }).notNull(), // 'azure-ad' or 'credentials'
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 50 }),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Sessions table - Active user sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Verification tokens - For email verification (future use)
export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
});

// ============================================================================
// SETTINGS TABLE - Application Configuration
// ============================================================================

export const settings = pgTable('settings', {
  id: text('id').primaryKey(), // e.g., 'sync.schedule'
  category: varchar('category', { length: 50 }).notNull(), // 'sync', 'notifications', 'azure', 'system'
  key: varchar('key', { length: 100 }).notNull(), // 'schedule', 'enabled', etc.
  value: jsonb('value').notNull(), // Flexible JSON storage for any value type
  encrypted: boolean('encrypted').default(false).notNull(), // Whether value is encrypted
  description: text('description'), // Human-readable description
  defaultValue: jsonb('default_value'), // For reset functionality
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const settingsRelations = relations(settings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [settings.updatedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// AUDIT_LOGS TABLE - Persistent audit trail for compliance
// ============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 100 }).notNull(), // 'device_notes_updated', 'security_exported', etc.
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'device', 'user', 'settings', etc.
  entityId: varchar('entity_id', { length: 255 }), // ID of affected entity
  entityName: varchar('entity_name', { length: 255 }), // Name/label for easy reference
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // Who performed the action
  userEmail: varchar('user_email', { length: 255 }).notNull(), // Denormalized for reliability
  metadata: jsonb('metadata'), // Additional context: old values, new values, filters, etc.
  ipAddress: varchar('ip_address', { length: 45 }), // Source IP
  userAgent: text('user_agent'), // Browser/client info
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// PHASE 3: NEW ENUMS
// ============================================================================

export const warrantyStatusEnum = pgEnum('warranty_status', ['active', 'expired', 'unknown']);
export const groupTypeEnum = pgEnum('group_type', ['security', 'microsoft_365', 'distribution', 'mail_enabled_security']);
export const licenseStatusEnum = pgEnum('license_status', ['enabled', 'warning', 'suspended', 'deleted']);
export const policyStateEnum = pgEnum('policy_state', ['enabled', 'disabled', 'enabledForReportingButNotEnforced']);
export const policyPlatformTypeEnum = pgEnum('policy_platform_type', ['android', 'iOS', 'windows', 'macOS', 'linux', 'unknown']);
export const namedLocationTypeEnum = pgEnum('named_location_type', ['ip', 'country']);

// ============================================================================
// DEVICE_GROUPS TABLE - Entra ID group memberships
// ============================================================================

export const device_groups = pgTable('device_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  groupId: varchar('group_id', { length: 255 }).notNull(),
  groupName: varchar('group_name', { length: 255 }).notNull(),
  groupType: groupTypeEnum('group_type').notNull().default('security'),
  description: text('description'),
  isDynamic: boolean('is_dynamic').default(false),
  membershipRule: text('membership_rule'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  deviceGroupUnique: unique().on(table.deviceId, table.groupId),
}));

export const deviceGroupsRelations = relations(device_groups, ({ one }) => ({
  device: one(devices, {
    fields: [device_groups.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// USER_LICENSES TABLE - License assignments with SKU details
// ============================================================================

export const user_licenses = pgTable('user_licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  skuId: varchar('sku_id', { length: 255 }).notNull(),
  skuPartNumber: varchar('sku_part_number', { length: 255 }).notNull(),
  skuName: varchar('sku_name', { length: 255 }),
  capabilityStatus: licenseStatusEnum('capability_status').notNull().default('enabled'),
  servicePlans: jsonb('service_plans').$type<Array<{
    servicePlanId: string;
    servicePlanName: string;
    provisioningStatus: string;
    appliesTo: string;
  }>>(),
  prepaidUnitsEnabled: integer('prepaid_units_enabled'),
  prepaidUnitsSuspended: integer('prepaid_units_suspended'),
  prepaidUnitsWarning: integer('prepaid_units_warning'),
  consumedUnits: integer('consumed_units'),
  assignedAt: timestamp('assigned_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userLicenseUnique: unique().on(table.userId, table.skuId),
}));

export const userLicensesRelations = relations(user_licenses, ({ one }) => ({
  user: one(users, {
    fields: [user_licenses.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// USER_DEVICES TABLE - Many-to-many junction table
// ============================================================================

export const user_devices = pgTable('user_devices', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').default(false),
  assignedAt: timestamp('assigned_at'),
  relationshipType: varchar('relationship_type', { length: 50 }), // 'owner', 'user', 'shared'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.deviceId] }),
}));

export const userDevicesRelations = relations(user_devices, ({ one }) => ({
  user: one(users, {
    fields: [user_devices.userId],
    references: [users.id],
  }),
  device: one(devices, {
    fields: [user_devices.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// DEVICE_ANALYTICS TABLE - Endpoint analytics scores
// ============================================================================

export const device_analytics = pgTable('device_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }).unique(),
  overallScore: integer('overall_score'),
  startupScore: integer('startup_score'),
  appReliabilityScore: integer('app_reliability_score'),
  batteryScore: integer('battery_score'),
  workFromAnywhereScore: integer('work_from_anywhere_score'),
  coreBootTimeMs: integer('core_boot_time_ms'),
  coreLoginTimeMs: integer('core_login_time_ms'),
  responsiveDesktopTimeMs: integer('responsive_desktop_time_ms'),
  restartCount: integer('restart_count'),
  blueScreenCount: integer('blue_screen_count'),
  meanTimeToFailureMinutes: integer('mean_time_to_failure_minutes'),
  healthStatus: varchar('health_status', { length: 50 }),
  diskType: varchar('disk_type', { length: 50 }),
  modelPerformance: jsonb('model_performance'),
  rawAnalytics: jsonb('raw_analytics'),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const deviceAnalyticsRelations = relations(device_analytics, ({ one }) => ({
  device: one(devices, {
    fields: [device_analytics.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// DEVICE_WARRANTY TABLE - Warranty status and expiration
// ============================================================================

export const device_warranty = pgTable('device_warranty', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }).unique(),
  status: warrantyStatusEnum('status').notNull().default('unknown'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  daysRemaining: integer('days_remaining'),
  inWarranty: boolean('in_warranty').default(false),
  vendor: varchar('vendor', { length: 255 }),
  warrantyType: varchar('warranty_type', { length: 100 }),
  coverageType: varchar('coverage_type', { length: 100 }),
  description: text('description'),
  serialNumber: varchar('serial_number', { length: 255 }),
  rawWarrantyData: jsonb('raw_warranty_data'),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const deviceWarrantyRelations = relations(device_warranty, ({ one }) => ({
  device: one(devices, {
    fields: [device_warranty.deviceId],
    references: [devices.id],
  }),
}));

// ============================================================================
// CONDITIONAL ACCESS POLICIES TABLE - Global CA policies from Entra ID
// ============================================================================

export const conditional_access_policies = pgTable('conditional_access_policies', {
  id: varchar('id', { length: 255 }).primaryKey(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  state: policyStateEnum('state').notNull().default('disabled'),
  createdDateTime: timestamp('created_date_time'),
  modifiedDateTime: timestamp('modified_date_time'),
  conditions: jsonb('conditions'),
  grantControls: jsonb('grant_controls'),
  sessionControls: jsonb('session_controls'),
  isEnabled: boolean('is_enabled').default(false),
  isReportOnly: boolean('is_report_only').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const conditionalAccessPoliciesRelations = relations(conditional_access_policies, ({ many }) => ({
  devicePolicies: many(device_conditional_access),
}));

// ============================================================================
// NAMED LOCATIONS TABLE - CA named locations (IP ranges, countries)
// ============================================================================

export const named_locations = pgTable('named_locations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  locationType: namedLocationTypeEnum('location_type').notNull(),
  isTrusted: boolean('is_trusted').default(false),
  ipRanges: jsonb('ip_ranges').$type<Array<{ cidrAddress: string }>>(),
  countriesAndRegions: jsonb('countries_and_regions').$type<string[]>(),
  includeUnknownCountriesAndRegions: boolean('include_unknown_countries_and_regions'),
  createdDateTime: timestamp('created_date_time'),
  modifiedDateTime: timestamp('modified_date_time'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const namedLocationsRelations = relations(named_locations, ({ many }) => ({
  policies: many(conditional_access_policies),
}));

// ============================================================================
// DEVICE COMPLIANCE POLICIES TABLE - Intune compliance policies
// ============================================================================

export const device_compliance_policies = pgTable('device_compliance_policies', {
  id: varchar('id', { length: 255 }).primaryKey(),
  odataType: varchar('odata_type', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  platformType: policyPlatformTypeEnum('platform_type').notNull().default('unknown'),
  version: integer('version'),
  createdDateTime: timestamp('created_date_time'),
  modifiedDateTime: timestamp('modified_date_time'),
  settingCount: integer('setting_count'),
  priority: integer('priority'),
  isAssigned: boolean('is_assigned').default(false),
  assignmentCount: integer('assignment_count'),
  deviceComplianceSettingStateSummaries: jsonb('device_compliance_setting_state_summaries'),
  scheduledActionsForRule: jsonb('scheduled_actions_for_rule'),
  rawPolicyData: jsonb('raw_policy_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const deviceCompliancePoliciesRelations = relations(device_compliance_policies, ({ many }) => ({
  deviceStates: many(device_compliance_policy_states),
}));

// ============================================================================
// DEVICE COMPLIANCE POLICY STATES TABLE - Per-device compliance state
// ============================================================================

export const device_compliance_policy_states = pgTable('device_compliance_policy_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  policyId: varchar('policy_id', { length: 255 }).references(() => device_compliance_policies.id, { onDelete: 'cascade' }),
  policyName: varchar('policy_name', { length: 255 }),
  platformType: policyPlatformTypeEnum('platform_type').notNull().default('unknown'),
  state: varchar('state', { length: 50 }),
  errorCode: integer('error_code'),
  errorDescription: text('error_description'),
  lastReportedDateTime: timestamp('last_reported_date_time'),
  complianceGracePeriodExpirationDateTime: timestamp('compliance_grace_period_expiration_date_time'),
  reportedDateTime: timestamp('reported_date_time').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  devicePolicyUnique: unique().on(table.deviceId, table.policyId),
}));

export const deviceCompliancePolicyStatesRelations = relations(device_compliance_policy_states, ({ one }) => ({
  device: one(devices, {
    fields: [device_compliance_policy_states.deviceId],
    references: [devices.id],
  }),
  policy: one(device_compliance_policies, {
    fields: [device_compliance_policy_states.policyId],
    references: [device_compliance_policies.id],
  }),
}));

// ============================================================================
// DEVICE CONFIGURATION PROFILES TABLE - Intune configuration profiles
// ============================================================================

export const device_configuration_profiles = pgTable('device_configuration_profiles', {
  id: varchar('id', { length: 255 }).primaryKey(),
  odataType: varchar('odata_type', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  platformType: policyPlatformTypeEnum('platform_type').notNull().default('unknown'),
  profileType: varchar('profile_type', { length: 100 }),
  version: integer('version'),
  createdDateTime: timestamp('created_date_time'),
  modifiedDateTime: timestamp('modified_date_time'),
  assignmentCount: integer('assignment_count'),
  isAssigned: boolean('is_assigned').default(false),
  lastModifiedDateTime: timestamp('last_modified_date_time'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const deviceConfigurationProfilesRelations = relations(device_configuration_profiles, ({ many }) => ({
  deviceStates: many(device_configuration_profile_states),
}));

// ============================================================================
// DEVICE CONFIGURATION PROFILE STATES TABLE - Per-device config state
// ============================================================================

export const device_configuration_profile_states = pgTable('device_configuration_profile_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  profileId: varchar('profile_id', { length: 255 }).references(() => device_configuration_profiles.id, { onDelete: 'cascade' }),
  profileName: varchar('profile_name', { length: 255 }),
  platformType: policyPlatformTypeEnum('platform_type').notNull().default('unknown'),
  state: varchar('state', { length: 50 }),
  stateDetail: text('state_detail'),
  errorCode: integer('error_code'),
  errorDescription: text('error_description'),
  reportedDateTime: timestamp('reported_date_time').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  deviceProfileUnique: unique().on(table.deviceId, table.profileId),
}));

export const deviceConfigurationProfileStatesRelations = relations(device_configuration_profile_states, ({ one }) => ({
  device: one(devices, {
    fields: [device_configuration_profile_states.deviceId],
    references: [devices.id],
  }),
  profile: one(device_configuration_profiles, {
    fields: [device_configuration_profile_states.profileId],
    references: [device_configuration_profiles.id],
  }),
}));

// ============================================================================
// DEVICE CONDITIONAL ACCESS TABLE - Device to CA policy mapping
// ============================================================================

export const device_conditional_access = pgTable('device_conditional_access', {
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  policyId: varchar('policy_id', { length: 255 }).references(() => conditional_access_policies.id, { onDelete: 'cascade' }),
  isCompliant: boolean('is_compliant'),
  enforced: boolean('enforced'),
  sessionTokenIssued: boolean('session_token_issued'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.deviceId, table.policyId] }),
}));

export const deviceConditionalAccessRelations = relations(device_conditional_access, ({ one }) => ({
  device: one(devices, {
    fields: [device_conditional_access.deviceId],
    references: [devices.id],
  }),
  policy: one(conditional_access_policies, {
    fields: [device_conditional_access.policyId],
    references: [conditional_access_policies.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS (Generated by Drizzle)
// ============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;

export type ComplianceHistory = typeof complianceHistory.$inferSelect;
export type NewComplianceHistory = typeof complianceHistory.$inferInsert;

export type StorageHistory = typeof storageHistory.$inferSelect;
export type NewStorageHistory = typeof storageHistory.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type DeviceGroup = typeof device_groups.$inferSelect;
export type NewDeviceGroup = typeof device_groups.$inferInsert;

export type UserLicense = typeof user_licenses.$inferSelect;
export type NewUserLicense = typeof user_licenses.$inferInsert;

export type UserDevice = typeof user_devices.$inferSelect;
export type NewUserDevice = typeof user_devices.$inferInsert;

export type DeviceAnalytics = typeof device_analytics.$inferSelect;
export type NewDeviceAnalytics = typeof device_analytics.$inferInsert;

export type DeviceWarranty = typeof device_warranty.$inferSelect;
export type NewDeviceWarranty = typeof device_warranty.$inferInsert;

export type ConditionalAccessPolicy = typeof conditional_access_policies.$inferSelect;
export type NewConditionalAccessPolicy = typeof conditional_access_policies.$inferInsert;

export type NamedLocation = typeof named_locations.$inferSelect;
export type NewNamedLocation = typeof named_locations.$inferInsert;

export type DeviceCompliancePolicy = typeof device_compliance_policies.$inferSelect;
export type NewDeviceCompliancePolicy = typeof device_compliance_policies.$inferInsert;

export type DeviceCompliancePolicyState = typeof device_compliance_policy_states.$inferSelect;
export type NewDeviceCompliancePolicyState = typeof device_compliance_policy_states.$inferInsert;

export type DeviceConfigurationProfile = typeof device_configuration_profiles.$inferSelect;
export type NewDeviceConfigurationProfile = typeof device_configuration_profiles.$inferInsert;

export type DeviceConfigurationProfileState = typeof device_configuration_profile_states.$inferSelect;
export type NewDeviceConfigurationProfileState = typeof device_configuration_profile_states.$inferInsert;

export type DeviceConditionalAccess = typeof device_conditional_access.$inferSelect;
export type NewDeviceConditionalAccess = typeof device_conditional_access.$inferInsert;

// ============================================================================
// ENUMS FOR RECOMMENDATIONS
// ============================================================================
export const recommendationSeverityEnum = pgEnum('recommendation_severity', ['critical', 'high', 'medium', 'low']);
export const recommendationCategoryEnum = pgEnum('recommendation_category', ['security', 'compliance', 'performance', 'maintenance', 'license']);
export const recommendationStatusEnum = pgEnum('recommendation_status', ['active', 'acknowledged', 'resolved', 'dismissed']);

// ============================================================================
// FLEET_RECOMMENDATIONS TABLE - Intelligent recommendations for fleet health
// ============================================================================
export const fleetRecommendations = pgTable('fleet_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Recommendation details
  severity: recommendationSeverityEnum('severity').notNull(),
  category: recommendationCategoryEnum('category').notNull(),
  status: recommendationStatusEnum('status').notNull().default('active'),
  
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  recommendationType: varchar('recommendation_type', { length: 100 }).notNull(),
  ruleId: varchar('rule_id', { length: 100 }).notNull(),
  
  // Action fields
  actionUrl: varchar('action_url', { length: 500 }),
  actionLabel: varchar('action_label', { length: 100 }),
  
  // Metadata
  deviceName: varchar('device_name', { length: 255 }),
  deviceSerialNumber: varchar('device_serial_number', { length: 255 }),
  userEmail: varchar('user_email', { length: 255 }),
  
  // Priority score (calculated)
  priorityScore: integer('priority_score'),
  
  // Timestamps
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  recommendationDeviceIdIdx: index('idx_recommendation_device_id').on(table.deviceId),
  recommendationSeverityIdx: index('idx_recommendation_severity').on(table.severity),
  recommendationCategoryIdx: index('idx_recommendation_category').on(table.category),
  recommendationStatusIdx: index('idx_recommendation_status').on(table.status),
  recommendationCreatedAtIdx: index('idx_recommendation_created_at').on(table.createdAt),
}));

export const fleetRecommendationsRelations = relations(fleetRecommendations, ({ one }) => ({
  device: one(devices, {
    fields: [fleetRecommendations.deviceId],
    references: [devices.id],
  }),
  user: one(users, {
    fields: [fleetRecommendations.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// RECOMMENDATION_SETTINGS TABLE - Configurable thresholds
// ============================================================================
export const recommendationSettings = pgTable('recommendation_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  ruleId: varchar('rule_id', { length: 100 }).notNull().unique(),
  category: recommendationCategoryEnum('category').notNull(),
  severity: recommendationSeverityEnum('severity').notNull(),
  
  enabled: boolean('enabled').notNull().default(true),
  threshold: jsonb('threshold'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const recommendationSettingsRelations = relations(recommendationSettings, ({}) => ({}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type FleetRecommendation = typeof fleetRecommendations.$inferSelect;
export type NewFleetRecommendation = typeof fleetRecommendations.$inferInsert;

export type RecommendationSetting = typeof recommendationSettings.$inferSelect;
export type NewRecommendationSetting = typeof recommendationSettings.$inferInsert;
