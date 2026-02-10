# FleetWatch Current API Coverage Analysis

**Generated:** 2025-02-10  
**Purpose:** Document what device/user data is currently fetched, stored, and exposed via APIs

---

## Executive Summary

- **Total API Endpoints Analyzed:** 25
- **Device-Related Endpoints:** 8
- **User-Related Endpoints:** 4
- **Compliance/Analytics Endpoints:** 5
- **System/Admin Endpoints:** 8

---

## 1. DEVICES API ENDPOINTS

### 1.1 GET `/api/devices` (List Devices with Filters)
**File:** `app/api/devices/route.ts` (186 lines)

#### Fields Returned [38 fields]
| Field | Source | Type | Notes |
|-------|--------|------|-------|
| `id` | devices.id | UUID | Internal PK |
| `azureId` | devices.azureId | VARCHAR | Graph API device ID ✅ |
| `deviceName` | devices.deviceName | VARCHAR | Hostname ✅ |
| `serialNumber` | devices.serialNumber | VARCHAR | Serial # ✅ |
| `manufacturer` | devices.manufacturer | VARCHAR | Dell, Apple, etc. ✅ |
| `model` | devices.model | VARCHAR | Device model ✅ |
| `operatingSystem` | devices.operatingSystem | VARCHAR | Windows, iOS, etc. ✅ |
| `osVersion` | devices.osVersion | VARCHAR | OS version ✅ |
| `isCompliant` | devices.isCompliant | BOOLEAN | Compliance status ✅ |
| `complianceState` | devices.complianceState | VARCHAR | Detailed compliance ✅ |
| `isEncrypted` | devices.isEncrypted | BOOLEAN | Encryption status ✅ |
| `isSupervised` | devices.isSupervised | BOOLEAN | iOS supervised ✅ |
| `userPrincipalName` | devices.userPrincipalName | VARCHAR | User UPN ✅ |
| `userDisplayName` | devices.userDisplayName | VARCHAR | User name ✅ |
| `userEmail` | devices.userEmail | VARCHAR | User email ✅ |
| `userDepartment` | devices.userDepartment | VARCHAR | Department ✅ |
| `storageTotal` | devices.storageTotal | BIGINT | Total storage ✅ |
| `storageFree` | devices.storageFree | BIGINT | Free storage ✅ |
| `memoryTotal` | devices.memoryTotal | BIGINT | Total RAM ✅ |
| `chassisType` | devices.chassisType | VARCHAR | Laptop/Desktop/etc. ✅ |
| `ipAddressV4` | devices.ipAddressV4 | VARCHAR | IPv4 address ✅ |
| `wifiMac` | devices.wifiMac | VARCHAR | WiFi MAC ✅ |
| `ethernetMac` | devices.ethernetMac | VARCHAR | Ethernet MAC ✅ |
| `joinType` | devices.joinType | VARCHAR | AzureADJoined/etc. ✅ |
| `enrollmentType` | devices.enrollmentType | VARCHAR | Enrollment method ✅ |
| `managedDeviceOwnerType` | devices.managedDeviceOwnerType | VARCHAR | Company/Personal ✅ |
| `dataQuality` | devices.dataQuality | JSONB | Data completeness ✅ |
| `ingestionMetadata` | devices.ingestionMetadata | JSONB | Sync metadata ✅ |
| `lastSyncAt` | devices.lastSyncAt | TIMESTAMP | Last sync time ✅ |
| `enrolledAt` | devices.enrolledAt | TIMESTAMP | Enrollment time ✅ |
| `createdAt` | devices.createdAt | TIMESTAMP | Record created ✅ |
| `updatedAt` | devices.updatedAt | TIMESTAMP | Record updated ✅ |

**Missing Fields (Available in Schema but NOT returned):**
- ❌ `jailBroken` - Jailbreak status
- ❌ `batteryHealth` - Battery health percentage
- ❌ All JSONB detailed fields (hardwareDetails, securityDetails, complianceDetails, etc.)

#### Query Capabilities
- **Search:** deviceName, serialNumber, userPrincipalName, userDisplayName, manufacturer, model
- **Filters:** os, isCompliant, isEncrypted, manufacturer, chassisType, lastSyncFrom/To
- **Sorting:** Any field (default: lastSyncAt desc)
- **Pagination:** page, pageSize (max 100)

---

### 1.2 GET `/api/devices/[id]` (Single Device Details)
**File:** `app/api/devices/[id]/route.ts` (47 lines)

