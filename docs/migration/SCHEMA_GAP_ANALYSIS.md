# Schema Gap Analysis: Property-by-Property Comparison

**Purpose:** Comprehensive mapping of all legacy schema properties to new FleetWatch schema.

**Created:** February 10, 2026  
**Updated:** February 10, 2026 - Post Phase 2 Completion  
**Status:** Phase 2 - Completed ✅  
**Related:** [LEGACY_SCHEMA_INVENTORY.md](./LEGACY_SCHEMA_INVENTORY.md) | [NEW_SCHEMA_INVENTORY.md](./NEW_SCHEMA_INVENTORY.md) | [UI_DATA_USAGE_MAP.md](./UI_DATA_USAGE_MAP.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Migration Status Legend](#migration-status-legend)
3. [Device Properties Comparison](#device-properties-comparison)
4. [User Properties Comparison](#user-properties-comparison)
5. [Migration Statistics](#migration-statistics)
6. [Priority Recommendations](#priority-recommendations)

---

## Executive Summary

**UPDATED POST-PHASE 2:**

**Total Legacy Properties:** ~330  
**Migrated to New Schema:** ~59 (18%) ⬆️ +9 from Phase 2  
**Partially Migrated (in JSONB):** ~180 (55%)  
**Missing from New Schema:** ~91 (28%) ⬇️ -9 from Phase 2

### Migration Categories

| **Status** | **Count** | **Percentage** | **Description** |
|------------|-----------|----------------|-----------------|
| ✅ **Fully Migrated** | ~59 | 18% | In flat columns, fully accessible |
| 🟡 **Partially Migrated** | ~180 | 55% | In JSONB, not easily queryable |
| ❌ **Missing** | ~91 | 28% | Not in new schema at all |
| ⛔ **Deprecated** | ~0 | 0% | Intentionally excluded |

### Phase 2 Additions (COMPLETED ✅)

**9 new columns added:**
1. ✅ `complianceGracePeriodExpiration` (timestamp) - Compliance grace period tracking
2. ✅ `partnerReportedThreatState` (varchar 50) - Third-party threat detection
3. ✅ `notes` (text) - Admin notes for devices
4. ✅ `imei` (varchar 50) - Mobile device IMEI number
5. ✅ `phoneNumber` (varchar 50) - Mobile device phone number
6. ✅ `givenName` (varchar 255) - User first name
7. ✅ `surname` (varchar 255) - User last name
8. ✅ `mobilePhone` (varchar 50) - User mobile phone
9. ✅ `officeLocation` (varchar 255) - User office location

### Key Findings

1. **Phase 2 addressed critical P0 gaps** - IMEI, phone number, threat state, grace period now available ✅
2. **Core device/user fields well migrated** - 95% of basic identity fields present ⬆️
3. **Security details now accessible** - Threat state promoted to flat column ✅
4. **Mobile-specific fields added** - IMEI, phone number now in flat columns ✅
5. **Compliance tracking enhanced** - Grace period expiration now queryable ✅

---

## Migration Status Legend

| **Symbol** | **Status** | **Description** |
|------------|------------|-----------------|
| ✅ | **Migrated** | Present in new schema as flat column, fully queryable |
| 🟡 | **Partial** | Present in JSONB column, not easily queryable |
| ❌ | **Missing** | Not present in new schema |
| ⛔ | **Deprecated** | Intentionally excluded (not needed) |
| 🔴 | **P0** | Must have - critical for security/compliance |
| 🟠 | **P1** | Should have - important for operations |
| 🟢 | **P2** | Nice to have - enhances UX |
| ⚪ | **P3** | Optional - low business value |

---

## Device Properties Comparison

### Category 1: Core Identity (10 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `id` | string | `azureId` (flat) | ✅ Migrated | 🔴 P0 | Renamed from `id` to `azureId` |
| `azureAdDeviceId` | string? | `azureAdDeviceId` (flat) | ✅ Migrated | 🟠 P1 | Direct mapping |
| `serialNumber` | string? | `serialNumber` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `deviceName` | string | `deviceName` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `manufacturer` | string? | `manufacturer` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `model` | string? | `model` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `operatingSystem` | string | `operatingSystem` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `osVersion` | string? | `osVersion` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `joinType` | string? | `joinType` (flat) | ✅ Migrated | 🟠 P1 | Direct mapping |
| `enrollmentType` | string? | `enrollmentType` (flat) | ✅ Migrated | 🟠 P1 | Direct mapping |

**Summary:** ✅ 10/10 migrated (100%) - Excellent coverage

---

### Category 2: Management & Enrollment (5 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `managementState` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Not critical for FleetWatch |
| `lastSyncDateTime` | string? | `lastSyncAt` (flat) | ✅ Migrated | 🔴 P0 | Renamed, converted to timestamp |
| `enrolledDateTime` | string? | `enrolledAt` (flat) | ✅ Migrated | 🟠 P1 | Renamed, converted to timestamp |
| `managedDeviceOwnerType` | string? | `managedDeviceOwnerType` (flat) | ✅ Migrated | 🟠 P1 | Direct mapping |
| `managementAgent` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Not critical |

**Summary:** ✅ 3/5 migrated (60%) - Core fields present, minor fields missing

---

### Category 3: Top-Level Convenience Fields (10 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `isCompliant` | boolean? | `isCompliant` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `complianceState` | string? | `complianceState` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `isEncrypted` | boolean? | `isEncrypted` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `isSupervised` | boolean? | `isSupervised` (flat) | ✅ Migrated | 🟠 P1 | Direct mapping |
| `jailBroken` | string? | `jailBroken` (flat) | ✅ Migrated | 🔴 P0 | **BUT not in list API!** |
| `userPrincipalName` | string? | `userPrincipalName` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `userDisplayName` | string? | `userDisplayName` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `totalStorageSpaceInBytes` | number? | `storageTotal` (flat) | ✅ Migrated | 🟠 P1 | Renamed |
| `freeStorageSpaceInBytes` | number? | `storageFree` (flat) | ✅ Migrated | 🟠 P1 | Renamed |
| `batteryHealthPercentage` | number? | `batteryHealth` (flat) | ✅ Migrated | 🟠 P1 | **BUT not in list API!** |

**Summary:** ✅ 10/10 migrated (100%) - BUT 2 critical fields not exposed in list API

**Action Required:** Add `jailBroken` and `batteryHealth` to device list API response

---

### Category 4: Hardware Information (30 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `hardware.totalStorageSpaceInBytes` | number? | `storageTotal` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.freeStorageSpaceInBytes` | number? | `storageFree` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.physicalMemoryInBytes` | number? | `memoryTotal` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.chassisType` | string? | `chassisType` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.wiFiMacAddress` | string? | `wifiMac` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.ethernetMacAddress` | string? | `ethernetMac` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.imei` | string? | `imei` (flat) | ✅ Migrated | 🔴 P0 | **PHASE 2: Added as flat column** |
| `hardware.meid` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.iccid` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.udid` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.phoneNumber` | string? | `phoneNumber` (flat) | ✅ Migrated | 🔴 P0 | **PHASE 2: Added as flat column** |
| `hardware.subscriberCarrier` | string? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `hardwareDetails` JSONB |
| `hardware.batterySerialNumber` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.batteryHealthPercentage` | number? | `batteryHealth` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `hardware.batteryChargeCycles` | number? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.batteryLevelPercentage` | number? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.residentUsersCount` | number? | 🟡 Partial | 🟡 Partial | ⚪ P3 | In `hardwareDetails` JSONB |
| `hardware.productName` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.deviceFullQualifiedDomainName` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `hardwareDetails` JSONB |
| `hardware.deviceGuardVirtualizationBasedSecurityHardwareRequirementState` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `securityDetails` JSONB |
| `hardware.deviceGuardVirtualizationBasedSecurityState` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `securityDetails` JSONB |
| `hardware.deviceGuardLocalSystemAuthorityCredentialGuardState` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `securityDetails` JSONB |

**Summary:** ✅ 10/30 migrated (33%) ⬆️, 🟡 17/30 partial (57%), ❌ 3/30 missing (10%) ⬇️

**Phase 2 Improvements:**
- ✅ `imei` - P0 migrated to flat column
- ✅ `phoneNumber` - P0 migrated to flat column
- 🟡 `subscriberCarrier` - Still in JSONB (P1)
- 🟡 `meid`, `iccid`, `udid` - Still in JSONB (P2)

---

### Category 5: Network Details (7 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `network.ipAddressV4` | string? | `ipAddressV4` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `network.ipAddressV6` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `networkDetails` JSONB |
| `network.subnetAddress` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `networkDetails` JSONB |
| `network.wifiMac` | string? | `wifiMac` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `network.ethernetMac` | string? | `ethernetMac` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `network.isEncrypted` | boolean? | `isEncrypted` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `network.isSupervised` | boolean? | `isSupervised` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |

**Summary:** ✅ 5/7 migrated (71%), 🟡 2/7 partial (29%)

**Status:** Good coverage for essential network fields

---

### Category 6: Conditional Access (15+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `conditionalAccess.deviceRegistrationState` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Device CA registration |
| `conditionalAccess.policies[]` | array | ❌ Missing | ❌ Missing | 🟠 P1 | CA policies applied |
| `conditionalAccess.policies[].policyId` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Policy ID |
| `conditionalAccess.policies[].policyName` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Policy name |
| `conditionalAccess.policies[].state` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Applied/Not Applied |
| `conditionalAccess.locations[]` | array | ❌ Missing | ❌ Missing | 🟢 P2 | Named locations |

**Summary:** ❌ 0/15+ migrated (0%)

**Impact:** No Conditional Access tracking in FleetWatch

**Decision:** Defer to Phase 2 - Assess business need for CA policies

---

### Category 7: Autopilot & Provisioning (4 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `autopilot.enrolled` | boolean? | ❌ Missing | ❌ Missing | 🟢 P2 | Autopilot enrollment |
| `autopilot.profileName` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Autopilot profile |
| `autopilot.deploymentProfileAssigned` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Deployment profile |
| `autopilot.groupTag` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Group tag |

**Summary:** ❌ 0/4 migrated (0%)

**Impact:** No Autopilot tracking

**Decision:** Defer to Phase 3 - Low priority for MVP

---

### Category 8: Exchange ActiveSync (6 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `exchangeActiveSync.easActivated` | boolean? | ❌ Missing | ❌ Missing | 🟢 P2 | EAS activation status |
| `exchangeActiveSync.easDeviceId` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | EAS device ID |
| `exchangeActiveSync.easActivationDateTime` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Activation timestamp |
| `exchangeActiveSync.exchangeLastSuccessfulSyncDateTime` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Last EAS sync |
| `exchangeActiveSync.exchangeAccessState` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Access allowed/blocked |
| `exchangeActiveSync.exchangeAccessStateReason` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Reason for state |

**Summary:** ❌ 0/6 migrated (0%)

**Impact:** No Exchange ActiveSync tracking

**Decision:** Defer to Phase 3 - Low priority for modern environments

---

### Category 9: Management Details (9 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `management.managedDeviceOwnerType` | string? | `managedDeviceOwnerType` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `management.managementAgent` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Agent type |
| `management.managementCertificateExpirationDate` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Cert expiration |
| `management.managementFeatures` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Management features |
| `management.remoteAssistanceSessionUrl` | string? | ❌ Missing | ❌ Missing | ⚪ P3 | Remote assist URL |
| `management.remoteAssistanceSessionErrorDetails` | string? | ❌ Missing | ❌ Missing | ⚪ P3 | Remote assist errors |
| `management.requireUserEnrollmentApproval` | boolean? | ❌ Missing | ❌ Missing | 🟢 P2 | Enrollment approval |
| `management.userPrincipalName` | string? | `userPrincipalName` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `management.enrollmentProfileName` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Enrollment profile |

**Summary:** ✅ 2/9 migrated (22%), ❌ 7/9 missing (78%)

**Status:** Core fields migrated (owner type, user), management details missing

---

### Category 10: Security & Threat (1 property)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `partnerReportedThreatState` | string? | `partnerReportedThreatState` (flat) | ✅ Migrated | 🔴 P0 | **PHASE 2: Added as flat column** |

**Summary:** ✅ 1/1 migrated (100%) ⬆️ Phase 2 complete

**Phase 2 Status:** ✅ Critical P0 threat detection now queryable

---

### Category 11: Lost Mode (iOS) (4 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `lostMode.state` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Lost mode state (iOS) |
| `lostMode.message` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Lock screen message |
| `lostMode.phoneNumber` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Contact phone |
| `lostMode.footnote` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Lock screen footnote |

**Summary:** ❌ 0/4 migrated (0%)

**Impact:** No Lost Mode tracking for iOS devices

**Decision:** Defer to Phase 2 - Important for iOS-heavy orgs

---

### Category 12: Device Notes (1 property)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `notes` | string? | ❌ Missing | ❌ Missing | 🔴 P0 | **CRITICAL: Admin notes/comments** |

**Summary:** ❌ 0/1 migrated (0%)

**Critical Gap:** No admin notes field

**Action Required:** Add `notes` as flat column (text field)

---

### Category 13: Malware Detection (2 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `malware.activeMalwareCount` | number? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `malware.remediatedMalwareCount` | number? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `securityDetails` JSONB |

**Summary:** 🟡 2/2 partial (100%)

**Status:** Data stored but not accessible

**Action Required:** Extract to dedicated endpoint `/api/devices/[id]/malware`

---

### Category 14: User Association (5 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `user.id` | string? | `userId` (FK) | ✅ Migrated | 🔴 P0 | Foreign key to users table |
| `user.upn` | string? | `userPrincipalName` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `user.displayName` | string? | `userDisplayName` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `user.email` | string? | `userEmail` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `user.department` | string? | `userDepartment` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |

**Summary:** ✅ 5/5 migrated (100%)

**Status:** Excellent - All user association fields present

---

### Category 15: Compliance (25+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `compliance.state` | string | `complianceState` (flat) | ✅ Migrated | 🔴 P0 | Promoted to top level |
| `compliance.gracePeriodExpiration` | string? | `complianceGracePeriodExpiration` (flat) | ✅ Migrated | 🔴 P0 | **PHASE 2: Added as timestamp** |
| `compliance.references[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `complianceDetails` JSONB |
| `compliance.policies[]` | array | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `complianceDetails` JSONB |
| `compliance.policies[].id` | string | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `complianceDetails` JSONB |
| `compliance.policies[].name` | string | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `complianceDetails` JSONB |
| `compliance.policies[].state` | string | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `complianceDetails` JSONB |
| `compliance.policies[].settingStates[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `complianceDetails` JSONB |
| `compliance.lastEvaluated` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `complianceDetails` JSONB |

**Summary:** ✅ 2/25+ migrated (8%) ⬆️, 🟡 23/25+ partial (92%), ❌ 0/25 missing (0%) ⬇️

**Status:** Core compliance state migrated, grace period now queryable ✅

**Phase 2 Complete:** Grace period expiration now available for filtering and alerts

---

### Category 16: Configuration Status (20+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `configuration.references[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `configurationDetails` JSONB |
| `configuration.policies[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `configurationDetails` JSONB |
| `configuration.policies[].id` | string | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `configurationDetails` JSONB |
| `configuration.policies[].name` | string | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `configurationDetails` JSONB |
| `configuration.policies[].state` | string | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `configurationDetails` JSONB |
| `configuration.policies[].settings` | object | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `configurationDetails` JSONB |
| `configuration.lastEvaluated` | string? | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `configurationDetails` JSONB |

**Summary:** 🟡 20+/20+ partial (100%)

**Status:** All data stored in JSONB, not exposed in UI

**Action Required:** Create `/api/devices/[id]/configuration` endpoint

---

### Category 17: Security & Protection (30+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `security.protection.defenderStatus` | string? | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `securityDetails` JSONB |
| `security.protection.realTimeProtectionEnabled` | boolean? | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `securityDetails` JSONB |
| `security.protection.quickScanOverdue` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.protection.fullScanOverdue` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.protection.signatureUpdateOverdue` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.protection.rebootRequired` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.protection.pendingUpdates` | number? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.healthAttestation.bitLockerStatus` | string? | 🟡 Partial | 🟡 Partial | 🔴 P0 | In `securityDetails` JSONB |
| `security.healthAttestation.secureBootEnabled` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.healthAttestation.tpmPresent` | boolean? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |
| `security.baselines[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `securityDetails` JSONB |

**Summary:** 🟡 30+/30+ partial (100%)

**Status:** ALL security data in JSONB, completely inaccessible from UI

**Critical Gap:** No security dashboard or alerts

**Action Required:**
1. Create `/api/devices/[id]/security` endpoint
2. Add "Security" tab in device detail page
3. Create security dashboard widget

---

### Category 18: Device Actions History (10+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `actions.history[]` | array | ❌ Missing | ❌ Missing | 🟠 P1 | Device actions history |
| `actions.history[].actionName` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Action type |
| `actions.history[].actionState` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Pending/Completed/Failed |
| `actions.history[].startDateTime` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Action start time |
| `actions.lastAction` | object | ❌ Missing | ❌ Missing | 🟠 P1 | Last action summary |

**Summary:** ❌ 0/10+ migrated (0%)

**Impact:** No device actions tracking (Wipe, Retire, Reboot, etc.)

**Decision:** Defer to Phase 2 - Important for device management

---

### Category 19: Endpoint Analytics (40+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `analytics.scores.overall` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Overall health score |
| `analytics.scores.startup` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Startup performance score |
| `analytics.scores.appReliability` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | App reliability score |
| `analytics.scores.battery` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Battery health score |
| `analytics.startup.coreBootTimeMs` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Boot time in ms |
| `analytics.startup.restartCount` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Restart count |
| `analytics.startup.blueScreenCount` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | BSOD count |
| `analytics.appReliability.crashCount` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Total crashes |
| `analytics.appReliability.hangCount` | number? | ❌ Missing | ❌ Missing | 🟠 P1 | Total hangs |
| `analytics.battery.healthStatus` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Battery health status |

**Summary:** ❌ 0/40+ migrated (0%)

**Impact:** No endpoint analytics tracking - major feature gap

**Decision:** Phase 3 - Add as separate `device_analytics` table

---

### Category 20: Crashes (10+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `crashes.summary.total` | number | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `detectedApps` JSONB |
| `crashes.summary.last7Days` | number | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `detectedApps` JSONB |
| `crashes.summary.lastCrashAt` | string? | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `detectedApps` JSONB |
| `crashes.events[]` | array | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `detectedApps` JSONB |
| `crashes.events[].appName` | string | 🟡 Partial | 🟡 Partial | 🟠 P1 | In `detectedApps` JSONB |

**Summary:** 🟡 10+/10+ partial (100%)

**Status:** Crash data stored but not accessible

**Action Required:** Create `/api/devices/[id]/crashes` endpoint

---

### Category 21: Warranty (6 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `warranty.status` | string | ❌ Missing | ❌ Missing | 🟠 P1 | Warranty status |
| `warranty.startDate` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Warranty start |
| `warranty.endDate` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Warranty end |
| `warranty.inWarranty` | boolean | ❌ Missing | ❌ Missing | 🟠 P1 | In warranty flag |
| `warranty.vendor` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Warranty vendor |

**Summary:** ❌ 0/6 migrated (0%)

**Impact:** No warranty tracking

**Decision:** Phase 3 - Add as separate `device_warranty` table

---

### Category 22: Metadata (11 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `dataQuality.hasCompliance` | boolean | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `dataQuality` JSONB |
| `dataQuality.hasSecurity` | boolean | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `dataQuality` JSONB |
| `dataQuality.lastEnrichedAt` | string | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `dataQuality` JSONB |
| `ingestion.timestamp` | string | `updatedAt` (flat) | ✅ Migrated | 🟠 P1 | Mapped to updatedAt |
| `ingestion.source` | string | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `ingestionMetadata` JSONB |
| `ingestion.version` | string | 🟡 Partial | 🟡 Partial | 🟢 P2 | In `ingestionMetadata` JSONB |

**Summary:** ✅ 1/11 migrated (9%), 🟡 10/11 partial (91%)

**Status:** Metadata mostly in JSONB, timestamp migrated

---

## User Properties Comparison

### Category 1: Core Identity (6 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `id` | string | `azureId` (flat) | ✅ Migrated | 🔴 P0 | Renamed from `id` to `azureId` |
| `userPrincipalName` | string | `email` (flat) | ✅ Migrated | 🔴 P0 | Mapped to email |
| `displayName` | string? | `displayName` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |
| `givenName` | string? | ❌ Missing | ❌ Missing | 🔴 P0 | **CRITICAL: First name** |
| `surname` | string? | ❌ Missing | ❌ Missing | 🔴 P0 | **CRITICAL: Last name** |
| `mail` | string? | `email` (flat) | ✅ Migrated | 🔴 P0 | Direct mapping |

**Summary:** ✅ 4/6 migrated (67%), ❌ 2/6 missing (33%)

**Critical Gaps:**
- ❌ `givenName` - P0 (first name)
- ❌ `surname` - P0 (last name)

**Action Required:** Add `givenName` and `surname` as flat columns

---

### Category 2: Employment Info (8 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `employment.jobTitle` | string? | `jobTitle` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `employment.department` | string? | `department` (flat) | ✅ Migrated | 🟠 P1 | Promoted to top level |
| `employment.officeLocation` | string? | ❌ Missing | ❌ Missing | 🔴 P0 | **CRITICAL: Office location** |
| `employment.employeeId` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Employee ID |
| `employment.employeeType` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | FTE/Contractor |
| `employment.companyName` | string? | ❌ Missing | ❌ Missing | ⚪ P3 | Company name |
| `employment.hireDate` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Hire date |
| `employment.leaveDate` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Leave date |

**Summary:** ✅ 2/8 migrated (25%), ❌ 6/8 missing (75%)

**Critical Gap:** `officeLocation` missing (P0)

**Action Required:** Add `officeLocation`, `employeeId` as flat columns

---

### Category 3: Contact Info (4 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `contact.mobilePhone` | string? | ❌ Missing | ❌ Missing | 🔴 P0 | **CRITICAL: Mobile phone** |
| `contact.businessPhones` | string[]? | ❌ Missing | ❌ Missing | 🟢 P2 | Business phones |
| `contact.otherEmails` | string[]? | ❌ Missing | ❌ Missing | ⚪ P3 | Other emails |

**Summary:** ❌ 0/4 migrated (0%)

**Critical Gap:** `mobilePhone` missing (P0)

**Action Required:** Add `mobilePhone` as flat column

---

### Category 4: Account Status (6 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `account.enabled` | boolean | ❌ Missing | ❌ Missing | 🟠 P1 | Account enabled/disabled |
| `account.userType` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Member/Guest |
| `account.createdDateTime` | string? | `createdAt` (flat) | ✅ Migrated | 🟢 P2 | Mapped to createdAt |
| `account.usageLocation` | string? | ❌ Missing | ❌ Missing | 🟢 P2 | Country code |
| `account.onPremisesSyncEnabled` | boolean? | ❌ Missing | ❌ Missing | 🟢 P2 | AD sync enabled |
| `account.securityIdentifier` | string? | ❌ Missing | ❌ Missing | ⚪ P3 | SID |

**Summary:** ✅ 1/6 migrated (17%), ❌ 5/6 missing (83%)

**Status:** Basic account creation date present, status fields missing

---

### Category 5: Licenses (20+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `licenses.assigned[]` | array | ❌ Missing | ❌ Missing | 🟠 P1 | Assigned licenses |
| `licenses.summary.totalLicenses` | number | ❌ Missing | ❌ Missing | 🟠 P1 | License count |
| `licenses.summary.hasIntuneEMS` | boolean | ❌ Missing | ❌ Missing | 🟠 P1 | Has Intune license |

**Summary:** ❌ 0/20+ migrated (0%)

**Impact:** No license tracking in FleetWatch

**Decision:** Phase 3 - Add as separate `user_licenses` table

---

### Category 6: Device Association (20+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `devices.managed[]` | array | Via devices table JOIN | ✅ Migrated | 🔴 P0 | Foreign key relationship |
| `devices.summary.totalDevices` | number | Calculated via COUNT | ✅ Migrated | 🔴 P0 | SQL aggregate |
| `devices.summary.compliantDevices` | number | Calculated via COUNT | ✅ Migrated | 🟠 P1 | SQL aggregate |
| `devices.summary.platforms` | object | Calculated via GROUP BY | ✅ Migrated | 🟠 P1 | SQL aggregate |

**Summary:** ✅ 4/20+ migrated (20%)

**Status:** Core device association via relational JOIN (better than OpenSearch!)

---

### Category 7: Sign-in Activity (10+ properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `signInActivity.lastSignInDateTime` | string? | ❌ Missing | ❌ Missing | 🟠 P1 | Last sign-in timestamp |
| `signInActivity.recentApplications[]` | array | ❌ Missing | ❌ Missing | 🟢 P2 | Recent apps accessed |

**Summary:** ❌ 0/10+ migrated (0%)

**Impact:** No sign-in activity tracking

**Decision:** Phase 3 - Add as separate `user_sign_ins` table

---

### Category 8-10: Metadata (8 properties)

| **Legacy Property** | **Legacy Type** | **New Schema Location** | **Status** | **Priority** | **Notes** |
|---------------------|-----------------|-------------------------|------------|--------------|-----------|
| `dataQuality.hasLicenses` | boolean | ❌ Missing | ❌ Missing | 🟢 P2 | Data quality tracking |
| `ingestion.timestamp` | string | `updatedAt` (flat) | ✅ Migrated | 🟠 P1 | Mapped to updatedAt |

**Summary:** ✅ 1/8 migrated (13%), ❌ 7/8 missing (87%)

**Status:** Basic timestamp present, quality metadata missing

---

## Migration Statistics

### Overall Migration Summary

| **Category** | **Total Props** | **✅ Migrated** | **🟡 Partial** | **❌ Missing** | **Migration %** |
|--------------|-----------------|-----------------|----------------|----------------|-----------------|
| **Device Properties** | ~230 | ~50 (22%) | ~120 (52%) | ~60 (26%) | 74% (migrated + partial) |
| **User Properties** | ~100 | ~10 (10%) | ~10 (10%) | ~80 (80%) | 20% (migrated + partial) |
| **TOTAL** | ~330 | ~60 (18%) | ~130 (39%) | ~140 (43%) | 57% (migrated + partial) |

---

### By Priority

| **Priority** | **Total Props** | **✅ Migrated** | **🟡 Partial** | **❌ Missing** | **Action Required** |
|--------------|-----------------|-----------------|----------------|----------------|---------------------|
| 🔴 **P0 (Must Have)** | ~40 | ~30 (75%) | ~5 (13%) | ~5 (13%) | Add 5 P0 properties to schema |
| 🟠 **P1 (Should Have)** | ~80 | ~15 (19%) | ~50 (63%) | ~15 (19%) | Expose 50 JSONB properties via APIs |
| 🟢 **P2 (Nice to Have)** | ~120 | ~10 (8%) | ~60 (50%) | ~50 (42%) | Defer to Phase 3 |
| ⚪ **P3 (Optional)** | ~90 | ~5 (6%) | ~15 (17%) | ~70 (78%) | Do not migrate |

---

### By Storage Location (New Schema)

| **Storage** | **Count** | **Percentage** | **Status** |
|-------------|-----------|----------------|------------|
| **Flat Columns** | ~50 | 15% | Fully queryable, indexed |
| **JSONB (Accessible)** | ~10 | 3% | In use (complianceDetails) |
| **JSONB (Inaccessible)** | ~170 | 52% | Stored but not exposed |
| **Not Stored** | ~100 | 30% | Not in new schema |

---

## Priority Recommendations

### 🔴 Phase 1 (Immediate - P0 Gaps)

**Add Missing P0 Flat Columns:**

**Devices Table:**
1. `complianceGracePeriodExpiration` (timestamp) - Compliance grace period
2. `partnerReportedThreatState` (text) - Third-party threat detection
3. `notes` (text) - Admin notes/comments
4. `imei` (text) - Mobile device identifier
5. `phoneNumber` (text) - Mobile phone number

**Users Table:**
1. `givenName` (text) - First name
2. `surname` (text) - Last name
3. `mobilePhone` (text) - Mobile phone
4. `officeLocation` (text) - Office location

**Total:** 9 new flat columns

**Estimated Time:** 4-6 hours (schema migration + sync service updates)

---

### 🟠 Phase 2 (Short-Term - P1 Gaps)

**Expose JSONB Data via APIs:**

1. Create `/api/devices/[id]/security` endpoint
   - Extract `securityDetails` JSONB
   - Show Defender status, BitLocker, Secure Boot, TPM

2. Create `/api/devices/[id]/apps` endpoint
   - Extract `installedApps` JSONB
   - Show installed applications with versions

3. Create `/api/devices/[id]/crashes` endpoint
   - Extract `detectedApps` JSONB
   - Show crash history and frequency

4. Create `/api/devices/[id]/hardware` endpoint
   - Extract `hardwareDetails` JSONB
   - Show detailed hardware info beyond basics

5. Create `/api/devices/[id]/network` endpoint
   - Extract `networkDetails` JSONB
   - Show subnet, DNS, proxy, VPN status

6. Add GIN Indexes on JSONB columns:
```sql
CREATE INDEX idx_security_details ON devices USING GIN (securityDetails);
CREATE INDEX idx_installed_apps ON devices USING GIN (installedApps);
CREATE INDEX idx_detected_apps ON devices USING GIN (detectedApps);
CREATE INDEX idx_hardware_details ON devices USING GIN (hardwareDetails);
CREATE INDEX idx_network_details ON devices USING GIN (networkDetails);
```

**Estimated Time:** 16-20 hours (5 endpoints + UI tabs)

---

### 🟢 Phase 3 (Medium-Term - P2 Enhancements)

**Create New Tables for Complex Data:**

1. **`device_analytics` table** (1:1 with devices)
   - Columns: device_id, overall_score, startup_score, reliability_score, battery_score
   - Purpose: Endpoint analytics tracking

2. **`device_crashes` table** (1:many with devices)
   - Columns: id, device_id, timestamp, app_name, process_name, version, error_code
   - Purpose: Crash history tracking

3. **`device_warranty` table** (1:1 with devices)
   - Columns: device_id, status, start_date, end_date, vendor, in_warranty
   - Purpose: Warranty tracking

4. **`device_actions` table** (1:many with devices)
   - Columns: id, device_id, action_name, action_state, start_time, end_time, user_id
   - Purpose: Device actions history (Wipe, Retire, Reboot)

5. **`user_licenses` table** (1:many with users)
   - Columns: id, user_id, sku_id, sku_part_number, assigned_date
   - Purpose: License tracking

6. **`user_sign_ins` table** (1:many with users)
   - Columns: id, user_id, sign_in_time, app_name, ip_address, location, result
   - Purpose: Sign-in activity tracking

**Estimated Time:** 24-32 hours (6 tables + sync services + APIs + UI)

---

### ⚪ Phase 4 (Long-Term - P3 Optional)

**Defer or Do Not Migrate:**
- Conditional Access policies (assess business need)
- Autopilot tracking (low priority for MVP)
- Exchange ActiveSync (low priority for modern environments)
- Configuration Manager integration (legacy system)
- Lost Mode tracking (iOS-specific, defer if not iOS-heavy)

---

## Conclusion

### Key Takeaways

1. **57% of legacy data is stored** (migrated or partial)
2. **43% of legacy data is missing** (not in new schema)
3. **Only 18% is fully accessible** (flat columns)
4. **39% is stored but inaccessible** (JSONB without extraction)

### Migration Strategy

**Phase 1 (Week 1-2):** Add 9 P0 flat columns → 100% P0 coverage
**Phase 2 (Week 3-4):** Expose 50 P1 JSONB properties via 5 APIs → 80% P1 coverage
**Phase 3 (Week 5-8):** Create 6 new tables for P2 features → 60% P2 coverage
**Phase 4 (Post-launch):** Assess P3 features based on user feedback

### Expected Outcome

After all phases:
- **P0 Properties:** 100% migrated (40/40)
- **P1 Properties:** 80% migrated (64/80)
- **P2 Properties:** 60% migrated (72/120)
- **P3 Properties:** 10% migrated (9/90)
- **Overall:** ~185/330 properties (56% total migration)

**Rationale:** Focus on business value, not blind 100% migration

---

**Document Version:** 1.0  
**Last Updated:** February 10, 2026  
**Next Steps:** Phase 1.6 - API Coverage Synthesis
