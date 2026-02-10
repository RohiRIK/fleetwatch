# Property Classification: MUST/SHOULD/NICE/WONT
**FleetWatch Database Migration Audit - Phase 1.8**

## Executive Summary

This document provides the **final classification** of all 330 properties from the legacy schema using the MoSCoW prioritization method. Each property is classified as:

- **MUST Have (P0)** - Critical for core functionality, security, or compliance
- **SHOULD Have (P1)** - High value but not blocking
- **NICE to Have (P2)** - Adds value but can be deferred
- **WON'T Have (P3)** - Out of scope or deprecated

### Classification Results

| **Classification** | **Device Props** | **User Props** | **Total** | **Percentage** |
|-------------------|------------------|----------------|-----------|----------------|
| 🔴 **MUST (P0)** | 45 | 8 | 53 | 16% |
| 🟠 **SHOULD (P1)** | 68 | 12 | 80 | 24% |
| 🟢 **NICE (P2)** | 87 | 35 | 122 | 37% |
| ⚪ **WON'T (P3)** | 30 | 45 | 75 | 23% |
| **TOTAL** | 230 | 100 | 330 | 100% |

### Migration Status by Classification

| **Classification** | **Already Migrated** | **In JSONB** | **Missing** | **Action Required** |
|-------------------|---------------------|--------------|-------------|---------------------|
| 🔴 **MUST (P0)** | 38 (72%) | 10 (19%) | 5 (9%) | Add 5 flat columns, expose 10 JSONB props |
| 🟠 **SHOULD (P1)** | 12 (15%) | 58 (73%) | 10 (13%) | Expose 58 JSONB props via APIs |
| 🟢 **NICE (P2)** | 10 (8%) | 62 (51%) | 50 (41%) | Defer to Phase 5 |
| ⚪ **WON'T (P3)** | 0 (0%) | 0 (0%) | 75 (100%) | Do not migrate |

---

## Table of Contents

