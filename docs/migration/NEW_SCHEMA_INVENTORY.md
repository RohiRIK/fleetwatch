# FleetWatch Current Schema Inventory

**Generated:** 2025-02-10  
**Source:** `/lib/db/schema.ts` (353 lines)  
**Database:** PostgreSQL with Drizzle ORM

---

## Executive Summary

- **Total Tables:** 11
- **Total Flat Columns (Devices):** 51
- **Total JSONB Columns (Devices):** 17
- **Total Flat Columns (Users):** 14
- **Enums:** 2 (team_role, user_role)

---

## 1. DEVICES TABLE

### 1.1 Flat Columns (HOT Data - Frequently Queried) [51 columns]

#### Core Identity [5 columns]
| Column | Type | Nullable | Unique | Description |
|--------|------|----------|--------|-------------|
| `id` | UUID | No | Yes (PK) | Internal primary key |
| `azureId` | VARCHAR(255) | No | Yes | Microsoft Graph device ID |
| `azureAdDeviceId` | VARCHAR(255) | Yes | No | Azure AD device registration ID |
| `deviceName` | VARCHAR(255) | No | No | Device hostname |
| `serialNumber` | VARCHAR(255) | Yes | Yes | Hardware serial number |
| `userId` | UUID | Yes | No | FK to users table |

#### Basic Device Info [4 columns]
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `manufacturer` | VARCHAR(100) | Yes | Dell, Apple, Lenovo, etc. |
| `model` | VARCHAR(100) | Yes | Latitude 7420, MacBook Pro, etc. |
| `operatingSystem` | VARCHAR(50) | Yes | Windows, iOS, Android, macOS |
| `osVersion` | VARCHAR(100) | Yes | 10.0.19045, 16.3.1, etc. |

#### Enrollment Info [5 columns]
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `joinType` | VARCHAR(50) | Yes | AzureADJoined, Hybrid, AzureADRegistered |
| `enrollmentType` | VARCHAR(50) | Yes | UserEnrollment, DeviceEnrollment, etc. |
| `managementState` | VARCHAR(50) | Yes | Managed, Unmanaged |
| `managedDeviceOwnerType` | VARCHAR(50) | Yes | Company, Personal |
| `enrolledAt` | TIMESTAMP | Yes | Enrollment timestamp |

#### Compliance & Security [5 columns] ⚡ HIGH QUERY FREQUENCY
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `isCompliant` | BOOLEAN | No | false | Overall compliance state |
| `complianceState` | VARCHAR(50) | Yes | - | Detailed compliance status |
| `isEncrypted` | BOOLEAN | No | false | Device encryption enabled |
| `isSupervised` | BOOLEAN | No | false | iOS supervised mode |
| `jailBroken` | VARCHAR(50) | Yes | - | Jailbreak/root detection status |

#### User Info [4 columns] (Denormalized for performance)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `userPrincipalName` | VARCHAR(255) | Yes | user@domain.com |
| `userDisplayName` | VARCHAR(255) | Yes | John Doe |
| `userEmail` | VARCHAR(255) | Yes | john.doe@company.com |
| `userDepartment` | VARCHAR(255) | Yes | Engineering, Sales, etc. |

#### Hardware [5 columns] (Commonly queried for alerts/reports)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `storageTotal` | BIGINT | Yes | Total storage in bytes |
| `storageFree` | BIGINT | Yes | Free storage in bytes |
| `memoryTotal` | BIGINT | Yes | Total RAM in bytes |
| `batteryHealth` | INTEGER | Yes | Battery health percentage (0-100) |
| `chassisType` | VARCHAR(50) | Yes | Laptop, Desktop, Tablet, Phone |

#### Network [3 columns] (Commonly queried for filtering)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `ipAddressV4` | VARCHAR(45) | Yes | IPv4 address |
| `wifiMac` | VARCHAR(17) | Yes | WiFi MAC address |
| `ethernetMac` | VARCHAR(17) | Yes | Ethernet MAC address |

#### Timestamps [4 columns]
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `lastSyncAt` | TIMESTAMP | Yes | - | Last successful sync with Graph API |
| `createdAt` | TIMESTAMP | No | NOW() | Record creation timestamp |
| `updatedAt` | TIMESTAMP | No | NOW() | Last update timestamp |
| `deletedAt` | TIMESTAMP | Yes | - | Soft delete timestamp |

---

### 1.2 JSONB Columns (COLD Data - Complex Nested) [17 columns]