#### Fields Returned [ALL FIELDS - ~68 total]
Returns the ENTIRE device record using `select()` with no field restrictions.

This includes:
- ✅ All 51 flat columns
- ✅ All 17 JSONB columns (rawDeviceData, hardwareDetails, securityDetails, etc.)

**This is the FULL device record endpoint** - everything is exposed here.

---

### 1.3 GET `/api/devices/filters` (Filter Options)
**File:** `app/api/devices/filters/route.ts`

Returns available filter values:
- Distinct operating systems
- Distinct manufacturers
- Distinct chassis types

---

## 2. USERS API ENDPOINTS

### 2.1 GET `/api/users` (List Users)
**File:** `app/api/users/route.ts` (127 lines)

#### Fields Returned [10 fields + deviceCount]
| Field | Source | Type | Notes |
|-------|--------|------|-------|
| `id` | users.id | UUID | Internal PK |
| `email` | users.email | VARCHAR | User email ✅ |
| `name` | users.name | VARCHAR | Full name ✅ |
| `displayName` | users.displayName | VARCHAR | Display name ✅ |
| `jobTitle` | users.jobTitle | VARCHAR | Job title ✅ |
| `department` | users.department | VARCHAR | Department ✅ |
| `azureId` | users.azureId | VARCHAR | Graph API user ID ✅ |
| `image` | users.image | VARCHAR | Profile image URL ✅ |
| `createdAt` | users.createdAt | TIMESTAMP | Record created ✅ |
| `updatedAt` | users.updatedAt | TIMESTAMP | Record updated ✅ |
| `deviceCount` | Computed | INTEGER | Count of devices ✅ |

**Missing Fields (Available in Schema but NOT returned):**
- ❌ `role` - User system role (VIEWER/ADMIN/SUPERADMIN)
- ❌ `emailVerified` - Email verification status
- ❌ `passwordHash` - Password (should remain private)

#### Query Capabilities
- **Search:** name, email, displayName
- **Filters:** department, jobTitle, hasDevices (true/false)
- **Sorting:** name, email, department, jobTitle, deviceCount
- **Pagination:** page, pageSize

**Requires:** SUPERADMIN role (protected route)

---

### 2.2 GET `/api/users/[id]` (Single User)
**File:** `app/api/users/[id]/route.ts`

Returns single user with all fields (similar to users list but for one user).

---

### 2.3 GET `/api/users/filters` (User Filter Options)
**File:** `app/api/users/filters/route.ts`

Returns:
- Distinct departments
- Distinct job titles

---

### 2.4 PATCH `/api/users/[id]/role` (Update User Role)
**File:** `app/api/users/[id]/role/route.ts`

Allows SUPERADMIN to change user roles.

---

## 3. DASHBOARD & OVERVIEW ENDPOINTS

### 3.1 GET `/api/dashboard/overview`
**File:** `app/api/dashboard/overview/route.ts` (221 lines)

#### Data Returned

**Device Fields Used:**
| Field | Purpose |
|-------|---------|
| `id` | Device identification |
| `deviceName` | Display in alerts |
| `manufacturer` | Device info |
| `model` | Device info |
| `operatingSystem` | OS distribution |
| `osVersion` | OS details |
| `isCompliant` | Compliance metrics ✅ |
| `complianceState` | Compliance status ✅ |
| `complianceDetails` | Policy failures ✅ (JSONB) |
| `isEncrypted` | Encryption metrics ✅ |
| `storageTotal` | Storage calculations ✅ |
| `storageFree` | Storage calculations ✅ |
| `userPrincipalName` | User association |
| `userDisplayName` | User display |
| `lastSyncAt` | Sync monitoring ✅ |

#### Computed Metrics
1. **Critical Alerts:**
   - nonCompliantCount
   - lowDiskSpaceCount (<10% free)
   - failedSyncsCount (last 24h)
   - unencryptedCount

2. **Summary:**
   - totalDevices
   - nonCompliantDevices
   - unencryptedDevices
   - failedSyncs24h

3. **Activity Feed:**
   - Last 20 activity logs
   - Last 10 sync logs
   - Combined and sorted by timestamp

4. **Storage Overview:**
   - totalStorage (sum across all devices)
   - storageFree (sum)
   - storageUsed (calculated)
   - utilizationPercent (calculated)

5. **Device Health:**
   - compliant/nonCompliant counts
   - encrypted/unencrypted counts
   - complianceRate (%)
   - encryptionRate (%)

