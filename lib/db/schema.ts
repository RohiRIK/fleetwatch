import { pgTable, uuid, varchar, text, boolean, bigint, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
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
  
  // ========== TIMESTAMPS ==========
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
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