| Column | Purpose | Est. Size | Query Frequency | Notes |
|--------|---------|-----------|-----------------|-------|
| `rawDeviceData` | Full Graph API `/managedDevices/{id}` response | ~5-10 KB | Low | **Audit trail** - complete data snapshot |
| `hardwareDetails` | IMEI, MEID, Device Guard, battery serial, resident users, FQDN | ~1-2 KB | Low | Extracted from `hardwareInformation` |
| `networkDetails` | IPv6, subnet, full network config | ~500 B | Low | Extracted from `networkInformation` |
| `complianceDetails` | Compliance policies, settings, failures, grace period | ~2-5 KB | Medium | **Important** - detailed policy violations |
| `configurationDetails` | Configuration profiles, deployment status | ~2-5 KB | Medium | **Important** - config assignments |
| `securityDetails` | Defender status, BitLocker, TPM, Secure Boot, malware | ~1-2 KB | Medium | **Important** - security posture |
| `autopilotDetails` | Autopilot enrollment, profile, group tag | ~500 B | Low | Windows only |
| `exchangeActivesyncDetails` | EAS activation, device ID, last sync, access state | ~300 B | Low | Legacy email sync |
| `lostModeDetails` | Lost mode state, message, phone, footnote | ~200 B | Low | iOS only |
| `malwareDetails` | Active malware count, remediated count | ~100 B | Medium | Windows Defender data |
| `actionsHistory` | Recent device actions (wipe, lock, retire, sync) | ~1-3 KB | Low | Audit trail for admin actions |
| `organizationDetails` | Azure AD groups, device categories, role scope tags | ~500 B | Low | Organizational metadata |
| `analyticsDetails` | Endpoint Analytics scores (startup, reliability, battery) | ~1-2 KB | Low | Performance metrics |
| `crashesDetails` | App crashes, hangs, error codes | ~1-3 KB | Low | Troubleshooting data |
| `warrantyDetails` | Warranty status, start/end dates, vendor | ~200 B | Low | Hardware warranty |
| `conditionalAccessDetails` | CA policies, locations, registration state | ~1-2 KB | Medium | **Important** - access control |
| `detectedAppsDetails` | Installed applications list | ~5-10 KB | Low | Full app inventory |
| `dataQuality` | Metadata tracking which JSONB fields are populated | ~500 B | Low | Data completeness tracking |
| `ingestionMetadata` | Sync timestamps, source, version, errors | ~300 B | Low | ETL metadata |

**Total Estimated JSONB Storage:** ~20-40 KB per device

---

### 1.3 Missing Columns (Gaps vs Legacy Schema)

Based on comparison with legacy `device.schema.ts` (1,124 lines):

#### HIGH PRIORITY (Should Add as Flat Columns)
- ❌ `complianceGracePeriodExpiration` (TIMESTAMP) - Grace period before non-compliance action
- ❌ `partnerReportedThreatState` (VARCHAR) - Third-party security vendor status
- ❌ `notes` (TEXT) - Admin notes/comments on device
- ❌ `imei` (VARCHAR) - Mobile device IMEI (currently in hardwareDetails JSONB)
- ❌ `phoneNumber` (VARCHAR) - Mobile device phone number (currently in hardwareDetails JSONB)

#### MEDIUM PRIORITY (Already in JSONB, but may want flat)
- 🟡 `activeMalwareCount` (INTEGER) - Currently in malwareDetails JSONB
- 🟡 `easActivated` (BOOLEAN) - Exchange ActiveSync status (currently in exchangeActivesyncDetails)
- 🟡 `autopilotEnrolled` (BOOLEAN) - Autopilot status (currently in autopilotDetails)

#### LOW PRIORITY (JSONB is fine)
- ⚪ `trends` object - Time-series data (better in time-series DB)
- ⚪ Full `user` object - Denormalized from users table (we already have key fields)

---

## 2. USERS TABLE [14 columns]

### 2.1 Flat Columns

| Column | Type | Nullable | Unique | Description |
|--------|------|----------|--------|-------------|
| `id` | UUID | No | Yes (PK) | Internal primary key |
| `email` | VARCHAR(255) | No | Yes | User email (login) |
| `name` | VARCHAR(255) | No | No | Full name |
| `displayName` | VARCHAR(255) | Yes | No | Display name |
| `jobTitle` | VARCHAR(255) | Yes | No | Job title |
| `department` | VARCHAR(255) | Yes | No | Department |
| `azureId` | VARCHAR(255) | Yes | Yes | Microsoft Graph user ID |
| `passwordHash` | VARCHAR(255) | Yes | No | Emergency admin fallback |
| `role` | ENUM | No | No | VIEWER, ADMIN, SUPERADMIN |
| `emailVerified` | TIMESTAMP | Yes | No | Email verification timestamp |
| `image` | VARCHAR(1024) | Yes | No | Profile image URL |
| `createdAt` | TIMESTAMP | No | No | Record creation timestamp |
| `updatedAt` | TIMESTAMP | No | No | Last update timestamp |

### 2.2 Missing Columns (Gaps vs Legacy Schema)

Based on comparison with legacy `user.schema.ts` (321 lines):