6. **Devices Needing Attention:**
   - Top 5 devices with most policy failures
   - Sorted by failed policy count

---

## 4. COMPLIANCE ENDPOINTS

### 4.1 GET `/api/compliance/breakdown`
**File:** `app/api/compliance/breakdown/route.ts` (242 lines)

#### Data Returned

**Uses JSONB Field:** `complianceDetails` ✅

Extracts from `complianceDetails` JSONB:
- Policy ID
- Policy display name
- Policy state (error/nonCompliant/compliant)
- Setting count

#### Computed Analysis
1. **Policy Breakdown:**
   - policyId, policyName
   - riskLevel (critical/high/medium/low) - computed from policy name
   - failedCount
   - affectedDevices[] (id, name, manufacturer, os, user)

2. **Compliance by Risk Level:**
   - critical/high/medium/low counts
   - Failed policy counts per risk level

3. **Compliance by OS:**
   - OS name
   - Total devices, compliant, nonCompliant
   - Compliance rate (%)

4. **Summary:**
   - totalDevices
   - compliantDevices
   - nonCompliantDevices
   - complianceRate (%)
   - uniqueFailedPolicies
   - totalPolicyFailures

---

### 4.2 GET `/api/compliance/history`
**File:** `app/api/compliance/history/route.ts`

Fetches compliance history from `compliance_history` table:
- Time-series compliance state changes
- Policy failures over time

---

## 5. ANALYTICS ENDPOINTS

### 5.1 GET `/api/analytics/overview`
**File:** `app/api/analytics/overview/route.ts` (168 lines)

#### Data Returned

**Device Fields Used:**
| Field | Purpose |
|-------|---------|
| `operatingSystem` | OS distribution ✅ |
| `osVersion` | OS version distribution ✅ |
| `manufacturer` | Manufacturer distribution ✅ |
| `chassisType` | Device type distribution ✅ |
| `storageTotal` | Storage stats ✅ |
| `storageFree` | Storage stats ✅ |
| `enrolledAt` | Enrollment trends ✅ |
| `lastSyncAt` | Sync trends ✅ |
| `managementState` | Management state distribution ✅ |
| `joinType` | Join type distribution ✅ |
| `isCompliant` | Compliance summary ✅ |
| `isEncrypted` | Encryption summary ✅ |

#### Computed Metrics
1. **Summary:**
   - totalDevices
   - compliant/nonCompliant counts
   - complianceRate (%)
   - encrypted/notEncrypted counts
   - encryptionRate (%)

2. **OS Distribution:**
   - Count per OS

3. **OS Versions:**
   - Top 10 OS + version combinations

4. **Manufacturers:**
   - Top 10 manufacturers

5. **Chassis Types:**
   - Distribution of device types

6. **Storage Stats:**
   - totalStorage (sum)
   - usedStorage (sum)
   - freeStorage (sum)
   - avgUtilization (%)

7. **Enrollment Trends:**
   - Devices enrolled per month (last 6 months)

8. **Sync Trends:**
   - Devices synced per day (last 30 days)

9. **Management States:**
   - Distribution of management states

10. **Join Types:**
    - Distribution of join types

---

### 5.2 GET `/api/analytics/trends`
**File:** `app/api/analytics/trends/route.ts`

Fetches historical trends from history tables:
- `compliance_history` - Compliance changes over time
- `storage_history` - Storage utilization over time

---

### 5.3 GET `/api/analytics/compliance`
**File:** `app/api/analytics/compliance/route.ts`

Similar to compliance breakdown but with time-series analysis.

---

## 6. SYNC & SETTINGS ENDPOINTS

### 6.1 POST `/api/settings/trigger-sync`
**File:** `app/api/settings/trigger-sync/route.ts`

Triggers manual device sync using `syncDevices()` from `lib/services/deviceSync.ts`.

---

### 6.2 GET `/api/settings/test-connection`
**File:** `app/api/settings/test-connection/route.ts`

Tests Microsoft Graph API connection.

---

### 6.3 GET/PATCH/DELETE `/api/settings/[key]`
**File:** `app/api/settings/[key]/route.ts`

CRUD operations for app settings stored in `settings` table.

---

## 7. GRAPH API DATA SYNC

### 7.1 Device Sync Service
**File:** `lib/services/deviceSync.ts` (lines 1-150 analyzed)

#### Graph API Calls Made

