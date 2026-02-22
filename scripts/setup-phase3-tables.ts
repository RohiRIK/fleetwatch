/**
 * Phase 3 Table Setup Script
 * 
 * Creates all 5 new tables for Issue #56:
 * - device_groups
 * - user_licenses  
 * - user_devices
 * - device_analytics
 * - device_warranty
 * 
 * Run with: bun run scripts/setup-phase3-tables.ts
 */

import { db } from '../lib/db/drizzle';
import { sql } from 'drizzle-orm';

const CREATE_ENUMS = `
  DO $$ BEGIN
    CREATE TYPE warranty_status AS ENUM('active', 'expired', 'unknown');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE group_type AS ENUM('security', 'microsoft_365', 'distribution', 'mail_enabled_security');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE license_status AS ENUM('enabled', 'warning', 'suspended', 'deleted');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE policy_state AS ENUM('enabled', 'disabled', 'enabledForReportingButNotEnforced');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE policy_platform_type AS ENUM('android', 'iOS', 'windows', 'macOS', 'linux', 'unknown');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE named_location_type AS ENUM('ip', 'country');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;
`;

const CREATE_DEVICE_GROUPS = `
  CREATE TABLE IF NOT EXISTS device_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    group_id VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    group_type group_type DEFAULT 'security' NOT NULL,
    description TEXT,
    is_dynamic BOOLEAN DEFAULT false,
    membership_rule TEXT,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    CONSTRAINT device_groups_device_id_group_id_unique UNIQUE(device_id, group_id)
  );
`;

const CREATE_USER_LICENSES = `
  CREATE TABLE IF NOT EXISTS user_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku_id VARCHAR(255) NOT NULL,
    sku_part_number VARCHAR(255) NOT NULL,
    sku_name VARCHAR(255),
    capability_status license_status DEFAULT 'enabled' NOT NULL,
    service_plans JSONB,
    prepaid_units_enabled INTEGER,
    prepaid_units_suspended INTEGER,
    prepaid_units_warning INTEGER,
    consumed_units INTEGER,
    assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    CONSTRAINT user_licenses_user_id_sku_id_unique UNIQUE(user_id, sku_id)
  );
`;

const CREATE_USER_DEVICES = `
  CREATE TABLE IF NOT EXISTS user_devices (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP,
    relationship_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    PRIMARY KEY(user_id, device_id)
  );
`;

const CREATE_DEVICE_ANALYTICS = `
  CREATE TABLE IF NOT EXISTS device_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
    overall_score INTEGER,
    startup_score INTEGER,
    app_reliability_score INTEGER,
    battery_score INTEGER,
    work_from_anywhere_score INTEGER,
    core_boot_time_ms INTEGER,
    core_login_time_ms INTEGER,
    responsive_desktop_time_ms INTEGER,
    restart_count INTEGER,
    blue_screen_count INTEGER,
    mean_time_to_failure_minutes INTEGER,
    health_status VARCHAR(50),
    disk_type VARCHAR(50),
    model_performance JSONB,
    raw_analytics JSONB,
    recorded_at TIMESTAMP DEFAULT now() NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_DEVICE_WARRANTY = `
  CREATE TABLE IF NOT EXISTS device_warranty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
    status warranty_status DEFAULT 'unknown' NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    days_remaining INTEGER,
    in_warranty BOOLEAN DEFAULT false,
    vendor VARCHAR(255),
    warranty_type VARCHAR(100),
    coverage_type VARCHAR(100),
    description TEXT,
    serial_number VARCHAR(255),
    raw_warranty_data JSONB,
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_CONDITIONAL_ACCESS_POLICIES = `
  CREATE TABLE IF NOT EXISTS conditional_access_policies (
    id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    state policy_state DEFAULT 'disabled' NOT NULL,
    created_date_time TIMESTAMP,
    modified_date_time TIMESTAMP,
    conditions JSONB,
    grant_controls JSONB,
    session_controls JSONB,
    is_enabled BOOLEAN DEFAULT false,
    is_report_only BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_NAMED_LOCATIONS = `
  CREATE TABLE IF NOT EXISTS named_locations (
    id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    location_type named_location_type NOT NULL,
    is_trusted BOOLEAN DEFAULT false,
    ip_ranges JSONB,
    countries_and_regions JSONB,
    include_unknown_countries_and_regions BOOLEAN,
    created_date_time TIMESTAMP,
    modified_date_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_DEVICE_COMPLIANCE_POLICIES = `
  CREATE TABLE IF NOT EXISTS device_compliance_policies (
    id VARCHAR(255) PRIMARY KEY,
    odata_type VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    platform_type policy_platform_type DEFAULT 'unknown' NOT NULL,
    version INTEGER,
    created_date_time TIMESTAMP,
    modified_date_time TIMESTAMP,
    setting_count INTEGER,
    priority INTEGER,
    is_assigned BOOLEAN DEFAULT false,
    assignment_count INTEGER,
    device_compliance_setting_state_summaries JSONB,
    scheduled_actions_for_rule JSONB,
    raw_policy_data JSONB,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_DEVICE_COMPLIANCE_POLICY_STATES = `
  CREATE TABLE IF NOT EXISTS device_compliance_policy_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    policy_id VARCHAR(255) REFERENCES device_compliance_policies(id) ON DELETE CASCADE,
    policy_name VARCHAR(255),
    platform_type policy_platform_type DEFAULT 'unknown' NOT NULL,
    state VARCHAR(50),
    error_code INTEGER,
    error_description TEXT,
    last_reported_date_time TIMESTAMP,
    compliance_grace_period_expiration_date_time TIMESTAMP,
    reported_date_time TIMESTAMP DEFAULT now() NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    CONSTRAINT device_compliance_policy_states_device_id_policy_id_unique UNIQUE(device_id, policy_id)
  );