#### HIGH PRIORITY (User Profile Data)
- ❌ `surname` (VARCHAR) - Last name
- ❌ `givenName` (VARCHAR) - First name
- ❌ `mail` (VARCHAR) - Primary email (different from login email)
- ❌ `mobilePhone` (VARCHAR) - Mobile number
- ❌ `businessPhones` (JSONB) - Business phone numbers array
- ❌ `officeLocation` (VARCHAR) - Office location
- ❌ `employeeId` (VARCHAR) - Employee ID
- ❌ `employeeType` (VARCHAR) - Employee type (FTE, Contractor, etc.)
- ❌ `companyName` (VARCHAR) - Company name
- ❌ `userType` (VARCHAR) - Member, Guest
- ❌ `usageLocation` (VARCHAR) - Country/region code

#### MEDIUM PRIORITY (Account Status)
- ❌ `enabled` (BOOLEAN) - Account enabled status
- ❌ `accountCreatedDateTime` (TIMESTAMP) - Azure AD account creation
- ❌ `onPremisesSyncEnabled` (BOOLEAN) - Hybrid AD sync status

#### LOW PRIORITY (Can be JSONB)
- ⚪ `licenses` object - License assignments (separate table may be better)
- ⚪ `devices` summary - Computed from devices table
- ⚪ `analytics` object - User-level endpoint analytics
- ⚪ `signInActivity` object - Sign-in logs (separate table may be better)

---

## 3. SUPPORTING TABLES

### 3.1 COMPLIANCE_HISTORY [5 columns]
Time-series compliance state tracking

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `deviceId` | UUID | No | FK to devices |
| `isCompliant` | BOOLEAN | No | Compliance state |
| `complianceState` | VARCHAR(50) | Yes | Detailed state |
| `policyFailures` | JSONB | Yes | Failed policies array |
| `recordedAt` | TIMESTAMP | No | Snapshot timestamp |

**Purpose:** Track compliance changes over time for trending/alerts

---

### 3.2 STORAGE_HISTORY [6 columns]
Time-series storage utilization tracking

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `deviceId` | UUID | No | FK to devices |
| `storageTotal` | BIGINT | Yes | Total storage |
| `storageFree` | BIGINT | Yes | Free storage |
| `storageUsed` | BIGINT | Yes | Used storage |
| `utilizationPercent` | INTEGER | Yes | Calculated percentage |
| `recordedAt` | TIMESTAMP | No | Snapshot timestamp |

**Purpose:** Track storage trends for capacity planning

---

### 3.3 ACTIVITY_LOGS [7 columns]
User activity audit trail

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `userId` | UUID | Yes | FK to users |
| `action` | VARCHAR(100) | No | Action performed |
| `entityType` | VARCHAR(50) | No | devices, users, settings, etc. |
| `entityId` | UUID | No | Target entity ID |
| `metadata` | JSONB | Yes | Additional context |
| `ipAddress` | VARCHAR(45) | Yes | Source IP |
| `createdAt` | TIMESTAMP | No | Action timestamp |

**Purpose:** Security audit trail for compliance

---

### 3.4 SYNC_LOGS [7 columns]
Data sync monitoring

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Primary key |
| `syncType` | VARCHAR(50) | No | devices, users, policies, etc. |
| `recordsSynced` | INTEGER | No | Success count |
| `recordsFailed` | INTEGER | No | Failure count |
| `errorMessage` | TEXT | Yes | Error details |
| `durationMs` | INTEGER | Yes | Sync duration |
| `startedAt` | TIMESTAMP | No | Start time |
| `completedAt` | TIMESTAMP | Yes | End time |

**Purpose:** Monitor sync health and performance

---

### 3.5 SETTINGS [9 columns]
Application configuration storage

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | TEXT | No | PK (e.g., 'sync.schedule') |
| `category` | VARCHAR(50) | No | sync, notifications, azure, system |
| `key` | VARCHAR(100) | No | Setting key |
| `value` | JSONB | No | Setting value |
| `encrypted` | BOOLEAN | No | Is encrypted |
| `description` | TEXT | Yes | Human-readable description |
| `defaultValue` | JSONB | Yes | Default value |
| `updatedBy` | UUID | Yes | FK to users |
| `updatedAt` | TIMESTAMP | No | Last update |
| `createdAt` | TIMESTAMP | No | Creation timestamp |

**Purpose:** Flexible app configuration with encryption support

---

### 3.6 NextAuth.js Tables (3 tables)
Authentication framework tables (not device-management specific)

- **accounts** [12 columns] - OAuth provider links
- **sessions** [4 columns] - Active user sessions
- **verification_tokens** [3 columns] - Email verification

---

### 3.7 Multi-tenancy Tables (2 tables)
From SaaS template (may not be needed for single-tenant deployments)

- **teams** [4 columns] - Team/organization containers
- **team_members** [5 columns] - Team membership