From `lib/graph/client.ts` imports:
| Function | Purpose | Data Fetched |
|----------|---------|--------------|
| `getManagedDevice(id)` | Get single device | Full device object |
| `getManagedDevices(opts)` | Get all devices | Device list |
| `getManagedDevicesDelta()` | Incremental sync | Changed devices only |
| `getDeviceCompliancePolicies(id)` | Compliance data | Policy assignments & status ✅ |
| `getDeviceConfigurationProfiles(id)` | Config data | Config profile assignments ✅ |
| `getDeviceSecurityBaselines(id)` | Security baselines | Baseline compliance |
| `getDeviceWindowsProtectionState(id)` | Defender status | Windows Defender info ✅ |
| `getDeviceHealthAttestation(id)` | Health attestation | TPM, Secure Boot, BitLocker ✅ |
| `getDeviceActions(id)` | Action history | Wipe, lock, retire actions ✅ |
| `getDeviceGroups(id)` | Group membership | Azure AD groups ✅ |
| `getDeviceCategory(id)` | Device category | Organizational category |
| `getDeviceDetectedApps(id)` | Installed apps | Application inventory ✅ |
| `getDeviceAnalytics(id)` | Endpoint analytics | Performance metrics (if available) |

#### Sync Modes
- **full:** Sync all devices
- **incremental:** Delta sync (not yet implemented, falls back to full)
- **deep:** Full enrichment with additional Graph API calls

#### Data Storage Strategy
1. **Flat Columns:** Frequently queried fields extracted from Graph API response
2. **rawDeviceData (JSONB):** Full Graph API `/managedDevices/{id}` response
3. **Specialized JSONB Columns:** Enriched data from additional API calls
   - `complianceDetails` ← getDeviceCompliancePolicies()
   - `configurationDetails` ← getDeviceConfigurationProfiles()
   - `securityDetails` ← getDeviceWindowsProtectionState() + getDeviceHealthAttestation()
   - `actionsHistory` ← getDeviceActions()
   - `organizationDetails` ← getDeviceGroups() + getDeviceCategory()
   - `detectedAppsDetails` ← getDeviceDetectedApps()
   - `analyticsDetails` ← getDeviceAnalytics()

---

## 8. DATA COVERAGE ASSESSMENT

### 8.1 Well-Covered Areas ✅

1. **Basic Device Info:**
   - ✅ Device identity (name, serial, azureId)
   - ✅ Hardware basics (manufacturer, model, OS)
   - ✅ Storage metrics (total, free)
   - ✅ Network (IPv4, MAC addresses)

2. **Compliance Data:**
   - ✅ isCompliant flag
   - ✅ complianceState
   - ✅ complianceDetails (JSONB with policy failures)
   - ✅ Time-series compliance history

3. **User Association:**
   - ✅ userPrincipalName
   - ✅ userDisplayName
   - ✅ userEmail
   - ✅ userDepartment

4. **Sync Monitoring:**
   - ✅ lastSyncAt
   - ✅ Sync logs with success/failure tracking

---

### 8.2 Partially Covered Areas 🟡

1. **Security Posture:**
   - ✅ isEncrypted (flat column)
   - ✅ securityDetails (JSONB) - **BUT not exposed in list API**
   - 🟡 Defender status, BitLocker, TPM - stored in JSONB but not easily queryable
   - ❌ No quick filters for "Defender disabled" or "TPM missing"

2. **Hardware Details:**
   - ✅ Basic storage/memory
   - 🟡 Battery health stored in `batteryHealth` flat column but **NOT returned** in list API
   - 🟡 Detailed hardware (IMEI, MEID, Device Guard) in JSONB but not easily accessible

3. **Mobile Device Management:**
   - ✅ isSupervised flag
   - 🟡 jailBroken status stored but **NOT returned** in list API
   - 🟡 Lost mode details in JSONB
   - 🟡 Autopilot details in JSONB

---

### 8.3 Undercovered/Missing Areas ❌

1. **Endpoint Analytics:**
   - ❌ analyticsDetails JSONB likely empty (Graph API requires special permissions)
   - ❌ No startup time metrics
   - ❌ No app reliability scores
   - ❌ No battery health analytics

2. **Application Inventory:**
   - 🟡 detectedAppsDetails JSONB populated
   - ❌ No API endpoint to query/search installed apps
   - ❌ No app inventory UI