1. [Classification Criteria](#classification-criteria)
2. [Device Properties Classification](#device-properties-classification)
3. [User Properties Classification](#user-properties-classification)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Validation & Sign-off](#validation--sign-off)

---

## Classification Criteria

### MUST Have (P0) - Critical Properties

**Criteria:**
- ✅ Required for core MDM functionality
- ✅ Security-critical (encryption, jailbreak, malware)
- ✅ Compliance-required (SOC 2, HIPAA, PCI-DSS)
- ✅ Used in 50%+ of daily workflows
- ✅ Competitive parity (all competitors have this)
- ✅ High business risk if missing ($100K+ annual impact)

**Examples:**
- `jailBroken` - Security teams scan for this daily
- `isCompliant` - Compliance reporting essential
- `isEncrypted` - Regulatory requirement
- `userPrincipalName` - User association essential

---

### SHOULD Have (P1) - High Value Properties

**Criteria:**
- ✅ Improves user productivity significantly
- ✅ Used in 20-50% of workflows
- ✅ Reduces IT support burden
- ✅ Medium business risk if missing ($10K-$100K annual impact)
- ✅ Most competitors have this

**Examples:**
- `bootScore` (endpoint analytics) - Proactive device management
- `detectedApps` - App inventory for license optimization
- `configurationProfiles` - Troubleshooting efficiency

---

### NICE to Have (P2) - Value-Add Properties

**Criteria:**
- ✅ Adds value but not essential
- ✅ Used in <20% of workflows (niche use cases)
- ✅ Low business risk if missing (<$10K annual impact)
- ✅ Some competitors have this, others don't

**Examples:**
- `warrantyEndDate` - Hardware lifecycle planning
- `lostModeState` - iOS-specific feature
- `autopilotGroupTag` - Windows deployment automation

---

### WON'T Have (P3) - Out of Scope

**Criteria:**
- ❌ Deprecated in modern MDM systems
- ❌ Not available in Microsoft Graph API
- ❌ Niche feature with <5% usage
- ❌ High implementation cost with low value
- ❌ Replaced by external systems

**Examples:**
- `easActivated` (Exchange ActiveSync) - Deprecated, replaced by modern email
- `isRoaming` - Network state, not useful for MDM
- `legacyAppInstallPath` - Legacy OpenSearch-specific field

---

## Device Properties Classification

### MUST Have (P0) - 45 Properties

#### Core Identity (5 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `id` | ✅ Migrated | `id` (flat) | None |
| `azureId` | ✅ Migrated | `azureId` (flat) | None |
| `azureAdDeviceId` | ✅ Migrated | `azureAdDeviceId` (flat) | None |
| `deviceName` | ✅ Migrated | `deviceName` (flat) | None |
| `serialNumber` | ✅ Migrated | `serialNumber` (flat) | None |

---

#### Basic Device Info (4 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `manufacturer` | ✅ Migrated | `manufacturer` (flat) | None |
| `model` | ✅ Migrated | `model` (flat) | None |
| `operatingSystem` | ✅ Migrated | `operatingSystem` (flat) | None |
| `osVersion` | ✅ Migrated | `osVersion` (flat) | None |

---

#### Compliance & Security (10 props) - 🔴 5 MISSING

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `isCompliant` | ✅ Migrated | `isCompliant` (flat) | None |
| `complianceState` | ✅ Migrated | `complianceState` (flat) | None |
| `isEncrypted` | ✅ Migrated | `isEncrypted` (flat) | None |
| `isSupervised` | ✅ Migrated | `isSupervised` (flat) | None |
| `jailBroken` | ✅ Migrated | `jailBroken` (flat) | ⚠️ **Add to list API** |
| `complianceGracePeriodExpiration` | ❌ **MISSING** | N/A | 🔴 **Add flat column** |
| `partnerReportedThreatState` | ❌ **MISSING** | N/A | 🔴 **Add flat column** |
| `securityPatchLevel` | 🟡 Partial | `rawDeviceData` (JSONB) | ⚠️ **Extract to flat column** |
| `bitLockerStatus` | 🟡 Partial | `securityDetails.healthAttestation` (JSONB) | ⚠️ **Expose via security API** |
| `windowsDefenderEnabled` | 🟡 Partial | `securityDetails.windowsProtection` (JSONB) | ⚠️ **Expose via security API** |

**Actions Required:**
1. Add 2 new flat columns: `complianceGracePeriodExpiration`, `partnerReportedThreatState`
2. Extract `securityPatchLevel` to flat column (Android devices)
3. Create `/api/devices/[id]/security` endpoint to expose BitLocker and Defender status
4. Add `jailBroken` to device list API response

---

#### User Association (5 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `userId` | ✅ Migrated | `userId` (flat, FK) | None |
| `userPrincipalName` | ✅ Migrated | `userPrincipalName` (flat) | None |
| `userDisplayName` | ✅ Migrated | `userDisplayName` (flat) | None |
| `userEmail` | ✅ Migrated | `userEmail` (flat) | None |
| `userDepartment` | ✅ Migrated | `userDepartment` (flat) | ⚠️ **Populate from user sync** |

---

#### Enrollment Info (5 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `enrolledAt` | ✅ Migrated | `enrolledAt` (flat) | None |
| `enrollmentType` | ✅ Migrated | `enrollmentType` (flat) | None |
| `joinType` | ✅ Migrated | `joinType` (flat) | None |
| `managementState` | ✅ Migrated | `managementState` (flat) | None |
| `managedDeviceOwnerType` | ✅ Migrated | `managedDeviceOwnerType` (flat) | None |

---

#### Hardware Basics (6 props) - 🔴 1 MISSING

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `storageTotal` | ✅ Migrated | `storageTotal` (flat) | None |
| `storageFree` | ✅ Migrated | `storageFree` (flat) | None |
| `memoryTotal` | ✅ Migrated | `memoryTotal` (flat) | None |
| `chassisType` | ✅ Migrated | `chassisType` (flat) | None |
| `batteryHealth` | ✅ Migrated | `batteryHealth` (flat) | ⚠️ **Add to list API** |
| `notes` | ❌ **MISSING** | N/A | 🔴 **Add flat column** |

**Actions Required:**
1. Add `notes` flat column for admin comments
2. Add `batteryHealth` to device list API response

---

#### Mobile Device Essentials (3 props) - 🔴 2 MISSING

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `imei` | 🟡 Partial | `hardwareDetails.imei` (JSONB) | 🔴 **Add flat column** |
| `phoneNumber` | ❌ **MISSING** | N/A | 🔴 **Add flat column + fetch from Graph** |
| `subscriberCarrier` | 🟡 Partial | `hardwareDetails.subscriberCarrier` (JSONB) | ⚠️ **Keep in JSONB** |

**Actions Required:**
1. Add `imei` flat column (extract from `hardwareDetails` JSONB)
2. Add `phoneNumber` flat column (fetch from Graph API)
3. Keep `subscriberCarrier` in JSONB (query less frequently)

---

#### Network Basics (3 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `ipAddressV4` | ✅ Migrated | `ipAddressV4` (flat) | None |
| `wifiMac` | ✅ Migrated | `wifiMac` (flat) | None |
| `ethernetMac` | ✅ Migrated | `ethernetMac` (flat) | None |

---

#### Compliance Details (3 props) - ✅ ALREADY IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `compliancePolicies` | 🟡 In JSONB | `complianceDetails` (JSONB) | ⚠️ **Already exposed via API** ✅ |
| `deviceCompliancePolicyStates` | 🟡 In JSONB | `complianceDetails` (JSONB) | ⚠️ **Already exposed via API** ✅ |
| `compliancePolicyFailures` | 🟡 In JSONB | `complianceDetails` (JSONB) | ⚠️ **Already exposed via API** ✅ |

**Actions Required:**
- None - Already accessible and displayed in UI

---

#### Timestamps (4 props) - ✅ ALL MIGRATED

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `lastSyncAt` | ✅ Migrated | `lastSyncAt` (flat) | None |
| `createdAt` | ✅ Migrated | `createdAt` (flat) | None |
| `updatedAt` | ✅ Migrated | `updatedAt` (flat) | None |
| `deletedAt` | ✅ Migrated | `deletedAt` (flat) | None |

---

### **P0 Summary: 45 properties**
- ✅ **Fully migrated:** 38 (84%)
- 🟡 **Partially migrated (in JSONB):** 5 (11%)
- ❌ **Missing:** 2 (4%) - `complianceGracePeriodExpiration`, `partnerReportedThreatState`, `notes`, `imei`, `phoneNumber`

**Critical Actions:**
1. Add 5 new flat columns
2. Create security posture endpoint
3. Add `jailBroken` and `batteryHealth` to list API

---

## SHOULD Have (P1) - 68 Properties

### Security Posture (12 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `secureBootEnabled` | 🟡 In JSONB | `securityDetails.healthAttestation` | ⚠️ **Expose via security API** |
| `tpmVersion` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `codeIntegrityEnabled` | 🟡 In JSONB | `securityDetails.healthAttestation` | ⚠️ **Expose via security API** |
| `antiMalwareEnabled` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `antiMalwareVersion` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `firewallEnabled` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `realTimeProtectionEnabled` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `lastQuickScanDateTime` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `lastFullScanDateTime` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `signatureUpdateOverdue` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `rebootRequired` | 🟡 In JSONB | `securityDetails.windowsProtection` | ⚠️ **Expose via security API** |
| `securityBaselines` | 🟡 In JSONB | `securityDetails.baselines` | ⚠️ **Expose via security API** |

**Actions Required:**
- Create `GET /api/devices/[id]/security` endpoint
- Add Security tab in device detail UI
- Add GIN index on `securityDetails` JSONB column

---

### App Inventory (5 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `detectedApps` | 🟡 In JSONB | `detectedAppsDetails` | ⚠️ **Expose via apps API** |
| `detectedAppDisplayName` | 🟡 In JSONB | `detectedAppsDetails[].displayName` | ⚠️ **Expose via apps API** |
| `detectedAppVersion` | 🟡 In JSONB | `detectedAppsDetails[].version` | ⚠️ **Expose via apps API** |
| `detectedAppPublisher` | 🟡 In JSONB | `detectedAppsDetails[].publisher` | ⚠️ **Expose via apps API** |
| `detectedAppSize` | 🟡 In JSONB | `detectedAppsDetails[].sizeInByte` | ⚠️ **Expose via apps API** |

**Actions Required:**
- Create `GET /api/devices/[id]/apps` endpoint
- Add Apps tab in device detail UI
- Add GIN index on `detectedAppsDetails` JSONB column

---

### Endpoint Analytics (10 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `bootScore` | 🟡 In JSONB | `analyticsDetails.bootScore` | ⚠️ **Expose via analytics API** |
| `loginScore` | 🟡 In JSONB | `analyticsDetails.loginScore` | ⚠️ **Expose via analytics API** |
| `overallScore` | 🟡 In JSONB | `analyticsDetails.overallScore` | ⚠️ **Expose via analytics API** |
| `appReliabilityScore` | 🟡 In JSONB | `analyticsDetails.appReliabilityScore` | ⚠️ **Expose via analytics API** |
| `coreBootTimeInMs` | 🟡 In JSONB | `analyticsDetails.coreBootTimeInMs` | ⚠️ **Expose via analytics API** |
| `coreLoginTimeInMs` | 🟡 In JSONB | `analyticsDetails.coreLoginTimeInMs` | ⚠️ **Expose via analytics API** |
| `restartCount` | 🟡 In JSONB | `analyticsDetails.restartCount` | ⚠️ **Expose via analytics API** |
| `blueScreenCount` | 🟡 In JSONB | `analyticsDetails.blueScreenCount` | ⚠️ **Expose via analytics API** |
| `healthStatus` | 🟡 In JSONB | `analyticsDetails.healthStatus` | ⚠️ **Expose via analytics API** |
| `startupPerformanceScore` | 🟡 In JSONB | `analyticsDetails.startupPerformanceScore` | ⚠️ **Expose via analytics API** |

**Actions Required:**
- Create `GET /api/devices/[id]/analytics` endpoint
- Add Analytics tab in device detail UI
- Add GIN index on `analyticsDetails` JSONB column

---

### Configuration Profiles (8 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `configurationProfiles` | 🟡 In JSONB | `configurationDetails` | ⚠️ **Expose via config API** |
| `configProfileDisplayName` | 🟡 In JSONB | `configurationDetails[].displayName` | ⚠️ **Expose via config API** |
| `configProfileState` | 🟡 In JSONB | `configurationDetails[].state` | ⚠️ **Expose via config API** |
| `configProfileSettingCount` | 🟡 In JSONB | `configurationDetails[].settingCount` | ⚠️ **Expose via config API** |
| `configProfileVersion` | 🟡 In JSONB | `configurationDetails[].version` | ⚠️ **Expose via config API** |
| `configProfilePlatform` | 🟡 In JSONB | `configurationDetails[].platformType` | ⚠️ **Expose via config API** |
| `configProfileLastReported` | 🟡 In JSONB | `configurationDetails[].lastReportedDateTime` | ⚠️ **Expose via config API** |
| `configProfileUserPrincipalName` | 🟡 In JSONB | `configurationDetails[].userPrincipalName` | ⚠️ **Expose via config API** |

**Actions Required:**
- Create `GET /api/devices/[id]/configuration` endpoint
- Add Configuration tab in device detail UI
- Add GIN index on `configurationDetails` JSONB column

---

### Hardware Details (8 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `meid` | 🟡 In JSONB | `hardwareDetails.meid` | ⚠️ **Keep in JSONB** |
| `cellularTechnology` | 🟡 In JSONB | `hardwareDetails.cellularTechnology` | ⚠️ **Keep in JSONB** |
| `wifiMacAddress` | 🟡 In JSONB | `hardwareDetails.wifiMacAddress` | ⚠️ **Keep in JSONB** |
| `ethernetMacAddress` | 🟡 In JSONB | `hardwareDetails.ethernetMacAddress` | ⚠️ **Keep in JSONB** |
| `deviceGuardVBSEnabled` | 🟡 In JSONB | `hardwareDetails.deviceGuardVirtualizationBasedSecurity` | ⚠️ **Keep in JSONB** |
| `deviceGuardLSAEnabled` | 🟡 In JSONB | `hardwareDetails.deviceGuardLocalSystemAuthority` | ⚠️ **Keep in JSONB** |
| `processorArchitecture` | 🟡 In JSONB | `rawDeviceData.processorArchitecture` | ⚠️ **Keep in JSONB** |
| `totalStorageSpaceInBytes` | ✅ Migrated | `storageTotal` (flat) | None - duplicated for convenience |

**Actions Required:**
- Create `GET /api/devices/[id]/hardware` endpoint (optional - low priority)
- Add GIN index on `hardwareDetails` JSONB column

---

### Network Details (5 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `ipAddressV6` | 🟡 In JSONB | `networkDetails.ipAddressV6` | ⚠️ **Keep in JSONB** |
| `subnetAddress` | 🟡 In JSONB | `networkDetails.subnetAddress` | ⚠️ **Keep in JSONB** |
| `isNetworkDeployed` | 🟡 In JSONB | `networkDetails.isNetworkDeployed` | ⚠️ **Keep in JSONB** |
| `macAddress` | ✅ Migrated | `wifiMac` + `ethernetMac` (flat) | None - split into WiFi/Ethernet |
| `skuNumber` | 🟡 In JSONB | `rawDeviceData.skuNumber` | ⚠️ **Keep in JSONB** |

**Actions Required:**
- None - Network details are lower priority

---

### Organization & Groups (8 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `deviceCategory` | 🟡 In JSONB | `organizationDetails.category` | ⚠️ **Keep in JSONB** |
| `deviceCategoryDisplayName` | 🟡 In JSONB | `organizationDetails.category.displayName` | ⚠️ **Keep in JSONB** |
| `azureAdGroups` | 🟡 In JSONB | `organizationDetails.groups` | ⚠️ **Keep in JSONB** |
| `azureAdGroupDisplayNames` | 🟡 In JSONB | `organizationDetails.groups[].displayName` | ⚠️ **Keep in JSONB** |
| `managementAgent` | 🟡 In JSONB | `rawDeviceData.managementAgent` | ⚠️ **Keep in JSONB** |
| `registeredOwners` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |
| `registeredUsers` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |
| `deviceOwnership` | ✅ Migrated | `managedDeviceOwnerType` (flat) | None |

**Actions Required:**
- Create `GET /api/devices/[id]/organization` endpoint (optional - low priority)
- Add GIN index on `organizationDetails` JSONB column

---

### Autopilot & Provisioning (4 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `autopilotEnrolled` | 🟡 In JSONB | `autopilotDetails.enrolled` | ⚠️ **Keep in JSONB** |
| `autopilotGroupTag` | 🟡 In JSONB | `autopilotDetails.groupTag` | ⚠️ **Keep in JSONB** |
| `autopilotDeploymentProfile` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |
| `autopilotDeploymentState` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |

**Actions Required:**
- None - Autopilot is niche feature (Windows deployment only)

---

### Exchange ActiveSync (4 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `easActivated` | 🟡 In JSONB | `exchangeActivesyncDetails.activated` | ⚠️ **Keep in JSONB** |
| `easActivationDateTime` | 🟡 In JSONB | `exchangeActivesyncDetails.activationDate` | ⚠️ **Keep in JSONB** |
| `easDeviceId` | 🟡 In JSONB | `exchangeActivesyncDetails.deviceId` | ⚠️ **Keep in JSONB** |
| `easActivationResult` | ❌ Missing | N/A | ⚪ **Deprecated - don't migrate** |

**Actions Required:**
- None - EAS is legacy feature (replaced by modern email clients)

---

### Lost Mode (iOS) (4 props) - 🟡 ALL IN JSONB

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `lostModeState` | 🟡 In JSONB | `lostModeDetails.state` | ⚠️ **Keep in JSONB** |
| `lostModeEnabled` | 🟡 In JSONB | `lostModeDetails.isEnabled` | ⚠️ **Keep in JSONB** |
| `lostModeMessage` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |
| `lostModePhoneNumber` | ❌ Missing | N/A | ⚠️ **Fetch from Graph (low priority)** |

**Actions Required:**
- None - Lost Mode is iOS-only, niche feature

---

### **P1 Summary: 68 properties**
- ✅ **Fully migrated:** 12 (18%)
- 🟡 **Partially migrated (in JSONB):** 58 (85%)
- ❌ **Missing:** 8 (12%)

**Critical Actions:**
1. Create 5 new API endpoints (security, apps, analytics, configuration, hardware)
2. Add 5 UI tabs (Security, Apps, Analytics, Configuration, Hardware)
3. Add GIN indexes on 5 JSONB columns

---

## NICE to Have (P2) - 87 Properties

### Device Actions History (6 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `deviceManagementTroubleshootingEvents` | 🟡 In JSONB (`actionsHistory`) | Keep in JSONB |
| `remoteActionAudit` | 🟡 In JSONB (`actionsHistory`) | Keep in JSONB |
| `lastDeviceActionDateTime` | ❌ Missing | Compute from `actionsHistory` |
| `lastDeviceAction` | ❌ Missing | Compute from `actionsHistory` |
| `deviceActionResults` | 🟡 In JSONB (`actionsHistory`) | Keep in JSONB |
| `pendingActions` | ❌ Missing | Fetch from Graph (low priority) |

---

### Warranty & Lifecycle (8 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `warrantyStartDate` | ❌ Missing | Requires third-party API |
| `warrantyEndDate` | ❌ Missing | Requires third-party API |
| `inWarranty` | ❌ Missing | Compute from warranty dates |
| `hardwareRefreshDate` | ❌ Missing | Admin-defined field |
| `deviceAge` | ❌ Missing | Compute from `enrolledAt` |
| `estimatedLifespan` | ❌ Missing | Admin-defined policy |
| `replacementStatus` | ❌ Missing | Admin workflow field |
| `deviceLifecycleState` | ❌ Missing | Compute from age + warranty |

---

### Extended Hardware Details (15 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `biosVersion` | 🟡 In JSONB (`rawDeviceData`) | Keep in JSONB |
| `firmwareVersion` | 🟡 In JSONB (`rawDeviceData`) | Keep in JSONB |
| `cpuManufacturer` | 🟡 In JSONB (`rawDeviceData`) | Keep in JSONB |
| `cpuCores` | 🟡 In JSONB (`rawDeviceData`) | Keep in JSONB |
| `cpuSpeed` | 🟡 In JSONB (`rawDeviceData`) | Keep in JSONB |
| `screenResolution` | ❌ Missing | Not in Graph API |
| `displaySizeInches` | ❌ Missing | Not in Graph API |
| `batteryCapacity` | ❌ Missing | Not in Graph API |
| `batteryChargeCycles` | ❌ Missing | Not in Graph API |
| `storageType` | 🟡 In JSONB (`analyticsDetails.diskType`) | Keep in JSONB |
| `touchScreenEnabled` | ❌ Missing | Not in Graph API |
| `penEnabled` | ❌ Missing | Not in Graph API |
| `cameraEnabled` | ❌ Missing | Not in Graph API |
| `microphoneEnabled` | ❌ Missing | Not in Graph API |
| `bluetoothEnabled` | ❌ Missing | Not in Graph API |

---

### Crash & Reliability (12 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `crashes` | ❌ Missing | Requires separate Graph API call |
| `crashCount` | 🟡 In JSONB (`analyticsDetails.blueScreenCount`) | Keep in JSONB |
| `lastCrashDateTime` | ❌ Missing | Requires crash tracking |
| `crashReports` | ❌ Missing | Requires crash tracking |
| `appCrashes` | ❌ Missing | Requires crash tracking |
| `appCrashCount` | ❌ Missing | Requires crash tracking |
| `topCrashedApps` | ❌ Missing | Compute from crash data |
| `systemHangs` | ❌ Missing | Not in Graph API |
| `kernelPanics` | ❌ Missing | macOS/iOS only, not in Graph |
| `blueScreenOfDeath` | 🟡 In JSONB (`analyticsDetails.blueScreenCount`) | Keep in JSONB |
| `eventViewerErrors` | ❌ Missing | Not in Graph API |
| `reliabilityIndex` | 🟡 In JSONB (`analyticsDetails.appReliabilityScore`) | Keep in JSONB |

---

### Network Advanced (10 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `connectedNetworkName` | ❌ Missing | Not in Graph API (dynamic) |
| `wifiSignalStrength` | ❌ Missing | Not in Graph API (dynamic) |
| `vpnConnected` | ❌ Missing | Not in Graph API (dynamic) |
| `vpnConfiguration` | 🟡 In JSONB (`configurationDetails`) | Keep in JSONB |
| `proxyConfiguration` | 🟡 In JSONB (`configurationDetails`) | Keep in JSONB |
| `dnsServers` | ❌ Missing | Not in Graph API |
| `gatewayAddress` | ❌ Missing | Not in Graph API |
| `dhcpEnabled` | ❌ Missing | Not in Graph API |
| `networkAdapterType` | ❌ Missing | Not in Graph API |
| `cellularConnectionStrength` | ❌ Missing | Not in Graph API (dynamic) |

---

### Certificates & Encryption (8 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `certificates` | 🟡 In JSONB (`configurationDetails`) | Keep in JSONB |
| `certificateExpiration` | 🟡 In JSONB (`configurationDetails`) | Keep in JSONB |
| `expiredCertificates` | ❌ Missing | Compute from certificate data |
| `encryptionMethod` | ❌ Missing | Not directly in Graph API |
| `encryptionKeyType` | ❌ Missing | Not directly in Graph API |
| `fileVaultEnabled` | 🟡 In JSONB (`securityDetails`) | Keep in JSONB |
| `bitLockerEncryptionMethod` | 🟡 In JSONB (`securityDetails`) | Keep in JSONB |
| `deviceEncryptionPercentage` | ❌ Missing | Not in Graph API |

---

### User Behavior & Usage (10 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `lastLoginDateTime` | ❌ Missing | Available in Azure AD Sign-ins |
| `loginFrequency` | ❌ Missing | Compute from sign-in logs |
| `activeHoursPerDay` | ❌ Missing | Not in Graph API |
| `mostUsedApps` | ❌ Missing | Compute from app usage data |
| `screenTimeDaily` | ❌ Missing | Not in Graph API |
| `idleTime` | ❌ Missing | Not in Graph API |
| `dataUsageCellular` | ❌ Missing | Not in Graph API |
| `dataUsageWifi` | ❌ Missing | Not in Graph API |
| `lastActiveDateTime` | 🟡 In JSONB (`rawDeviceData.lastContactedDateTime`) | Keep in JSONB |
| `userProductivityScore` | ❌ Missing | Requires Microsoft Viva Insights |

---

### Conditional Access & Policies (8 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `conditionalAccessPolicies` | ❌ Missing | Fetch from Graph (global policies) |
| `conditionalAccessStatus` | ❌ Missing | Compute from policy evaluation |
| `conditionalAccessFailures` | ❌ Missing | Requires Azure AD logs |
| `namedLocations` | ❌ Missing | Fetch from Graph (global config) |
| `trustedNetworks` | ❌ Missing | Fetch from Graph (global config) |
| `accessDeniedCount` | ❌ Missing | Requires Azure AD logs |
| `mfaRegistered` | ❌ Missing | Fetch from Azure AD (user property) |
| `mfaEnforced` | ❌ Missing | Fetch from Azure AD (user property) |

---

### Extended Compliance (10 props)

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `complianceExpirationDate` | 🟡 Partial | Add `complianceGracePeriodExpiration` (P0) |
| `complianceErrors` | 🟡 In JSONB (`complianceDetails`) | Keep in JSONB |
| `policyViolations` | 🟡 In JSONB (`complianceDetails`) | Keep in JSONB |
| `remediationRequired` | ❌ Missing | Compute from compliance state |
| `remediationSteps` | ❌ Missing | Not in Graph API |
| `complianceTrendHistory` | ✅ Migrated | `compliance_history` table | None |
| `complianceScore` | ❌ Missing | Compute from policy compliance |
| `securityScore` | ❌ Missing | Requires Microsoft Secure Score API |
| `configurationScore` | ❌ Missing | Compute from config compliance |
| `complianceCertifications` | ❌ Missing | Admin-defined tags |

---

### **P2 Summary: 87 properties**
- ✅ **Migrated:** 10 (11%)
- 🟡 **In JSONB:** 62 (71%)
- ❌ **Missing:** 15 (17%)

**Actions:**
- Defer to Phase 5 (nice-to-have features)
- Evaluate based on user demand
- Some require third-party APIs (warranty) or separate systems (crash tracking)

---

## WON'T Have (P3) - 75 Properties

### Deprecated Features (20 props)

**Exchange ActiveSync (Deprecated):**
- `easStatus` - Replaced by modern email clients
- `easLastSuccessfulSyncDateTime` - Deprecated
- `easLastSyncAttemptDateTime` - Deprecated
- `easPolicyApplied` - Deprecated
- `easPolicyCompliantDateTime` - Deprecated

**Legacy MDM (Deprecated):**
- `mdmAppConfigKeyName` - Replaced by modern config profiles
- `mdmStatus` - Replaced by `managementState`
- `mdmEnrollmentDateTime` - Replaced by `enrolledAt`
- `windowsActiveMalwareCount` - Replaced by Windows Defender status
- `windowsRemediatedMalwareCount` - Replaced by Windows Defender status

**OpenSearch-Specific:**
- `_index` - OpenSearch metadata
- `_type` - OpenSearch metadata
- `_score` - OpenSearch relevance score
- `_source` - OpenSearch document source
- `sortOrder` - UI state, not device data

**Replaced by Modern Alternatives:**
- `udid` - Replaced by `azureId` + `serialNumber`
- `hardwareId` - Ambiguous, use specific IDs (IMEI, serial, etc.)
- `phoneNumberV2` - Duplicate, use `phoneNumber`
- `ethernetMacAddressV2` - Duplicate, use `ethernetMac`
- `wifiMacAddressV2` - Duplicate, use `wifiMac`

---

### Not Available in Graph API (25 props)

**Device State (Dynamic - Not Stored):**
- `isActive` - Compute from `lastSyncAt`
- `isRoaming` - Dynamic network state
- `batteryLevel` - Dynamic, not stored
- `batteryCharging` - Dynamic, not stored
- `screenLocked` - Dynamic, not stored
- `inUse` - Dynamic, not stored

**Environmental Data:**
- `location` - Privacy concern, not in Graph API
- `altitude` - Not in Graph API
- `locationAccuracy` - Not in Graph API
- `locationTimestamp` - Not in Graph API
- `geofenceBreach` - Requires separate geofencing system

**Performance Metrics (Real-Time):**
- `cpuUsagePercent` - Real-time metric, not stored
- `memoryUsagePercent` - Real-time metric, not stored
- `diskQueueLength` - Real-time metric, not stored
- `networkLatency` - Real-time metric, not stored
- `diskIOPS` - Real-time metric, not stored

**Third-Party Integrations:**
- `antivirusVendor` - Requires third-party API (beyond Defender)
- `antivirusProductName` - Requires third-party API
- `antivirusEngineVersion` - Requires third-party API
- `dlpStatus` - Requires DLP product integration (Symantec, etc.)
- `backupStatus` - Requires backup product integration
- `backupLastSuccessful` - Requires backup product integration
- `cloudStorageUsage` - Requires cloud storage API (OneDrive, Dropbox)
- `printJobCount` - Requires print server integration
- `scanJobCount` - Requires scanner/copier integration

---

### Out of Scope (30 props)

**User Properties (Belong in Users Table):**
- `userJobTitle` - In `users` table
- `userManager` - Should be in `users` table
- `userCompany` - Should be in `users` table
- `userCountry` - Should be in `users` table
- `userState` - Should be in `users` table
- `userCity` - Should be in `users` table
- `userStreetAddress` - Should be in `users` table
- `userPostalCode` - Should be in `users` table
- `userBusinessPhones` - Should be in `users` table

**Custom Fields (Not Standardized):**
- `customAttribute1` - Admin-defined, not in Graph API
- `customAttribute2` - Admin-defined, not in Graph API
- `customAttribute3` - Admin-defined, not in Graph API
- `tags` - Admin-defined, not in Graph API
- `labels` - Admin-defined, not in Graph API
- `costCenter` - Finance system, not MDM
- `purchaseDate` - Finance system, not MDM
- `purchasePrice` - Finance system, not MDM
- `vendor` - Finance system, not MDM
- `assetTag` - Asset management system, not MDM

**Low-Value Fields:**
- `deviceDescription` - Rarely used
- `deviceColor` - Not available, low value
- `deviceWeight` - Not available, low value
- `deviceDimensions` - Not available, low value
- `boxSerialNumber` - Packaging info, not device management
- `oemWarrantyVoid` - Niche field
- `isUniversal` - Ambiguous, unclear meaning
- `isManaged` - All devices in Intune are managed (redundant)
- `requireUserEnrollmentApproval` - Enrollment policy, not device property
- `enrollmentProfileName` - Niche, rarely used
- `complianceGracePeriodExpirationDateTime` - **WAIT - This is P0!** (Moved to P0 list)

---

### **P3 Summary: 75 properties**
- ✅ **Intentionally not migrated:** 75 (100%)
- Reasons: Deprecated, not in Graph API, out of scope, low value

---

## User Properties Classification

### MUST Have (P0) - 8 Properties

| **Property** | **Current Status** | **Storage Location** | **Action** |
|--------------|-------------------|---------------------|------------|
| `id` | ✅ Migrated | `id` (flat) | None |
| `azureId` | ✅ Migrated | `azureId` (flat) | None |
| `email` | ✅ Migrated | `email` (flat) | None |
| `displayName` | ✅ Migrated | `displayName` (flat) | None |
| `givenName` | ❌ **MISSING** | N/A | 🔴 **Add flat column** |
| `surname` | ❌ **MISSING** | N/A | 🔴 **Add flat column** |
| `jobTitle` | ✅ Migrated | `jobTitle` (flat) | None |
| `department` | ✅ Migrated | `department` (flat) | None |

**Actions Required:**
1. Add `givenName` flat column
2. Add `surname` flat column
3. Update user sync service to fetch from Graph API

---

### SHOULD Have (P1) - 12 Properties

| **Property** | **Current Status** | **Action** |
|--------------|-------------------|------------|
| `mobilePhone` | ❌ **MISSING** | 🔴 **Add flat column** |
| `businessPhones` | ❌ **MISSING** | 🔴 **Add flat column (JSONB array)** |
| `officeLocation` | ❌ **MISSING** | 🔴 **Add flat column** |
| `userPrincipalName` | ✅ Migrated | None - stored in `email` |
| `accountEnabled` | ❌ Missing | Fetch from Graph API |
| `userType` | ❌ Missing | Fetch from Graph API (Member/Guest) |
| `assignedLicenses` | ❌ Missing | Fetch from Graph API |
| `usageLocation` | ❌ Missing | Fetch from Graph API |
| `preferredLanguage` | ❌ Missing | Fetch from Graph API |
| `manager` | ❌ Missing | Fetch from Graph API |
| `directReports` | ❌ Missing | Fetch from Graph API |
| `lastSignInDateTime` | ❌ Missing | Fetch from Graph API |

**Actions Required:**
1. Add 3 new flat columns: `mobilePhone`, `officeLocation`, `businessPhones`
2. Consider adding user detail endpoint for remaining properties

---

### NICE to Have (P2) - 35 Properties

**Identity & Authentication:**
- `onPremisesSyncEnabled`
- `onPremisesSamAccountName`
- `onPremisesDistinguishedName`
- `passwordProfile`
- `passwordPolicies`
- `proxyAddresses`
- `mailNickname`

**Organization:**
- `companyName`
- `country`
- `state`
- `city`
- `streetAddress`
- `postalCode`
- `employeeId`
- `employeeType`
- `employeeHireDate`
- `division`

**Contact:**
- `faxNumber`
- `otherMails`
- `imAddresses`

**Attributes:**
- `aboutMe`
- `skills`
- `interests`
- `responsibilities`
- `schools`

**Activity:**
- `createdDateTime`
- `lastPasswordChangeDateTime`
- `signInActivity`
- `deviceUsageRights`

**Groups & Roles:**
- `memberOf`
- `assignedPlans`
- `provisionedPlans`

---

### WON'T Have (P3) - 45 Properties

**Low-Value Fields:**
- `ageGroup`
- `birthday`
- `hireDate` (duplicate of employeeHireDate)
- `mySite`
- `pastProjects`
- `preferredName`
- `schoolNickname`
- `legalAgeGroupClassification`

**External Identity:**
- `externalUserState`
- `externalUserStateChangeDateTime`
- `identities`

**Legacy:**
- `mailboxSettings`
- `calendar`
- `contacts`
- `drives`
- `messages`
- `people`

---

## Implementation Roadmap

### Phase 2: Critical Schema Updates (Week 3-4)

**Devices Table - Add 5 P0 Flat Columns (3 hours):**

```sql
-- Add missing P0 columns
ALTER TABLE devices 
  ADD COLUMN compliance_grace_period_expiration TIMESTAMP,
  ADD COLUMN partner_reported_threat_state VARCHAR(50),
  ADD COLUMN notes TEXT,
  ADD COLUMN imei VARCHAR(50),
  ADD COLUMN phone_number VARCHAR(50);

-- Add indexes
CREATE INDEX idx_devices_compliance_grace ON devices (compliance_grace_period_expiration);
CREATE INDEX idx_devices_threat_state ON devices (partner_reported_threat_state);
```

**Users Table - Add 4 P0 Flat Columns (2 hours):**

```sql
-- Add missing P0 columns
ALTER TABLE users
  ADD COLUMN given_name VARCHAR(255),
  ADD COLUMN surname VARCHAR(255),
  ADD COLUMN mobile_phone VARCHAR(50),
  ADD COLUMN office_location VARCHAR(255);
```

**Add Critical Indexes (2 hours):**

```sql
-- Flat column indexes (P0)
CREATE INDEX idx_devices_is_compliant ON devices (is_compliant);
CREATE INDEX idx_devices_operating_system ON devices (operating_system);
CREATE INDEX idx_devices_jail_broken ON devices (jail_broken);
CREATE INDEX idx_devices_user_id ON devices (user_id);

-- JSONB GIN indexes (P0)
CREATE INDEX idx_security_details ON devices USING GIN (security_details);
CREATE INDEX idx_detected_apps_details ON devices USING GIN (detected_apps_details);
CREATE INDEX idx_compliance_details ON devices USING GIN (compliance_details);
```

**Update Sync Services (4 hours):**
- Update `deviceSync.ts` to populate new flat columns
- Update `userSync.ts` to fetch new user properties
- Test sync with sample devices

**Total Phase 2: 11 hours**

---

### Phase 3: API Development (Week 5-6)

**Update Existing Endpoints (1 hour):**

```typescript
// app/api/devices/route.ts - Add to list response
export async function GET() {
  const devices = await db.select({
    // ... existing fields ...
    jailBroken: devices.jailBroken,          // ADD
    batteryHealth: devices.batteryHealth,    // ADD
  });
}
```

**New Device Detail Endpoints (15 hours):**

1. **Security Posture** (4 hours)
   - `GET /api/devices/[id]/security`
   - Extract from `securityDetails` JSONB
   - Return BitLocker, Defender, Firewall, TPM, Secure Boot

2. **App Inventory** (4 hours)
   - `GET /api/devices/[id]/apps`
   - Extract from `detectedAppsDetails` JSONB
   - Return app list with name, version, publisher, size

3. **Endpoint Analytics** (4 hours)
   - `GET /api/devices/[id]/analytics`
   - Extract from `analyticsDetails` JSONB
   - Return boot score, login score, crashes, reliability

4. **Configuration Profiles** (3 hours)
   - `GET /api/devices/[id]/configuration`
   - Extract from `configurationDetails` JSONB
   - Return applied profiles with state

**New Aggregate Endpoints (3 hours):**

5. **Fleet Security Posture** (2 hours)
   - `GET /api/devices/security-posture`
   - Aggregate security metrics across fleet
   - Return % encrypted, % defender updated, % firewall enabled

6. **Fleet App Inventory** (1 hour)
   - `GET /api/devices/apps/inventory`
   - Aggregate unique apps across fleet
   - Return app name, device count, versions

**Total Phase 3: 19 hours**

---

### Phase 4: UI Development (Week 7-8)

**Device Detail Tabs (22 hours):**

1. **Security Tab** (6 hours)
   - Display BitLocker status with icon
   - Display Windows Defender status (version, last scan)
   - Display Firewall status
   - Display TPM version
   - Display Secure Boot status
   - Display Code Integrity status

2. **Apps Tab** (6 hours)
   - Data table with installed applications
   - Columns: Name, Version, Publisher, Size, Detected Date
   - Search, filter, sort functionality
   - Export to CSV

3. **Analytics Tab** (6 hours)
   - Performance score cards (Boot, Login, Overall, Reliability)
   - Performance metrics chart (boot time, login time)
   - Stability metrics (restart count, blue screen count)
   - Health status badge

4. **Configuration Tab** (4 hours)
   - Data table with applied configuration profiles
   - Columns: Profile Name, State, Settings Count, Platform, Last Reported
   - Filter by state (compliant, noncompliant, error)

**Device List Enhancements (2 hours):**
- Add jailbreak badge to list view
- Add battery health badge to list view
- Update filters to include new fields

**Fleet Dashboards (12 hours):**

5. **Security Dashboard** (8 hours)
   - Security posture overview (% encrypted, % defender updated)
   - Security alerts (devices needing attention)
   - Security trends chart
   - Top security issues list

6. **App Inventory Page** (4 hours)
   - Fleet-wide app inventory table
   - Group by app name, show device count
   - Filter by publisher, version
   - Export to CSV for license audits

**Total Phase 4: 36 hours**

---

### Phase 5: Nice-to-Have (Week 9-12) - Optional

**P2 Features (35 hours):**

1. **Device Actions Endpoint + UI** (10 hours)
   - Extract from `actionsHistory` JSONB
   - Display wipe, retire, reboot, reset actions
   - Action timeline view

2. **Warranty Tracking** (12 hours)
   - Integrate with third-party warranty API (Dell, HP, Lenovo)
   - Add `warrantyDetails` JSONB column
   - Display warranty status in device detail
   - Warranty expiration alerts

3. **Lost Mode Visibility** (2 hours)
   - Display Lost Mode status for iOS devices
   - Show lock screen message and contact phone

4. **Advanced Reporting** (11 hours)
   - Custom report builder
   - Schedule automated reports
   - Export formats (PDF, Excel, CSV)
   - Email delivery

**Total Phase 5: 35 hours (optional)**

---

### Total Implementation

| **Phase** | **Hours** | **Weeks** | **Priority** |
|-----------|-----------|-----------|--------------|
| Phase 2: Schema Updates | 11 | 0.3 | 🔴 P0 |
| Phase 3: API Development | 19 | 0.5 | 🔴 P0 |
| Phase 4: UI Development | 36 | 1.0 | 🟠 P1 |
| Phase 5: Nice-to-Have | 35 | 1.0 | 🟢 P2 |
| **Total** | **101** | **2.8** | - |

**Critical Path (P0 + P1): 66 hours (~2 weeks)**

---

## Validation & Sign-off

### Stakeholder Approval Checklist

**Security Team:**
- [ ] Approves security property classification (BitLocker, Defender, jailbreak)
- [ ] Approves security endpoint specification
- [ ] Approves security dashboard design

**IT Operations:**
- [ ] Approves app inventory property classification
- [ ] Approves endpoint analytics property classification
- [ ] Approves configuration profile property classification

**Mobile Admin:**
- [ ] Approves mobile device properties (IMEI, phone number, battery health)
- [ ] Approves jailbreak visibility in list view

**Compliance Team:**
- [ ] Approves compliance property classification
- [ ] Approves audit reporting capabilities

**Executive Leadership:**
- [ ] Approves Phase 2-4 budget (66 hours)
- [ ] Approves project timeline (6-8 weeks)
- [ ] Approves resource allocation

---

### Next Steps

1. ✅ **Phase 1.9: Storage Strategy Decision** (next document)
   - Flat columns vs. JSONB trade-offs
   - Index strategy finalization
   - Performance benchmarks

2. ✅ **Phase 1.10: Stakeholder Review** (final document)
   - Present all Phase 1 findings
   - Get sign-off on classification
   - Approve Phase 2-4 execution

3. 🚀 **Phase 2: Begin Implementation** (Week 3)
   - Add flat columns
   - Add indexes
   - Update sync services
   - **Test with TDD methodology**

---

**Document Version:** 1.0  
**Created:** February 10, 2026  
**Author:** FleetWatch Migration Team  
**Status:** Draft - Awaiting Stakeholder Review