`;

const CREATE_DEVICE_CONFIGURATION_PROFILES = `
  CREATE TABLE IF NOT EXISTS device_configuration_profiles (
    id VARCHAR(255) PRIMARY KEY,
    odata_type VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    platform_type policy_platform_type DEFAULT 'unknown' NOT NULL,
    profile_type VARCHAR(100),
    version INTEGER,
    created_date_time TIMESTAMP,
    modified_date_time TIMESTAMP,
    assignment_count INTEGER,
    is_assigned BOOLEAN DEFAULT false,
    last_modified_date_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
  );
`;

const CREATE_DEVICE_CONFIGURATION_PROFILE_STATES = `
  CREATE TABLE IF NOT EXISTS device_configuration_profile_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    profile_id VARCHAR(255) REFERENCES device_configuration_profiles(id) ON DELETE CASCADE,
    profile_name VARCHAR(255),
    platform_type policy_platform_type DEFAULT 'unknown' NOT NULL,
    state VARCHAR(50),
    state_detail TEXT,
    error_code INTEGER,
    error_description TEXT,
    reported_date_time TIMESTAMP DEFAULT now() NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    CONSTRAINT device_configuration_profile_states_device_id_profile_id_unique UNIQUE(device_id, profile_id)
  );
`;

const CREATE_DEVICE_CONDITIONAL_ACCESS = `
  CREATE TABLE IF NOT EXISTS device_conditional_access (
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    policy_id VARCHAR(255) REFERENCES conditional_access_policies(id) ON DELETE CASCADE,
    is_compliant BOOLEAN,
    enforced BOOLEAN,
    session_token_issued BOOLEAN,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    PRIMARY KEY(device_id, policy_id)
  );
`;

async function setupPhase3Tables() {
  console.log('🚀 Setting up Phase 3 tables...\n');

  try {
    console.log('📦 Creating enums...');
    await db.execute(sql.raw(CREATE_ENUMS));
    console.log('  ✅ Enums created\n');

    console.log('📦 Creating device_groups table...');
    await db.execute(sql.raw(CREATE_DEVICE_GROUPS));
    console.log('  ✅ device_groups created\n');

    console.log('📦 Creating user_licenses table...');
    await db.execute(sql.raw(CREATE_USER_LICENSES));
    console.log('  ✅ user_licenses created\n');

    console.log('📦 Creating user_devices table...');
    await db.execute(sql.raw(CREATE_USER_DEVICES));
    console.log('  ✅ user_devices created\n');

    console.log('📦 Creating device_analytics table...');
    await db.execute(sql.raw(CREATE_DEVICE_ANALYTICS));
    console.log('  ✅ device_analytics created\n');

    console.log('📦 Creating device_warranty table...');
    await db.execute(sql.raw(CREATE_DEVICE_WARRANTY));
    console.log('  ✅ device_warranty created\n');

    console.log('📦 Creating conditional_access_policies table...');
    await db.execute(sql.raw(CREATE_CONDITIONAL_ACCESS_POLICIES));
    console.log('  ✅ conditional_access_policies created\n');

    console.log('📦 Creating named_locations table...');
    await db.execute(sql.raw(CREATE_NAMED_LOCATIONS));
    console.log('  ✅ named_locations created\n');

    console.log('📦 Creating device_compliance_policies table...');
    await db.execute(sql.raw(CREATE_DEVICE_COMPLIANCE_POLICIES));
    console.log('  ✅ device_compliance_policies created\n');

    console.log('📦 Creating device_compliance_policy_states table...');
    await db.execute(sql.raw(CREATE_DEVICE_COMPLIANCE_POLICY_STATES));
    console.log('  ✅ device_compliance_policy_states created\n');

    console.log('📦 Creating device_configuration_profiles table...');
    await db.execute(sql.raw(CREATE_DEVICE_CONFIGURATION_PROFILES));
    console.log('  ✅ device_configuration_profiles created\n');

    console.log('📦 Creating device_configuration_profile_states table...');
    await db.execute(sql.raw(CREATE_DEVICE_CONFIGURATION_PROFILE_STATES));
    console.log('  ✅ device_configuration_profile_states created\n');

    console.log('📦 Creating device_conditional_access table...');
    await db.execute(sql.raw(CREATE_DEVICE_CONDITIONAL_ACCESS));
    console.log('  ✅ device_conditional_access created\n');

    console.log('✅ Phase 3 tables setup complete!\n');
    console.log('Tables created:');
    console.log('  - device_groups (10 columns)');
    console.log('  - user_licenses (14 columns)');
    console.log('  - user_devices (6 columns)');
    console.log('  - device_analytics (20 columns)');
    console.log('  - device_warranty (16 columns)');
    console.log('  - conditional_access_policies (15 columns)');
    console.log('  - named_locations (13 columns)');
    console.log('  - device_compliance_policies (17 columns)');
    console.log('  - device_compliance_policy_states (14 columns)');
    console.log('  - device_configuration_profiles (14 columns)');
    console.log('  - device_configuration_profile_states (11 columns)');
    console.log('  - device_conditional_access (6 columns)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up tables:', error);
    process.exit(1);
  }
}

setupPhase3Tables();