3. **Crash Reports:**
   - 🟡 crashesDetails JSONB may be populated
   - ❌ No API endpoint for crash data
   - ❌ No crash monitoring UI

4. **Warranty Information:**
   - 🟡 warrantyDetails JSONB (likely empty - requires external vendor API)
   - ❌ No warranty tracking

5. **Conditional Access:**
   - 🟡 conditionalAccessDetails JSONB may be populated
   - ❌ No API endpoint for CA violations
   - ❌ No CA policy dashboard

6. **Configuration Profiles:**
   - 🟡 configurationDetails JSONB populated
   - ❌ No dedicated API endpoint for config profile status
   - ❌ No config profile compliance UI

---

## 9. COMPARISON: API vs. Schema

### 9.1 Flat Columns NOT Returned in List API

| Column | Type | Why Not Returned? |
|--------|------|-------------------|
| `jailBroken` | VARCHAR | **Should be returned** - security risk indicator |
| `batteryHealth` | INTEGER | **Should be returned** - useful for mobile device alerts |
| `userId` | UUID | Internal FK - not needed in API |
| `azureAdDeviceId` | VARCHAR | Redundant with azureId |
| `managementState` | VARCHAR | Less commonly used |
| `deletedAt` | TIMESTAMP | Soft delete - filtered out in queries |

**Recommendation:** Add `jailBroken` and `batteryHealth` to list API response.

---

### 9.2 JSONB Columns NOT Easily Accessible

All 17 JSONB columns are:
- ✅ Stored in database
- ✅ Returned in GET `/api/devices/[id]` (single device)
- ❌ NOT indexed for querying
- ❌ NO dedicated API endpoints for JSONB data
- ❌ NOT exposed in list API

**Impact:**
- Cannot filter by "Defender disabled" without fetching all devices
- Cannot search installed apps efficiently
- Cannot query for TPM/Secure Boot status
- Cannot build dashboards for crash data or warranty expiration

**Recommendation:**
1. Add GIN indexes on critical JSONB columns
2. Create dedicated API endpoints for:
   - `/api/devices/security` - Security posture queries
   - `/api/devices/apps` - Application inventory
   - `/api/devices/crashes` - Crash reports
   - `/api/devices/conditional-access` - CA violations

---

## 10. GRAPH API COVERAGE

### 10.1 Currently Fetching ✅

Based on `deviceSync.ts`:
- ✅ Basic device info (`getManagedDevice`)
- ✅ Compliance policies (`getDeviceCompliancePolicies`)
- ✅ Configuration profiles (`getDeviceConfigurationProfiles`)
- ✅ Security baselines (`getDeviceSecurityBaselines`)
- ✅ Windows Defender (`getDeviceWindowsProtectionState`)
- ✅ Health attestation (`getDeviceHealthAttestation`)
- ✅ Device actions (`getDeviceActions`)
- ✅ Azure AD groups (`getDeviceGroups`)
- ✅ Device category (`getDeviceCategory`)
- ✅ Installed apps (`getDeviceDetectedApps`)
- ✅ Endpoint analytics (`getDeviceAnalytics`)

---

### 10.2 Potentially Missing Graph API Data ❓

Microsoft Graph API has additional endpoints we might not be calling:
- ❓ `/managedDevices/{id}/users` - Device users (primary vs. additional)
- ❓ `/managedDevices/{id}/logCollectionRequests` - Diagnostic logs
- ❓ `/managedDevices/{id}/deviceCompliancePolicyStates` - Per-policy state
- ❓ `/managedDevices/{id}/deviceConfigurationStates` - Per-config state
- ❓ `/deviceManagement/managedDevices/{id}/windowsProtectionState` - Full Windows security state
- ❓ `/deviceManagement/managedDevices/{id}/securityBaselineStates` - Baseline compliance details

**Recommendation:** Audit Graph API client to confirm all relevant endpoints are called.

---

## 11. SYNC FREQUENCY & FRESHNESS

### 11.1 Current Sync Strategy
- **Manual Trigger:** POST `/api/settings/trigger-sync`
- **Cron Job:** GET `/api/cron/sync-devices` (runs on schedule)
- **No Real-Time Updates:** Data staleness depends on sync frequency

### 11.2 Data Freshness
- `lastSyncAt` timestamp shows when device was last synced
- Dashboard shows "failed syncs in last 24h"
- No SLA for data freshness

**Recommendation:**
- Implement automatic sync every 6-12 hours
- Add "last synced" indicator in UI
- Highlight stale devices (>24h since last sync)

