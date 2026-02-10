# UI Data Usage Map

**Purpose:** Document what data is displayed in each UI page and map it to API endpoints and schema sources.

**Created:** February 10, 2026  
**Status:** Phase 1.3 - Completed  
**Related:** [NEW_SCHEMA_INVENTORY.md](./NEW_SCHEMA_INVENTORY.md) | [CURRENT_API_COVERAGE.md](./CURRENT_API_COVERAGE.md)

---

## Table of Contents

1. [Device Detail Page](#1-device-detail-page)
2. [Device Inventory (List) Page](#2-device-inventory-list-page)
3. [Dashboard Page](#3-dashboard-page)
4. [Users Page](#4-users-page)
5. [Compliance Page](#5-compliance-page)
6. [Analytics Page](#6-analytics-page)
7. [Summary: Data Coverage Analysis](#summary-data-coverage-analysis)
8. [Gap Analysis](#gap-analysis)

---

## 1. Device Detail Page

**Path:** `/app/(dashboard)/devices/[id]/page.tsx` (460 lines)  
**API Endpoint:** `GET /api/devices/[id]`  
**Returns:** Full device record (51 flat columns + 17 JSONB columns)

### Data Displayed

#### Overview Tab

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Device Name | `deviceName` | `deviceName` (flat) | string | ✅ Displayed |
| Manufacturer | `manufacturer` | `manufacturer` (flat) | string | ✅ Displayed |
| Model | `model` | `model` (flat) | string | ✅ Displayed |
| Operating System | `operatingSystem` | `operatingSystem` (flat) | string | ✅ Displayed |
| OS Version | `osVersion` | `osVersion` (flat) | string | ✅ Displayed |
| Serial Number | `serialNumber` | `serialNumber` (flat) | string | ✅ Displayed |
| Chassis Type | `chassisType` | `chassisType` (flat) | string | ✅ Displayed |
| Azure ID | `azureId` | `azureId` (flat) | string | ✅ Displayed |
| User Display Name | `userDisplayName` | `userDisplayName` (flat) | string | ✅ Displayed |
| User Email | `userEmail` | `userEmail` (flat) | string | ✅ Displayed |
| User Principal Name | `userPrincipalName` | `userPrincipalName` (flat) | string | ✅ Displayed |
| User Department | `userDepartment` | `userDepartment` (flat) | string | ✅ Displayed |
| Join Type | `joinType` | `joinType` (flat) | string | ✅ Displayed |
| Enrollment Type | `enrollmentType` | `enrollmentType` (flat) | string | ✅ Displayed |
| Owner Type | `managedDeviceOwnerType` | `managedDeviceOwnerType` (flat) | string | ✅ Displayed |
| Enrolled At | `enrolledAt` | `enrolledAt` (flat) | timestamp | ✅ Displayed |
| Last Synced | `lastSyncAt` | `lastSyncAt` (flat) | timestamp | ✅ Displayed |
| Created At | `createdAt` | `createdAt` (flat) | timestamp | ✅ Displayed |
| Updated At | `updatedAt` | `updatedAt` (flat) | timestamp | ✅ Displayed |

#### Compliance Tab

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Is Compliant | `isCompliant` | `isCompliant` (flat) | boolean | ✅ Displayed |
| Compliance State | `complianceState` | `complianceState` (flat) | string | ✅ Displayed |
| Is Encrypted | `isEncrypted` | `isEncrypted` (flat) | boolean | ✅ Displayed |
| Is Supervised | `isSupervised` | `isSupervised` (flat) | boolean | ✅ Displayed |
| Compliance Policies | `complianceDetails` | `complianceDetails` (JSONB) | object[] | ✅ Displayed |
| - Policy Display Name | `complianceDetails[].displayName` | JSONB path | string | ✅ Displayed |
| - Policy State | `complianceDetails[].state` | JSONB path | string | ✅ Displayed |

#### Hardware Tab

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Total Storage | `storageTotal` | `storageTotal` (flat) | bigint | ✅ Displayed |
| Free Storage | `storageFree` | `storageFree` (flat) | bigint | ✅ Displayed |
| Used Storage | Calculated | `storageTotal - storageFree` | computed | ✅ Displayed |
| Storage Utilization % | Calculated | Percentage | computed | ✅ Displayed |
| Total Memory | `memoryTotal` | `memoryTotal` (flat) | bigint | ✅ Displayed |
| Battery Health | `batteryHealth` | `batteryHealth` (flat) | numeric | ✅ Displayed |

#### Network Tab

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| IPv4 Address | `ipAddressV4` | `ipAddressV4` (flat) | string | ✅ Displayed |
| WiFi MAC Address | `wifiMac` | `wifiMac` (flat) | string | ✅ Displayed |
| Ethernet MAC Address | `ethernetMac` | `ethernetMac` (flat) | string | ✅ Displayed |

#### Raw Data Tab

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Raw Device Data (JSON) | `rawDeviceData` OR entire device object | `rawDeviceData` (JSONB) | object | ✅ Displayed |

### Fields Available But NOT Displayed

- `azureAdDeviceId` (flat)
- `jailBroken` (flat) - **IMPORTANT: Security field not shown**
- `configurationDetails` (JSONB)
- `securityDetails` (JSONB) - **IMPORTANT: Security data not shown in dedicated view**
- `dataQuality` (JSONB)
- `ingestionMetadata` (JSONB)
- All other JSONB columns (apps, hardware, network, crashes, etc.) - **Stored but not easily accessible**

---

## 2. Device Inventory (List) Page

**Path:** `/app/(dashboard)/inventory/page.tsx` (589 lines)  
**API Endpoint:** `GET /api/devices` (with query params)  
**Returns:** Array of devices with 38 fields (subset of full schema)

### Data Displayed in Table

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Device Name | `deviceName` | `deviceName` (flat) | string | ✅ Displayed |
| Manufacturer | `manufacturer` | `manufacturer` (flat) | string | ✅ Displayed |
| Model | `model` | `model` (flat) | string | ✅ Displayed |
| Operating System | `operatingSystem` | `operatingSystem` (flat) | string | ✅ Displayed |
| OS Version | `osVersion` | `osVersion` (flat) | string | ✅ Displayed |
| Is Compliant | `isCompliant` | `isCompliant` (flat) | boolean | ✅ Displayed |
| Is Encrypted | `isEncrypted` | `isEncrypted` (flat) | boolean | ✅ Displayed |
| User Display Name | `userDisplayName` | `userDisplayName` (flat) | string | ✅ Displayed |
| User Principal Name | `userPrincipalName` | `userPrincipalName` (flat) | string | ✅ Displayed |
| Chassis Type | `chassisType` | `chassisType` (flat) | string | ✅ Filter only |
| Last Sync At | `lastSyncAt` | `lastSyncAt` (flat) | timestamp | ✅ Displayed |
| IP Address | `ipAddressV4` | `ipAddressV4` (flat) | string | ✅ In API, not in table |

### Filters Available

- **Search:** Device name, user name, serial number, IP address
- **Operating System:** Dropdown (from `/api/devices/filters`)
- **Manufacturer:** Dropdown (from `/api/devices/filters`)
- **Compliance Status:** Compliant / Non-compliant
- **Encryption Status:** Encrypted / Not encrypted
- **Chassis Type:** Dropdown (from `/api/devices/filters`)
- **Sort By:** deviceName, manufacturer, operatingSystem, lastSyncAt
- **Sort Order:** asc / desc
- **Pagination:** page, pageSize

### Fields Available But NOT Displayed in List

Per [CURRENT_API_COVERAGE.md](./CURRENT_API_COVERAGE.md), the list API returns 38 fields but excludes:

- `jailBroken` - **CRITICAL: Security risk indicator not shown in list**
- `batteryHealth` - **Important for mobile device alerts**
- All JSONB columns (security, apps, hardware details, crashes, etc.)

**Impact:** Users must click into device detail to see jailbreak status and battery health, which delays critical security response.

---

## 3. Dashboard Page

**Path:** `/app/(dashboard)/dashboard/page.tsx` (608 lines)  
**API Endpoint:** `GET /api/dashboard/overview`  
**Returns:** Comprehensive dashboard data with alerts, metrics, and activity

### Data Displayed

#### Critical Alerts Banner

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Non-Compliant Count | `criticalAlerts.nonCompliantCount` | Devices where `isCompliant = false` | ✅ Displayed |
| Low Disk Space Count | `criticalAlerts.lowDiskSpaceCount` | Devices where storage < 10% free | ✅ Displayed |
| Failed Syncs Count | `criticalAlerts.failedSyncsCount` | Sync logs in last 24h with errors | ✅ Displayed |
| Unencrypted Count | `criticalAlerts.unencryptedCount` | Devices where `isEncrypted = false` | ✅ Displayed |

#### Summary Cards

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Total Devices | `summary.totalDevices` | Count of all devices | ✅ Displayed |
| Non-Compliant Devices | `summary.nonCompliantDevices` | Count where `isCompliant = false` | ✅ Displayed |
| Unencrypted Devices | `summary.unencryptedDevices` | Count where `isEncrypted = false` | ✅ Displayed |
| Failed Syncs (24h) | `summary.failedSyncs24h` | Sync logs with errors | ✅ Displayed |

#### Device Health Sidebar

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Compliant Count | `deviceHealth.compliant` | Count where `isCompliant = true` | ✅ Displayed |
| Non-Compliant Count | `deviceHealth.nonCompliant` | Count where `isCompliant = false` | ✅ Displayed |
| Encrypted Count | `deviceHealth.encrypted` | Count where `isEncrypted = true` | ✅ Displayed |
| Unencrypted Count | `deviceHealth.unencrypted` | Count where `isEncrypted = false` | ✅ Displayed |
| Compliance Rate % | `deviceHealth.complianceRate` | Percentage | ✅ Displayed |
| Encryption Rate % | `deviceHealth.encryptionRate` | Percentage | ✅ Displayed |

#### Storage Overview Sidebar

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Total Storage | `storageOverview.totalStorage` | Sum of `storageTotal` | ✅ Displayed |
| Storage Used | `storageOverview.storageUsed` | Sum of `storageTotal - storageFree` | ✅ Displayed |
| Storage Free | `storageOverview.storageFree` | Sum of `storageFree` | ✅ Displayed |
| Utilization % | `storageOverview.utilizationPercent` | Percentage | ✅ Displayed |

#### Activity Feed

| **Field** | **API Field** | **Derived From** | **Status** |
|-----------|---------------|------------------|------------|
| Activity Type | `activityFeed[].type` | `activity_logs` or `sync_logs` | ✅ Displayed |
| Action | `activityFeed[].action` | Action enum | ✅ Displayed |
| Entity Type | `activityFeed[].entityType` | Entity type | ✅ Displayed |
| Metadata | `activityFeed[].metadata` | JSONB metadata | ✅ Displayed |
| Sync Type | `activityFeed[].syncType` | Sync type | ✅ Displayed |
| Records Synced | `activityFeed[].recordsSynced` | Count | ✅ Displayed |
| Error Message | `activityFeed[].errorMessage` | Error string | ✅ Displayed |
| Timestamp | `activityFeed[].timestamp` | Timestamp | ✅ Displayed |

#### Top Devices Needing Attention

| **Field** | **API Field** | **Derived From** | **Status** |
|-----------|---------------|------------------|------------|
| Device Name | `devicesNeedingAttention[].deviceName` | `deviceName` (flat) | ✅ Displayed |
| Manufacturer | `devicesNeedingAttention[].manufacturer` | `manufacturer` (flat) | ✅ Displayed |
| Model | `devicesNeedingAttention[].model` | `model` (flat) | ✅ Displayed |
| OS | `devicesNeedingAttention[].operatingSystem` | `operatingSystem` (flat) | ✅ Displayed |
| OS Version | `devicesNeedingAttention[].osVersion` | `osVersion` (flat) | ✅ Displayed |
| User | `devicesNeedingAttention[].userDisplayName` / `userPrincipalName` | `userDisplayName` (flat) | ✅ Displayed |
| Is Compliant | `devicesNeedingAttention[].isCompliant` | `isCompliant` (flat) | ✅ Displayed |
| Is Encrypted | `devicesNeedingAttention[].isEncrypted` | `isEncrypted` (flat) | ✅ Displayed |
| Compliance State | `devicesNeedingAttention[].complianceState` | `complianceState` (flat) | ✅ Displayed |
| Failed Policies Count | `devicesNeedingAttention[].failedPoliciesCount` | Calculated from `complianceDetails` | ✅ Displayed |
| Last Sync | `devicesNeedingAttention[].lastSyncAt` | `lastSyncAt` (flat) | ✅ Displayed |

### Fields Available But NOT Displayed

- **Jailbreak status** - Not shown on dashboard
- **Battery health** - Not shown on dashboard
- **Security posture details** - `securityDetails` JSONB not utilized
- **App inventory** - `installedApps` JSONB not shown
- **Crash reports** - `detectedApps` JSONB not shown
- **Hardware details** - Most hardware fields not shown

---

## 4. Users Page

**Path:** `/app/(dashboard)/users/page.tsx` (389 lines)  
**API Endpoint:** `GET /api/users` (with query params)  
**Returns:** Array of users with 10 fields + deviceCount

### Data Displayed in Table

| **Field Displayed** | **API Field** | **Schema Column** | **Data Type** | **Status** |
|---------------------|---------------|-------------------|---------------|------------|
| Name | `name` | `name` (flat) | string | ✅ Displayed |
| Display Name | `displayName` | `displayName` (flat) | string | ✅ Displayed |
| Email | `email` | `email` (flat) | string | ✅ Displayed |
| Department | `department` | `department` (flat) | string | ✅ Displayed |
| Job Title | `jobTitle` | `jobTitle` (flat) | string | ✅ Displayed |
| Device Count | `deviceCount` | Calculated via JOIN | computed | ✅ Displayed |
| Created At | `createdAt` | `createdAt` (flat) | timestamp | ❌ Available, not shown |
| Updated At | `updatedAt` | `updatedAt` (flat) | timestamp | ❌ Available, not shown |

### Filters Available

- **Search:** Name, email, display name
- **Department:** Dropdown (from `/api/users/filters`)
- **Job Title:** Dropdown (from `/api/users/filters`)
- **Has Devices:** true / false
- **Sort By:** name, email, department, jobTitle, deviceCount
- **Sort Order:** asc / desc
- **Pagination:** page, pageSize

### Summary Cards

| **Metric** | **Displayed** | **Source** |
|------------|---------------|------------|
| Total Users | ✅ Yes | `pagination.totalCount` |
| Total Departments | ✅ Yes | Count of unique departments |
| Total Job Titles | ✅ Yes | Count of unique job titles |

### Fields Available But NOT Displayed

Per [NEW_SCHEMA_INVENTORY.md](./NEW_SCHEMA_INVENTORY.md), users table has 14 columns but UI only shows 7:

- `id` - Internal, not shown
- `azureId` - Not shown
- `image` - Not shown (no profile pictures in UI)
- `role` - Not shown
- `createdAt` - Not shown
- `updatedAt` - Not shown
- `lastLogin` - **Missing from schema entirely** (would be useful to show)

**Gap:** No user profile fields (phone, office location, manager, etc.) from legacy schema.

---

## 5. Compliance Page

**Path:** `/app/(dashboard)/compliance/page.tsx` (535 lines)  
**API Endpoint:** `GET /api/compliance/breakdown` + `GET /api/compliance/history`  
**Returns:** Policy breakdown with risk categorization + historical compliance trend

### Data Displayed

#### Summary Cards

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Compliance Rate % | `summary.complianceRate` | Percentage of compliant devices | ✅ Displayed |
| Total Devices | `summary.totalDevices` | Count of all devices | ✅ Displayed |
| Compliant Devices | `summary.compliantDevices` | Count where `isCompliant = true` | ✅ Displayed |
| Non-Compliant Devices | `summary.nonCompliantDevices` | Count where `isCompliant = false` | ✅ Displayed |
| Unique Failed Policies | `summary.uniqueFailedPolicies` | Distinct policy IDs | ✅ Displayed |
| Total Policy Failures | `summary.totalPolicyFailures` | Total violations across all devices | ✅ Displayed |

#### Compliance by Risk Level

| **Risk Level** | **API Field** | **Derived From** | **Status** |
|----------------|---------------|------------------|------------|
| Critical Violations | `complianceByRisk.critical.failed` | Policies categorized as critical | ✅ Displayed |
| High Violations | `complianceByRisk.high.failed` | Policies categorized as high | ✅ Displayed |
| Medium Violations | `complianceByRisk.medium.failed` | Policies categorized as medium | ✅ Displayed |
| Low Violations | `complianceByRisk.low.failed` | Policies categorized as low | ✅ Displayed |

**Risk Categories:**
- **Critical:** Encryption, jailbreak, malware
- **High:** OS version, Defender, passwords
- **Medium:** Updates, security patches
- **Low:** Minor policy violations

#### Compliance by OS

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| OS Name | `complianceByOS[].osName` | `operatingSystem` | ✅ Displayed |
| Total Devices | `complianceByOS[].total` | Count per OS | ✅ Displayed |
| Compliant Count | `complianceByOS[].compliant` | Count where compliant | ✅ Displayed |
| Non-Compliant Count | `complianceByOS[].nonCompliant` | Count where non-compliant | ✅ Displayed |
| Compliance Rate % | `complianceByOS[].complianceRate` | Percentage | ✅ Displayed |

#### Failed Policies Breakdown (Expandable List)

| **Field** | **API Field** | **Derived From** | **Status** |
|-----------|---------------|------------------|------------|
| Policy ID | `policies[].policyId` | Unique policy identifier | ✅ Displayed |
| Policy Name | `policies[].policyName` | Human-readable name | ✅ Displayed |
| Risk Level | `policies[].riskLevel` | critical / high / medium / low | ✅ Displayed |
| Failed Count | `policies[].failedCount` | Count of affected devices | ✅ Displayed |
| Affected Devices | `policies[].affectedDevices[]` | Array of devices | ✅ Displayed |
| - Device Name | `affectedDevices[].name` | Device name | ✅ Displayed |
| - Manufacturer | `affectedDevices[].manufacturer` | Manufacturer | ✅ Displayed |
| - OS | `affectedDevices[].os` | Operating system | ✅ Displayed |
| - User | `affectedDevices[].user` | User name/email | ✅ Displayed |

#### Compliance History Chart

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `history[].date` | Date from `compliance_history` table | ✅ Displayed |
| Compliant Count | `history[].compliant` | Historical count | ✅ Displayed |
| Non-Compliant Count | `history[].nonCompliant` | Historical count | ✅ Displayed |
| Compliance Rate % | `history[].complianceRate` | Historical percentage | ✅ Displayed |

**Chart Type:** Line chart with 3 lines (compliant, non-compliant, rate %)

### Data Sources

- **Primary:** `complianceDetails` JSONB column from devices table
- **Secondary:** `compliance_history` table for trend data
- **Enrichment:** Device name, manufacturer, OS, user from flat columns

### Fields Available But NOT Displayed

- Individual policy details beyond name/state
- Grace periods (`complianceGracePeriodExpiration` - missing from schema)
- Conditional access policies (separate legacy schema)
- Configuration profile details

---

## 6. Analytics Page

**Path:** `/app/(dashboard)/analytics/page.tsx` (830 lines)  
**API Endpoint:** `GET /api/analytics/overview` + `GET /api/analytics/trends`  
**Returns:** Comprehensive analytics with multiple chart datasets

### Data Displayed

#### Summary Cards (from `/api/analytics/overview`)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Total Devices | `summary.totalDevices` | Count of all devices | ✅ Displayed |
| Compliant Count | `summary.compliant` | Count where `isCompliant = true` | ✅ Displayed |
| Non-Compliant Count | `summary.nonCompliant` | Count where `isCompliant = false` | ✅ Displayed |
| Compliance Rate % | `summary.complianceRate` | Percentage | ✅ Displayed |
| Encrypted Count | `summary.encrypted` | Count where `isEncrypted = true` | ✅ Displayed |
| Not Encrypted Count | `summary.notEncrypted` | Count where `isEncrypted = false` | ✅ Displayed |
| Encryption Rate % | `summary.encryptionRate` | Percentage | ✅ Displayed |

#### Section 1: Compliance & Security Trends

##### Compliance Trend (Line Chart - 30 days)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `complianceTrend[].date` | Date from `compliance_history` | ✅ Displayed |
| Compliant Count | `complianceTrend[].compliant` | Historical count | ✅ Displayed |
| Non-Compliant Count | `complianceTrend[].nonCompliant` | Historical count | ✅ Displayed |
| Compliance Rate % | `complianceTrend[].complianceRate` | Historical percentage | ✅ Displayed |

##### Policy Failure Trends (Line Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `policyFailureTrends[].date` | Date | ✅ Displayed |
| Total Failures | `policyFailureTrends[].totalFailures` | Count of policy violations | ✅ Displayed |
| Avg Failures Per Device | `policyFailureTrends[].avgFailuresPerDevice` | Average | ✅ Displayed |

##### Encryption Adoption (Area Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `encryptionTrend[].date` | Date | ✅ Displayed |
| Encrypted Count | `encryptionTrend[].encrypted` | Count | ✅ Displayed |
| Not Encrypted Count | `encryptionTrend[].notEncrypted` | Count | ✅ Displayed |
| Encryption Rate % | `encryptionTrend[].encryptionRate` | Percentage | ✅ Displayed |

##### User Compliance Ranking (Top 5 List)

| **Field** | **API Field** | **Derived From** | **Status** |
|-----------|---------------|------------------|------------|
| User Display Name | `userComplianceRanking[].userDisplayName` | `userDisplayName` | ✅ Displayed |
| User Email | `userComplianceRanking[].userEmail` | `userEmail` | ✅ Displayed |
| Department | `userComplianceRanking[].department` | `userDepartment` | ✅ Displayed |
| Total Devices | `userComplianceRanking[].totalDevices` | Count | ✅ Displayed |
| Non-Compliant Devices | `userComplianceRanking[].nonCompliantDevices` | Count | ✅ Displayed |
| Compliance Rate % | `userComplianceRanking[].complianceRate` | Percentage | ✅ Displayed |

#### Section 2: OS & Platform Analytics

##### Windows vs macOS Device Count (Line Chart - 30 days)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `osBuildTrend[].date` | Date | ✅ Displayed |
| Windows Count | `osBuildTrend[].windowsCount` | Count where OS = Windows | ✅ Displayed |
| macOS Count | `osBuildTrend[].macosCount` | Count where OS = macOS | ✅ Displayed |

##### OS Distribution (Pie Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| OS Name | `osDistribution[].os` | `operatingSystem` | ✅ Displayed |
| Device Count | `osDistribution[].count` | Count per OS | ✅ Displayed |

##### Top Manufacturers (Horizontal Bar Chart - Top 10)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Manufacturer Name | `manufacturers[].manufacturer` | `manufacturer` | ✅ Displayed |
| Device Count | `manufacturers[].count` | Count per manufacturer | ✅ Displayed |

#### Section 3: Fleet Health & Lifecycle

##### Device Health Score Trend (Area Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Date | `healthScoreTrend[].date` | Date | ✅ Displayed |
| Avg Health Score | `healthScoreTrend[].avgHealthScore` | Composite score (compliance 40% + encryption 30% + sync 30%) | ✅ Displayed |
| Total Devices | `healthScoreTrend[].totalDevices` | Count | ✅ Displayed |

**Health Score Formula:**
- Compliance: 40%
- Encryption: 30%
- Recent Sync (< 7 days): 30%

##### Device Age Distribution (Bar Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Age Category | `deviceAgeDistribution[].ageCategory` | Calculated from `enrolledAt` | ✅ Displayed |
| Device Count | `deviceAgeDistribution[].count` | Count per age category | ✅ Displayed |

**Age Categories:**
- 0-6 months
- 6-12 months
- 1-2 years
- 2-3 years
- 3+ years

##### User Activity Patterns (Bar Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Activity Category | `userActivityPatterns[].activityCategory` | Calculated from last activity | ✅ Displayed |
| Device Count | `userActivityPatterns[].count` | Count per category | ✅ Displayed |

**Activity Categories:**
- Active (24h)
- Recent (7d)
- Inactive (30d)
- Stale (90d)
- Unknown

##### Storage Capacity Warnings (Bar Chart)

| **Metric** | **API Field** | **Derived From** | **Status** |
|------------|---------------|------------------|------------|
| Utilization Range | `storageCapacityWarnings[].utilizationRange` | Calculated from `storageTotal` / `storageFree` | ✅ Displayed |
| Device Count | `storageCapacityWarnings[].count` | Count per range | ✅ Displayed |

**Utilization Ranges:**
- 90-100% Full (Critical)
- 80-90% Full (Warning)
- 70-80% Full (Caution)
- < 70% Full (Healthy)

##### Hardware Refresh Candidates (Top 10 List)

| **Field** | **API Field** | **Derived From** | **Status** |
|-----------|---------------|------------------|------------|
| Device Name | `hardwareRefreshCandidates[].deviceName` | `deviceName` | ✅ Displayed |
| Manufacturer | `hardwareRefreshCandidates[].manufacturer` | `manufacturer` | ✅ Displayed |
| Model | `hardwareRefreshCandidates[].model` | `model` | ✅ Displayed |
| Operating System | `hardwareRefreshCandidates[].operatingSystem` | `operatingSystem` | ✅ Displayed |
| OS Version | `hardwareRefreshCandidates[].osVersion` | `osVersion` | ✅ Displayed |
| Enrolled At | `hardwareRefreshCandidates[].enrolledAt` | `enrolledAt` | ✅ Displayed |
| User Display Name | `hardwareRefreshCandidates[].userDisplayName` | `userDisplayName` | ✅ Displayed |
| User Email | `hardwareRefreshCandidates[].userEmail` | `userEmail` | ✅ Displayed |
| Reason | `hardwareRefreshCandidates[].reason` | Calculated (old device / outdated OS) | ✅ Displayed |

**Refresh Criteria:**
- Device enrolled > 3 years ago
- Running outdated OS (Windows < 10, macOS < 11)

### Fields Available But NOT Displayed

- **Battery health trends** - Not charted
- **Jailbreak status over time** - Not tracked
- **Security score trends** - No dedicated security posture chart
- **App inventory analytics** - `installedApps` JSONB not analyzed
- **Crash report trends** - `detectedApps` JSONB not analyzed
- **Network connectivity analytics** - No network health charts
- **Warranty expiration tracking** - Not in schema

---

## Summary: Data Coverage Analysis

### Coverage by Category

| **Category** | **Fields in Schema** | **Fields Displayed** | **Coverage %** | **Status** |
|--------------|---------------------|---------------------|----------------|------------|
| **Basic Device Info** | 20 | 18 | 90% | ✅ Excellent |
| **User Info** | 14 | 7 | 50% | 🟡 Partial |
| **Compliance** | 5 + JSONB | 5 + partial JSONB | 80% | ✅ Good |
| **Hardware** | 10 | 6 | 60% | 🟡 Partial |
| **Network** | 3 | 3 | 100% | ✅ Perfect |
| **Security** | JSONB only | 0 | 0% | ❌ Not utilized |
| **Enrollment** | 7 | 7 | 100% | ✅ Perfect |
| **Sync/Metadata** | 6 | 4 | 67% | 🟡 Partial |
| **JSONB Details** | 17 columns | 1 (compliance only) | 6% | ❌ Severely underutilized |

### Overall Coverage

- **Flat Columns (51):** 40 displayed = 78% coverage
- **JSONB Columns (17):** 1 utilized (compliance) = 6% coverage
- **Total Fields:** 68 → ~41 displayed = **60% overall coverage**

---

## Gap Analysis

### Critical Gaps (P0 - Must Fix)

#### 1. **Jailbreak Status Not Visible in List View**
- **Field:** `jailBroken` (flat column)
- **Current:** Available in detail view only
- **Issue:** Security teams can't quickly scan for jailbroken devices
- **Recommendation:** Add to device list table and dashboard alerts

#### 2. **Security Details JSONB Not Accessible**
- **Field:** `securityDetails` (JSONB)
- **Current:** Stored but not displayed anywhere
- **Issue:** Critical security posture data is invisible
- **Recommendation:** Create dedicated "Security" tab in device detail page

#### 3. **Battery Health Not Visible in List View**
- **Field:** `batteryHealth` (flat)
- **Current:** Available in detail view only
- **Issue:** Mobile device alerts require clicking into each device
- **Recommendation:** Add to device list table with warning badge for < 80%

### Important Gaps (P1 - Should Fix)

#### 4. **App Inventory Not Accessible**
- **Field:** `installedApps` (JSONB)
- **Current:** Stored but not displayed
- **Issue:** Can't audit installed software or track rogue apps
- **Recommendation:** Create `/api/devices/[id]/apps` endpoint and UI tab

#### 5. **Crash Reports Not Accessible**
- **Field:** `detectedApps` (JSONB)
- **Current:** Stored but not displayed
- **Issue:** Can't identify problematic devices or apps causing crashes
- **Recommendation:** Create `/api/devices/[id]/crashes` endpoint and UI tab

#### 6. **Hardware Details Underutilized**
- **Field:** `hardwareDetails` (JSONB)
- **Current:** Stored but not displayed beyond storage/memory/battery
- **Issue:** Missing CPU, GPU, disk type, BIOS version, etc.
- **Recommendation:** Expand "Hardware" tab to show all hardware details

#### 7. **Network Details Underutilized**
- **Field:** `networkDetails` (JSONB)
- **Current:** Stored but not displayed beyond IP/MAC
- **Issue:** Missing subnet, DNS, proxy, VPN status
- **Recommendation:** Expand "Network" tab to show all network config

#### 8. **User Profile Fields Missing**
- **Legacy Fields:** `givenName`, `surname`, `mobilePhone`, `officeLocation`, `manager`
- **Current:** Not in new schema
- **Issue:** Can't contact users or understand org structure
- **Recommendation:** Add to users table schema (Phase 2)

#### 9. **Configuration Details Not Accessible**
- **Field:** `configurationDetails` (JSONB)
- **Current:** Stored but not displayed
- **Issue:** Can't see what configurations are applied
- **Recommendation:** Create "Configuration" tab in device detail page

### Nice-to-Have Gaps (P2 - Future)

#### 10. **Data Quality Scores Not Displayed**
- **Field:** `dataQuality` (JSONB)
- **Current:** Stored but not displayed
- **Issue:** Can't identify incomplete device records
- **Recommendation:** Show data quality badge in device list

#### 11. **Ingestion Metadata Not Visible**
- **Field:** `ingestionMetadata` (JSONB)
- **Current:** Stored but not displayed
- **Issue:** Can't debug sync issues or verify data freshness
- **Recommendation:** Add "Sync Details" section in device detail

#### 12. **Conditional Access Policies**
- **Legacy Schema:** Separate schema for conditional access
- **Current:** Not in new schema
- **Issue:** Can't track conditional access compliance
- **Recommendation:** Phase 2 - add to schema if needed

#### 13. **Warranty Tracking**
- **Legacy Field:** Warranty expiration dates
- **Current:** Not in new schema
- **Issue:** Can't proactively manage hardware refresh
- **Recommendation:** Phase 2 - add if business value exists

---

## Recommendations Summary

### Phase 1 (Immediate - No Schema Changes)

**Goal:** Expose existing data that's already stored but not displayed

1. **Add to Device List API (`/api/devices`):**
   - `jailBroken` field (security risk indicator)
   - `batteryHealth` field (mobile device alerts)

2. **Create New API Endpoints:**
   - `GET /api/devices/[id]/security` - Extract from `securityDetails` JSONB
   - `GET /api/devices/[id]/apps` - Extract from `installedApps` JSONB
   - `GET /api/devices/[id]/crashes` - Extract from `detectedApps` JSONB
   - `GET /api/devices/[id]/hardware` - Extract from `hardwareDetails` JSONB
   - `GET /api/devices/[id]/network` - Extract from `networkDetails` JSONB
   - `GET /api/devices/[id]/configuration` - Extract from `configurationDetails` JSONB

3. **Add New UI Tabs to Device Detail Page:**
   - "Security" tab (security posture, Defender status, firewall, etc.)
   - "Apps" tab (installed applications list with versions)
   - "Diagnostics" tab (crash reports, error logs)
   - "Configuration" tab (applied policies and settings)

4. **Add GIN Indexes on JSONB Columns:**
   - `CREATE INDEX idx_security_details ON devices USING GIN (securityDetails);`
   - `CREATE INDEX idx_installed_apps ON devices USING GIN (installedApps);`
   - `CREATE INDEX idx_detected_apps ON devices USING GIN (detectedApps);`
   - Enable fast querying of JSONB data

### Phase 2 (Schema Updates Required)

**Goal:** Add missing flat columns for frequently queried fields

1. **Add to Devices Table:**
   - `complianceGracePeriodExpiration` (timestamp)
   - `partnerReportedThreatState` (text)
   - `notes` (text) - Admin notes field
   - `imei` (text) - Mobile device identifier
   - `phoneNumber` (text) - Mobile phone number

2. **Add to Users Table:**
   - `givenName` (text)
   - `surname` (text)
   - `mobilePhone` (text)
   - `officeLocation` (text)
   - `manager` (text)
   - `lastLogin` (timestamp)

3. **Add Indexes:**
   - `CREATE INDEX idx_jailBroken ON devices(jailBroken);`
   - `CREATE INDEX idx_isCompliant ON devices(isCompliant);`
   - `CREATE INDEX idx_operatingSystem ON devices(operatingSystem);`
   - `CREATE INDEX idx_manufacturer ON devices(manufacturer);`

### Phase 3 (Advanced Analytics)

**Goal:** Create aggregate endpoints for executive dashboards

1. **Create Aggregate APIs:**
   - `GET /api/devices/security-posture` - Fleet-wide security metrics
   - `GET /api/devices/apps/inventory` - Fleet-wide app inventory
   - `GET /api/devices/health-score` - Device health scoring
   - `GET /api/analytics/warranty` - Warranty expiration tracking

2. **Add Analytics Charts:**
   - Battery health distribution chart
   - Jailbreak status over time
   - Security score trends
   - App adoption trends
   - Crash frequency by app/device

---

## Conclusion

**Current State:**
- **60% overall data coverage** (41 of 68 fields displayed)
- **Flat columns:** 78% utilized (40 of 51)
- **JSONB columns:** 6% utilized (1 of 17) - **MAJOR GAP**

**Key Findings:**
1. ✅ **Basic device info, compliance, enrollment, network** are well-covered
2. 🟡 **Hardware, user info, sync metadata** are partially covered
3. ❌ **Security details, app inventory, crash reports, hardware/network details** are stored but invisible
4. ❌ **JSONB columns are severely underutilized** - massive untapped data

**Impact:**
- Security teams can't quickly identify jailbroken devices
- IT can't audit installed applications
- Support teams can't see crash reports
- Detailed hardware/network info requires manual Graph API queries

**Next Steps:**
1. Complete Phase 1.4: Document legacy schema structure
2. Complete Phase 1.5: Property-by-property comparison (NEW vs LEGACY)
3. Prioritize P0 gaps (jailbreak, security details, battery health)
4. Design API endpoints to expose JSONB data
5. Plan Phase 2 schema updates based on business value assessment

---

**Document Version:** 1.0  
**Last Updated:** February 10, 2026  
**Next Review:** After Phase 1.5 completion