---

## 4. INDEXES & PERFORMANCE

### 4.1 Current Indexes (from migrations)

**devices table:**
- Primary key: `id`
- Unique constraints: `azureId`, `serialNumber`
- Foreign key index: `userId`
- **MISSING:** Indexes on commonly filtered columns:
  - ❌ `isCompliant` (high query frequency)
  - ❌ `operatingSystem` (common filter)
  - ❌ `complianceState` (common filter)
  - ❌ `lastSyncAt` (for finding stale devices)
  - ❌ Composite: `(userId, isCompliant)` (common join + filter)

**users table:**
- Primary key: `id`
- Unique constraints: `email`, `azureId`
- **MISSING:** Index on `department` (for org charts/filters)

### 4.2 JSONB Indexes (MISSING)

Should add GIN indexes for JSONB columns that are queried:
- ❌ `complianceDetails` (for searching policy violations)
- ❌ `securityDetails` (for security posture queries)
- ❌ `detectedAppsDetails` (for app inventory searches)

---

## 5. DATA QUALITY ASSESSMENT

### 5.1 Well-Designed Aspects ✅

1. **Flat/JSONB Separation**: Clear separation between hot (frequently queried) and cold (rarely queried) data
2. **Denormalization**: User info denormalized in devices table for performance
3. **Audit Trails**: Activity logs and sync logs for compliance
4. **Time-Series Tables**: Dedicated tables for compliance and storage history
5. **Soft Deletes**: `deletedAt` column for data retention
6. **Metadata Tracking**: `dataQuality` and `ingestionMetadata` for observability

### 5.2 Areas for Improvement 🔧

1. **Missing Indexes**: Need indexes on frequently filtered columns
2. **Incomplete User Schema**: Missing many Graph API user properties
3. **JSONB Structure**: No defined TypeScript interfaces for JSONB columns (makes querying hard)
4. **Flat Column Candidates**: Some JSONB data should be flat (e.g., IMEI, malware count)
5. **No License Table**: User licenses should be a separate table
6. **No Policies Tables**: Configuration/compliance policies should be separate tables (not just JSONB)

---

## 6. STORAGE ESTIMATES

### Per Device (assuming 1,000 devices)
- **Flat columns:** ~500 bytes
- **JSONB columns:** ~30 KB
- **Total per device:** ~30.5 KB

**1,000 devices = ~30 MB** (very efficient!)

### Per User (assuming 1,000 users)
- **Flat columns:** ~300 bytes
- **Total per user:** ~300 bytes

**1,000 users = ~300 KB**

### History Tables (1 year retention)
- **compliance_history:** ~1 snapshot/day = ~365 rows/device = ~200 KB/device/year
- **storage_history:** ~1 snapshot/day = ~365 rows/device = ~150 KB/device/year

**1,000 devices over 1 year = ~350 MB history**

---

## 7. SUMMARY & RECOMMENDATIONS

### ✅ Strengths
- Well-structured schema with clear hot/cold data separation
- Comprehensive JSONB storage for full Graph API data
- Good audit trail and monitoring tables
- Efficient storage usage

### 🔧 Improvements Needed

#### Phase 1: Add Missing Indexes (1-2 hours)
```sql
-- Devices table
CREATE INDEX idx_devices_is_compliant ON devices(is_compliant);
CREATE INDEX idx_devices_operating_system ON devices(operating_system);
CREATE INDEX idx_devices_compliance_state ON devices(compliance_state);
CREATE INDEX idx_devices_last_sync_at ON devices(last_sync_at);
CREATE INDEX idx_devices_user_compliance ON devices(user_id, is_compliant);

-- JSONB indexes
CREATE INDEX idx_devices_compliance_details ON devices USING GIN(compliance_details);
CREATE INDEX idx_devices_security_details ON devices USING GIN(security_details);
CREATE INDEX idx_devices_detected_apps ON devices USING GIN(detected_apps_details);
```

#### Phase 2: Add Missing Flat Columns (2-3 hours)
- Add `complianceGracePeriodExpiration`, `partnerReportedThreatState`, `notes`, `imei`, `phoneNumber` to devices
- Add user profile fields (`surname`, `givenName`, `mobilePhone`, `officeLocation`, etc.) to users

#### Phase 3: Create JSONB Type Definitions (2-3 hours)
- Define TypeScript interfaces for each JSONB column
- Add JSON Schema validation for JSONB inserts

#### Phase 4: Consider Separate Policy Tables (8-12 hours)
- Extract `complianceDetails` and `configurationDetails` into dedicated tables
- Improves queryability and allows for policy versioning

---

**Next Steps:**
1. Review this inventory with stakeholders
2. Proceed to Phase 1.2: Audit Current API Endpoints
3. Compare with legacy schema to identify additional gaps