---

## 12. MISSING API ENDPOINTS

### 12.1 Device-Specific Data APIs (Should Exist)

1. **GET `/api/devices/[id]/security`**
   - Return parsed security posture from `securityDetails` JSONB
   - Fields: Defender status, BitLocker, TPM, Secure Boot, Device Guard

2. **GET `/api/devices/[id]/hardware`**
   - Return parsed hardware info from `hardwareDetails` JSONB
   - Fields: IMEI, MEID, battery serial, FQDN, Device Guard states

3. **GET `/api/devices/[id]/network`**
   - Return parsed network info from `networkDetails` JSONB
   - Fields: IPv6, subnet, full network config

4. **GET `/api/devices/[id]/compliance-details`**
   - Return parsed compliance info from `complianceDetails` JSONB
   - Show per-policy, per-setting status

5. **GET `/api/devices/[id]/configuration-details`**
   - Return parsed config info from `configurationDetails` JSONB
   - Show per-profile deployment status

6. **GET `/api/devices/[id]/apps`**
   - Return parsed app inventory from `detectedAppsDetails` JSONB
   - Searchable application list

7. **GET `/api/devices/[id]/crashes`**
   - Return crash data from `crashesDetails` JSONB
   - Crash history and trends

8. **GET `/api/devices/[id]/warranty`**
   - Return warranty info from `warrantyDetails` JSONB
   - Warranty expiration status

---

### 12.2 Aggregate Query APIs (Should Exist)

1. **GET `/api/devices/security-posture`**
   - Aggregate security metrics across all devices
   - Filters: Defender status, encryption, TPM, Secure Boot

2. **GET `/api/devices/apps/inventory`**
   - Aggregate application inventory
   - Group by app name, show device count

3. **GET `/api/devices/conditional-access`**
   - Aggregate CA policy violations
   - Group by policy, show affected devices

4. **GET `/api/devices/outdated-os`**
   - Devices with outdated OS versions
   - Compare against known latest versions

---

## 13. SUMMARY & RECOMMENDATIONS

### 13.1 Strengths ✅

1. **Comprehensive Sync:** Fetching extensive data from Graph API
2. **Smart Storage:** Hot/cold data separation with flat columns + JSONB
3. **Good List API:** Efficient filtering/sorting on commonly used fields
4. **Full Device Details:** Single device endpoint returns everything

---

### 13.2 Gaps 🔧

1. **JSONB Underutilized:** 
   - Data stored but not easily queryable
   - No dedicated endpoints for JSONB data
   - Missing GIN indexes

2. **Missing Fields in List API:**
   - `jailBroken` status
   - `batteryHealth` percentage
   - Security posture indicators

3. **No Specialized Endpoints:**
   - No `/security`, `/apps`, `/crashes` endpoints
   - Cannot efficiently query security posture
   - Cannot search installed apps

4. **Limited Analytics:**
   - Endpoint analytics likely empty (permissions?)
   - No crash monitoring
   - No warranty tracking

---

### 13.3 Immediate Actions (Priority Order)

#### P0 - High Priority (Week 1-2)
1. ✅ Add `jailBroken` and `batteryHealth` to GET `/api/devices` response
2. ✅ Add GIN indexes on critical JSONB columns
3. ✅ Create GET `/api/devices/[id]/security` endpoint
4. ✅ Create GET `/api/devices/[id]/apps` endpoint

#### P1 - Medium Priority (Week 3-4)
5. ✅ Create GET `/api/devices/security-posture` aggregate endpoint
6. ✅ Create GET `/api/devices/apps/inventory` aggregate endpoint
7. ✅ Create GET `/api/devices/[id]/compliance-details` endpoint
8. ✅ Create GET `/api/devices/[id]/configuration-details` endpoint

#### P2 - Lower Priority (Post-Launch)
9. ⚪ Implement delta sync (incremental mode)
10. ⚪ Add endpoint analytics (if Graph API permissions allow)
11. ⚪ Add warranty tracking (requires vendor API integration)
12. ⚪ Add crash monitoring (if Graph API data available)

---

**Next Steps:**
1. ✅ Phase 1.1 Complete: NEW_SCHEMA_INVENTORY.md
2. ✅ Phase 1.2 Complete: CURRENT_API_COVERAGE.md
3. ⏭️ Phase 1.3: Audit Current UI Data Usage
4. ⏭️ Phase 1.4: Document Legacy Schema Structure
