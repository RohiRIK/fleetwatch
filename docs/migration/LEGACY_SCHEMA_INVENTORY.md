# Legacy Schema Inventory

**Purpose:** Complete inventory of all properties in the legacy OpenSearch-based schema.

**Created:** February 10, 2026  
**Status:** Phase 1.4 - Completed  
**Related:** [NEW_SCHEMA_INVENTORY.md](./NEW_SCHEMA_INVENTORY.md) | [UI_DATA_USAGE_MAP.md](./UI_DATA_USAGE_MAP.md)

---

## Table of Contents

1. [Legacy Schema Overview](#legacy-schema-overview)
2. [Device Schema Properties](#device-schema-properties)
3. [User Schema Properties](#user-schema-properties)
4. [Supporting Schema Files](#supporting-schema-files)
5. [Property Count Summary](#property-count-summary)
6. [Key Insights](#key-insights)

---

## Legacy Schema Overview

### Storage Technology
- **Database:** OpenSearch (Elasticsearch fork)
- **Document Model:** Unified documents with nested objects
- **Schema Files:** 11 TypeScript interface files in `legacy/api-ts/src/schemas/`

### Design Philosophy
- **Denormalization:** Heavily denormalized for query performance
- **Single Documents:** All related data in one document (e.g., device + user + compliance + configuration)
- **Top-level Convenience Fields:** Frequently queried fields promoted to top level
- **Nested Objects:** Detailed data stored in nested structures
- **Data Quality Tracking:** Explicit metadata about which data is available

---

## Device Schema Properties

**File:** `legacy/api-ts/src/schemas/device.schema.ts` (1,124 lines)

### Total Property Count: ~230 properties across 20 nested categories

---

### Category 1: Core Identity (10 properties)

| **Property Path** | **Type** | **Description** | **OpenSearch Type** |
|-------------------|----------|-----------------|---------------------|
| `id` | string | Primary key (managedDevice.id from Intune) | keyword |
| `azureAdDeviceId` | string? | Azure AD device ID | keyword |
| `serialNumber` | string? | Hardware serial number | keyword |
| `deviceName` | string | Device display name | text + keyword |
| `manufacturer` | string? | Device manufacturer | keyword |
| `model` | string? | Device model | keyword |
| `operatingSystem` | string | OS name (Windows, macOS, iOS, Android) | keyword |
| `osVersion` | string? | OS version string | keyword |
| `joinType` | string? | Azure AD join type | keyword |
| `enrollmentType` | string? | Intune enrollment type | keyword |

---

### Category 2: Management & Enrollment (5 properties)

| **Property Path** | **Type** | **Description** | **OpenSearch Type** |
|-------------------|----------|-----------------|---------------------|
| `managementState` | string? | Current management state | keyword |
| `lastSyncDateTime` | string? | Last Intune sync timestamp | date |
| `enrolledDateTime` | string? | Initial enrollment timestamp | date |
| `managedDeviceOwnerType` | string? | Corporate / Personal / Unknown | keyword |
| `managementAgent` | string? | MDM agent type | keyword |

---

### Category 3: Top-Level Convenience Fields (10 properties)

**Purpose:** Denormalized for fast querying without nested object access

| **Property Path** | **Type** | **Description** | **Source** |
|-------------------|----------|-----------------|------------|
| `isCompliant` | boolean? | Compliance status | Denormalized from `compliance.state` |
| `complianceState` | string? | Raw Intune compliance state | Compliance API |
| `isEncrypted` | boolean? | BitLocker/FileVault enabled | Denormalized from `network.isEncrypted` |
| `isSupervised` | boolean? | Device supervised (iOS/iPadOS) | Denormalized from `network.isSupervised` |
| `jailBroken` | string? | Jailbreak/root detection | Device hardware info |
| `userPrincipalName` | string? | User UPN | Denormalized from `user.upn` |
| `userDisplayName` | string? | User display name | Denormalized from `user.displayName` |
| `totalStorageSpaceInBytes` | number? | Total storage capacity | Denormalized from `hardware.totalStorageSpaceInBytes` |
| `freeStorageSpaceInBytes` | number? | Free storage space | Denormalized from `hardware.freeStorageSpaceInBytes` |
| `batteryHealthPercentage` | number? | Battery health (0-100) | Denormalized from `hardware.batteryHealthPercentage` |

---

### Category 4: Hardware Information (30 properties)

**Nested Object:** `hardware`

#### Storage (2 properties)
- `hardware.totalStorageSpaceInBytes` (number) - Total storage capacity
- `hardware.freeStorageSpaceInBytes` (number) - Free storage space

#### Memory (1 property)
- `hardware.physicalMemoryInBytes` (number) - Total RAM

#### System Enclosure (1 property)
- `hardware.chassisType` (string) - Desktop, Laptop, Tablet, Phone, etc.

#### Network Adapters (2 properties)
- `hardware.wiFiMacAddress` (string) - WiFi MAC address
- `hardware.ethernetMacAddress` (string) - Ethernet MAC address

#### Mobile Devices (6 properties)
- `hardware.imei` (string) - International Mobile Equipment Identity
- `hardware.meid` (string) - Mobile Equipment Identifier
- `hardware.iccid` (string) - Integrated Circuit Card ID (SIM)
- `hardware.udid` (string) - Unique Device Identifier (iOS)
- `hardware.phoneNumber` (string) - Mobile phone number
- `hardware.subscriberCarrier` (string) - Mobile carrier name

#### Battery & Power (5 properties)
- `hardware.batterySerialNumber` (string) - Battery serial number
- `hardware.batteryHealthPercentage` (number) - Battery health (0-100)
- `hardware.batteryChargeCycles` (number) - Total charge cycles
- `hardware.batteryLevelPercentage` (number) - Current charge level
- `hardware.residentUsersCount` (number) - Number of user profiles

#### System Details (6 properties)
- `hardware.productName` (string) - Product SKU name
- `hardware.deviceFullQualifiedDomainName` (string) - FQDN
- `hardware.deviceGuardVirtualizationBasedSecurityHardwareRequirementState` (string) - VBS hardware state
- `hardware.deviceGuardVirtualizationBasedSecurityState` (string) - VBS enabled state
- `hardware.deviceGuardLocalSystemAuthorityCredentialGuardState` (string) - Credential Guard state

---

### Category 5: Network Details (7 properties)

**Nested Object:** `network`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `network.ipAddressV4` | string? | IPv4 address |
| `network.ipAddressV6` | string? | IPv6 address |
| `network.subnetAddress` | string? | Subnet address |
| `network.wifiMac` | string? | WiFi MAC address |
| `network.ethernetMac` | string? | Ethernet MAC address |
| `network.isEncrypted` | boolean? | Encryption enabled |
| `network.isSupervised` | boolean? | Supervised device (iOS) |

---

### Category 6: Conditional Access (15+ properties)

**Nested Object:** `conditionalAccess`

#### Device Registration (1 property)
- `conditionalAccess.deviceRegistrationState` (string) - Registration state

#### Policies Applied (Array of objects)
`conditionalAccess.policies[]` - Each policy has:
- `policyId` (string) - Unique policy ID
- `policyName` (string) - Human-readable name
- `state` (string) - Applied/Not Applied
- `lastModified` (string) - Last modified timestamp

#### Named Locations (Array of objects)
`conditionalAccess.locations[]` - Each location has:
- `locationId` (string) - Unique location ID
- `locationName` (string) - Location display name
- `isTrusted` (boolean) - Trusted location flag

---

### Category 7: Autopilot & Provisioning (4 properties)

**Nested Object:** `autopilot`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `autopilot.enrolled` | boolean? | Enrolled in Autopilot |
| `autopilot.profileName` | string? | Autopilot profile name |
| `autopilot.deploymentProfileAssigned` | string? | Deployment profile assigned |
| `autopilot.groupTag` | string? | Group tag for Autopilot |

---

### Category 8: Exchange ActiveSync (6 properties)

**Nested Object:** `exchangeActiveSync`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `exchangeActiveSync.easActivated` | boolean? | EAS activated |
| `exchangeActiveSync.easDeviceId` | string? | EAS device ID |
| `exchangeActiveSync.easActivationDateTime` | string? | Activation timestamp |
| `exchangeActiveSync.exchangeLastSuccessfulSyncDateTime` | string? | Last successful sync |
| `exchangeActiveSync.exchangeAccessState` | string? | Access state (Allowed/Blocked) |
| `exchangeActiveSync.exchangeAccessStateReason` | string? | Reason for access state |

---

### Category 9: Management Details (9 properties)

**Nested Object:** `management`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `management.managedDeviceOwnerType` | string? | Owner type |
| `management.managementAgent` | string? | Agent type |
| `management.managementCertificateExpirationDate` | string? | Cert expiration |
| `management.managementFeatures` | string? | Management features |
| `management.remoteAssistanceSessionUrl` | string? | Remote assist URL |
| `management.remoteAssistanceSessionErrorDetails` | string? | Remote assist errors |
| `management.requireUserEnrollmentApproval` | boolean? | User approval required |
| `management.userPrincipalName` | string? | User UPN |
| `management.enrollmentProfileName` | string? | Enrollment profile |

---

### Category 10: Configuration Manager (3 properties)

**Nested Object:** `configurationManager`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `configurationManager.clientHealthState` | any | Client health state |
| `configurationManager.clientInformation` | any | Client information |
| `configurationManager.clientEnabledFeatures` | any | Enabled features |

---

### Category 11: Security & Threat (1 property)

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `partnerReportedThreatState` | string? | Third-party threat detection state |

---

### Category 12: Lost Mode (iOS) (4 properties)

**Nested Object:** `lostMode`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `lostMode.state` | string? | Lost mode state |
| `lostMode.message` | string? | Lock screen message |
| `lostMode.phoneNumber` | string? | Contact phone |
| `lostMode.footnote` | string? | Lock screen footnote |

---

### Category 13: Device Notes (1 property)

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `notes` | string? | Admin notes/comments |

---

### Category 14: Role Scope Tags (1 property)

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `roleScopeTagIds` | string[]? | RBAC scope tags |

---

### Category 15: Malware Detection (2 properties)

**Nested Object:** `malware`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `malware.activeMalwareCount` | number? | Active malware detections |
| `malware.remediatedMalwareCount` | number? | Remediated malware count |

---

### Category 16: User Association (5 properties)

**Nested Object:** `user`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `user.id` | string? | User ID |
| `user.upn` | string? | User principal name |
| `user.displayName` | string? | User display name |
| `user.email` | string? | User email |
| `user.department` | string? | User department |

---

### Category 17: Compliance (25+ properties)

**Nested Object:** `compliance`

#### Core Compliance (2 properties)
- `compliance.state` (string) - 'compliant' | 'noncompliant' | 'unknown'
- `compliance.gracePeriodExpiration` (string) - Grace period expiration timestamp

#### Policy References (Array)
- `compliance.references[]` - Array of policy references (external type)

#### Compliance Policies (Array of objects)
`compliance.policies[]` - Each policy has:
- `id` (string) - Policy ID
- `name` (string) - Policy name
- `platformType` (string) - Windows/macOS/iOS/Android
- `state` (string) - Compliant/Non-compliant
- `version` (number) - Policy version
- `settingStates[]` - Array of setting states:
  - `setting` (string) - Setting name
  - `state` (string) - Compliant/Non-compliant
  - `errorCode` (string) - Error code if failed

#### Evaluation Timestamp (1 property)
- `compliance.lastEvaluated` (string) - Last evaluated timestamp

---

### Category 18: Configuration Status (20+ properties)

**Nested Object:** `configuration`

#### Configuration References (Array)
- `configuration.references[]` - Array of configuration references (external type)

#### Configuration Policies (Array of objects)
`configuration.policies[]` - Each policy has:
- `id` (string) - Policy ID
- `name` (string) - Policy name
- `platformType` (string) - Platform
- `state` (string) - Applied/Not Applied
- `version` (number) - Policy version
- `lastReported` (string) - Last reported timestamp
- `settings` (Record<string, any>) - Settings key-value pairs

#### Evaluation Timestamp (1 property)
- `configuration.lastEvaluated` (string) - Last evaluated timestamp

---

### Category 19: Security & Protection (30+ properties)

**Nested Object:** `security`

#### Windows Defender & Update Status (9 properties)
`security.protection` nested object:
- `defenderStatus` (string) - Defender service status
- `realTimeProtectionEnabled` (boolean) - Real-time protection on/off
- `quickScanOverdue` (boolean) - Quick scan overdue
- `fullScanOverdue` (boolean) - Full scan overdue
- `signatureUpdateOverdue` (boolean) - Signature update overdue
- `rebootRequired` (boolean) - Reboot required
- `pendingUpdates` (number) - Number of pending updates
- `lastUpdateCheckTime` (string) - Last update check timestamp

#### Device Health Attestation (7 properties)
`security.healthAttestation` nested object:
- `bitLockerStatus` (string) - BitLocker status
- `bootDebuggingEnabled` (boolean) - Boot debugging enabled
- `codeIntegrityEnabled` (boolean) - Code integrity enabled
- `secureBootEnabled` (boolean) - Secure Boot enabled
- `tpmPresent` (boolean) - TPM chip present
- `attestationState` (string) - Attestation state

#### Security Baselines (Array of objects)
`security.baselines[]` - Each baseline has:
- `id` (string) - Baseline ID
- `name` (string) - Baseline name
- `state` (string) - Applied/Not Applied
- `version` (number) - Baseline version

---

### Category 20: Device Actions History (10+ properties)

**Nested Object:** `actions`

#### Actions History (Array)
`actions.history[]` - Each action has:
- `actionName` (string) - Action name (Reboot, Wipe, Retire, etc.)
- `actionState` (string) - Pending/Completed/Failed
- `startDateTime` (string) - Action start timestamp
- `lastUpdatedDateTime` (string) - Last updated timestamp
- `userId` (string) - User who initiated action

#### Last Action Summary (3 properties)
`actions.lastAction` nested object:
- `name` (string) - Last action name
- `state` (string) - Last action state
- `timestamp` (string) - Last action timestamp

---

### Category 21: Organization & Groups (10+ properties)

**Nested Object:** `organization`

#### Device Category (2 properties)
`organization.category` nested object:
- `id` (string) - Category ID
- `displayName` (string) - Category name

#### Groups (Array of objects)
`organization.groups[]` - Each group has:
- `id` (string) - Group ID
- `displayName` (string) - Group name
- `groupType` (string) - Security/Distribution/Microsoft365

---

### Category 22: Endpoint Analytics (40+ properties)

**Nested Object:** `analytics`

#### Overall Scores (5 properties)
`analytics.scores` nested object:
- `overall` (number) - Overall score (0-100)
- `startup` (number) - Startup score
- `appReliability` (number) - App reliability score
- `battery` (number) - Battery score
- `workFromAnywhere` (number) - Work from anywhere score

#### Startup Performance (7 properties)
`analytics.startup` nested object:
- `coreBootTimeMs` (number) - Core boot time in ms
- `coreLoginTimeMs` (number) - Core login time in ms
- `responsiveDesktopTimeMs` (number) - Responsive desktop time in ms
- `restartCount` (number) - Restart count
- `blueScreenCount` (number) - Blue screen count
- `diskType` (string) - HDD/SSD/Unknown

#### App Reliability (4 properties)
`analytics.appReliability` nested object:
- `score` (number) - Reliability score
- `meanTimeToFailureMinutes` (number) - MTTF
- `crashCount` (number) - Total crashes
- `hangCount` (number) - Total hangs

#### Battery Analytics (5 properties)
`analytics.battery` nested object:
- `score` (number) - Battery score
- `healthStatus` (string) - Health status
- `ageInDays` (number) - Battery age
- `maxCapacityPercentage` (number) - Max capacity
- `estimatedRuntimeMinutes` (number) - Estimated runtime

---

### Category 23: Crashes (10+ properties)

**Nested Object:** `crashes`

#### Crash Summary (5 properties)
`crashes.summary` nested object:
- `total` (number) - Total crashes
- `last7Days` (number) - Crashes in last 7 days
- `lastCrashAt` (string) - Last crash timestamp
- `topApp` (string) - Top crashing app
- `topProcess` (string) - Top crashing process

#### Crash Events (Array)
`crashes.events[]` - Each crash has:
- `timestamp` (string) - Crash timestamp
- `appName` (string) - Application name
- `processName` (string) - Process name
- `version` (string) - App version
- `errorCode` (string) - Error code

---

### Category 24: Warranty (6 properties)

**Nested Object:** `warranty`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `warranty.status` | string | Warranty status |
| `warranty.startDate` | string? | Warranty start date |
| `warranty.endDate` | string? | Warranty end date |
| `warranty.daysRemaining` | number? | Days remaining |
| `warranty.inWarranty` | boolean | In warranty flag |
| `warranty.vendor` | string? | Warranty vendor |

---

### Category 25: Trends (Time-series) (10+ properties)

**Nested Object:** `trends`

#### Score Trends (Array)
`trends.scores[]` - Each data point has:
- `timestamp` (string) - Timestamp
- `value` (number) - Score value

#### Crash Trends (Array)
`trends.crashes[]` - Each data point has:
- `timestamp` (string) - Timestamp
- `count` (number) - Crash count

---

### Category 26: Data Quality Metadata (8 properties)

**Nested Object:** `dataQuality`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `dataQuality.hasCompliance` | boolean | Compliance data available |
| `dataQuality.hasConfiguration` | boolean | Configuration data available |
| `dataQuality.hasSecurity` | boolean | Security data available |
| `dataQuality.hasActions` | boolean | Actions data available |
| `dataQuality.hasAnalytics` | boolean | Analytics data available |
| `dataQuality.hasCrashes` | boolean | Crash data available |
| `dataQuality.hasWarranty` | boolean | Warranty data available |
| `dataQuality.lastEnrichedAt` | string | Last enrichment timestamp |

---

### Category 27: Ingestion Metadata (3 properties)

**Nested Object:** `ingestion`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `ingestion.timestamp` | string | Ingestion timestamp |
| `ingestion.source` | string | Data source (Graph API, etc.) |
| `ingestion.version` | string | Schema version |

---

## User Schema Properties

**File:** `legacy/api-ts/src/schemas/user.schema.ts` (322 lines)

### Total Property Count: ~100 properties across 10 nested categories

---

### Category 1: Core Identity (6 properties)

| **Property Path** | **Type** | **Description** | **OpenSearch Type** |
|-------------------|----------|-----------------|---------------------|
| `id` | string | Primary key (user.id from Azure AD) | keyword |
| `userPrincipalName` | string | UPN (email-like identifier) | keyword |
| `displayName` | string? | Display name | text + keyword |
| `givenName` | string? | First name | text + keyword |
| `surname` | string? | Last name | text + keyword |
| `mail` | string? | Primary email | keyword |

---

### Category 2: Employment Info (8 properties)

**Nested Object:** `employment`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `employment.jobTitle` | string? | Job title |
| `employment.department` | string? | Department |
| `employment.officeLocation` | string? | Office location |
| `employment.employeeId` | string? | Employee ID |
| `employment.employeeType` | string? | Employee type (FTE/Contractor) |
| `employment.companyName` | string? | Company name |
| `employment.hireDate` | string? | Hire date |
| `employment.leaveDate` | string? | Leave date (if terminated) |

---

### Category 3: Contact Info (4 properties)

**Nested Object:** `contact`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `contact.mobilePhone` | string? | Mobile phone number |
| `contact.businessPhones` | string[]? | Business phone numbers |
| `contact.otherEmails` | string[]? | Other email addresses |

---

### Category 4: Account Status (6 properties)

**Nested Object:** `account`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `account.enabled` | boolean | Account enabled/disabled |
| `account.userType` | string? | Member/Guest |
| `account.createdDateTime` | string? | Account creation date |
| `account.usageLocation` | string? | Usage location (country code) |
| `account.onPremisesSyncEnabled` | boolean? | Synced from on-premises AD |
| `account.securityIdentifier` | string? | Security identifier (SID) |

---

### Category 5: Licenses (20+ properties)

**Nested Object:** `licenses`

#### Assigned Licenses (Array)
`licenses.assigned[]` - Each license has:
- `skuId` (string) - SKU ID
- `skuPartNumber` (string) - SKU part number (e.g., "SPE_E3")
- `servicePlans[]` - Array of service plans:
  - `servicePlanId` (string) - Service plan ID
  - `servicePlanName` (string) - Service plan name
  - `provisioningStatus` (string) - Success/PendingInput/Disabled

#### License Summary (5 properties)
`licenses.summary` nested object:
- `totalLicenses` (number) - Total licenses assigned
- `activeServices` (number) - Active services count
- `hasIntuneEMS` (boolean) - Has Intune/EMS license
- `hasM365` (boolean) - Has Microsoft 365 license
- `hasAADP` (boolean) - Has Azure AD Premium license

---

### Category 6: Device Association (20+ properties)

**Nested Object:** `devices`

#### Managed Devices (Array)
`devices.managed[]` - Each device has:
- `deviceId` (string) - Device ID
- `deviceName` (string) - Device name
- `model` (string) - Device model
- `operatingSystem` (string) - OS name
- `complianceState` (string) - Compliance state
- `lastSync` (string) - Last sync timestamp

#### Device Summary (5 properties)
`devices.summary` nested object:
- `totalDevices` (number) - Total devices
- `compliantDevices` (number) - Compliant devices
- `nonCompliantDevices` (number) - Non-compliant devices
- `platforms` (Record<string, number>) - Platform distribution (e.g., {"Windows": 2, "iOS": 1})

---

### Category 7: Aggregated Device Analytics (20+ properties)

**Nested Object:** `analytics`

#### Overall Analytics (4 properties)
`analytics.overall` nested object:
- `averageScore` (number) - Average score across all devices
- `bestDevice` (string) - Best performing device
- `worstDevice` (string) - Worst performing device
- `needsAttention` (boolean) - Any device needs attention

#### Startup Analytics (2 properties)
`analytics.startup` nested object:
- `averageBootTimeMs` (number) - Average boot time
- `averageLoginTimeMs` (number) - Average login time

#### Reliability Analytics (4 properties)
`analytics.reliability` nested object:
- `totalCrashes` (number) - Total crashes across all devices
- `totalHangs` (number) - Total hangs
- `affectedDevices` (number) - Devices with crashes
- `crashesLast7Days` (number) - Crashes in last 7 days

#### Security Analytics (3 properties)
`analytics.security` nested object:
- `devicesWithDefenderIssues` (number) - Devices with Defender issues
- `devicesWithoutBitLocker` (number) - Devices without BitLocker
- `devicesWithPendingUpdates` (number) - Devices with pending updates

---

### Category 8: Sign-in Activity (10+ properties)

**Nested Object:** `signInActivity`

#### Sign-in Timestamps (3 properties)
- `signInActivity.lastSignInDateTime` (string) - Last interactive sign-in
- `signInActivity.lastNonInteractiveSignInDateTime` (string) - Last non-interactive sign-in
- `signInActivity.lastSuccessfulSignIn` (string) - Last successful sign-in

#### Recent Applications (Array)
`signInActivity.recentApplications[]` - Each app has:
- `appDisplayName` (string) - App name
- `appId` (string) - App ID
- `signInDateTime` (string) - Sign-in timestamp
- `resourceDisplayName` (string) - Resource accessed

---

### Category 9: Data Quality Metadata (5 properties)

**Nested Object:** `dataQuality`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `dataQuality.hasLicenses` | boolean | Licenses data available |
| `dataQuality.hasDevices` | boolean | Devices data available |
| `dataQuality.hasAnalytics` | boolean | Analytics data available |
| `dataQuality.hasSignInActivity` | boolean | Sign-in data available |
| `dataQuality.lastEnrichedAt` | string | Last enrichment timestamp |

---

### Category 10: Ingestion Metadata (3 properties)

**Nested Object:** `ingestion`

| **Property Path** | **Type** | **Description** |
|-------------------|----------|-----------------|
| `ingestion.timestamp` | string | Ingestion timestamp |
| `ingestion.source` | string | Data source |
| `ingestion.version` | string | Schema version |

---

## Supporting Schema Files

### 1. License Schema
**File:** `legacy/api-ts/src/schemas/license.schema.ts`

**Purpose:** License SKU mappings and service plan definitions

**Key Data:**
- `LICENSE_SKU_MAP` - Mapping of SKU IDs to display names
- Microsoft 365 SKUs (E3, E5, F1, F3, Business Basic/Standard/Premium)
- Enterprise Mobility + Security (EMS E3, EMS E5, Intune standalone)
- Azure AD Premium (P1, P2)
- Office 365 SKUs (E1, E3, E5, Apps for Enterprise)

---

### 2. Configuration Schema
**File:** `legacy/api-ts/src/schemas/configuration.schema.ts`

**Purpose:** Device configuration policies

**Key Interfaces:**
- `DeviceConfigurationReference` - References to configuration policies applied to devices

**Properties:**
- Configuration policy ID, name, platform type, state, version
- Settings applied (key-value pairs)
- Last reported timestamp

---

### 3. Conditional Access Schema
**File:** `legacy/api-ts/src/schemas/conditional-access.schema.ts`

**Purpose:** Conditional Access policies and named locations

**Key Interfaces:**
- Conditional Access policies applied to users/devices
- Named locations (IP ranges, countries, trusted locations)
- Policy states and enforcement modes

**Properties:**
- Policy ID, name, state, conditions, controls
- Location ID, name, trusted flag, IP ranges
- Grant controls, session controls

---

### 4. Analytics Schema
**File:** `legacy/api-ts/src/schemas/analytics.schema.ts`

**Purpose:** Endpoint analytics scores and metrics

**Key Data:**
- Startup performance scores
- App reliability scores
- Battery health scores
- Work from anywhere scores
- User experience scores

---

### 5. Log Schema
**File:** `legacy/api-ts/src/schemas/log.schema.ts`

**Purpose:** Activity logs, audit logs, sign-in logs

**Key Data:**
- Log entry ID, timestamp, action, user, IP address
- Resource accessed, result (success/failure)
- Additional details (JSONB)

---

### 6. Integration Schema
**File:** `legacy/api-ts/src/schemas/integration.schema.ts`

**Purpose:** Third-party integrations (Azure AD app registrations, Graph API credentials)

**Key Data:**
- App registration details (client ID, tenant ID, secrets)
- OAuth tokens, refresh tokens, expiration
- Integration status, last sync timestamp

---

### 7. Metadata Schema
**File:** `legacy/api-ts/src/schemas/metadata.schema.ts`

**Purpose:** System metadata (schema version, ingestion timestamps, data quality)

**Key Data:**
- Schema version, last updated timestamp
- Data completeness flags
- Enrichment status

---

### 8. Onboarding Status Schema
**File:** `legacy/api-ts/src/schemas/onboarding-status.schema.ts`

**Purpose:** Tenant onboarding status tracking

**Key Data:**
- Onboarding step completed flags
- Azure AD app registration status
- Initial sync status
- Configuration completion

---

### 9. Platform User Schema
**File:** `legacy/api-ts/src/schemas/platform-user.schema.ts`

**Purpose:** FleetWatch platform users (admin accounts)

**Key Data:**
- Platform user ID, email, role
- Permissions, access level
- Last login, account status

---

## Property Count Summary

### Device Schema: ~230 properties

| **Category** | **Property Count** |
|--------------|-------------------|
| Core Identity | 10 |
| Management & Enrollment | 5 |
| Top-level Convenience Fields | 10 |
| Hardware Information | 30 |
| Network Details | 7 |
| Conditional Access | 15 |
| Autopilot & Provisioning | 4 |
| Exchange ActiveSync | 6 |
| Management Details | 9 |
| Configuration Manager | 3 |
| Security & Threat | 1 |
| Lost Mode (iOS) | 4 |
| Device Notes | 1 |
| Role Scope Tags | 1 |
| Malware Detection | 2 |
| User Association | 5 |
| Compliance | 25 |
| Configuration Status | 20 |
| Security & Protection | 30 |
| Device Actions History | 10 |
| Organization & Groups | 10 |
| Endpoint Analytics | 40 |
| Crashes | 10 |
| Warranty | 6 |
| Trends (Time-series) | 10 |
| Data Quality Metadata | 8 |
| Ingestion Metadata | 3 |
| **TOTAL** | **~230** |

---

### User Schema: ~100 properties

| **Category** | **Property Count** |
|--------------|-------------------|
| Core Identity | 6 |
| Employment Info | 8 |
| Contact Info | 4 |
| Account Status | 6 |
| Licenses | 20 |
| Device Association | 20 |
| Aggregated Device Analytics | 20 |
| Sign-in Activity | 10 |
| Data Quality Metadata | 5 |
| Ingestion Metadata | 3 |
| **TOTAL** | **~100** |

---

### Grand Total: ~330 unique properties across all schemas

---

## Key Insights

### 1. **Denormalization Strategy**

**Top-Level Convenience Fields:**
- Legacy schema promotes frequently queried fields to top level
- Example: `isCompliant` at top level + `compliance.state` in nested object
- Benefit: Fast queries without nested object access
- Trade-off: Data duplication, must keep in sync

**New Schema Approach:**
- Current FleetWatch schema does NOT heavily denormalize
- Most fields are flat columns OR stored once in JSONB
- Benefit: No duplication, simpler to maintain
- Trade-off: JSONB queries are slower without GIN indexes

---

### 2. **OpenSearch vs PostgreSQL**

| **Aspect** | **Legacy (OpenSearch)** | **New (PostgreSQL)** |
|------------|-------------------------|----------------------|
| **Document Model** | Single unified documents | Relational with JSONB columns |
| **Nested Objects** | Native nested object support | JSONB with JSON path queries |
| **Denormalization** | Heavy denormalization | Minimal denormalization |
| **Querying** | Full-text search, aggregations | SQL + JSONB operators |
| **Indexes** | Automatic indexing | Manual GIN indexes needed |
| **Schema Evolution** | Dynamic schema | Rigid schema (migrations required) |
| **Performance** | Fast aggregations, slower writes | Fast writes, slower JSONB queries |

---

### 3. **Data Richness**

**Legacy Schema Has:**
- ✅ Endpoint analytics (startup, reliability, battery)
- ✅ Crash tracking with detailed event history
- ✅ Warranty tracking
- ✅ Time-series trend data
- ✅ Conditional Access policies and locations
- ✅ Device actions history
- ✅ Lost Mode (iOS)
- ✅ Autopilot provisioning details
- ✅ Exchange ActiveSync details
- ✅ Configuration Manager integration
- ✅ Security baselines
- ✅ Malware detection
- ✅ Device Guard/Credential Guard state
- ✅ User sign-in activity
- ✅ License details with service plans
- ✅ User analytics (aggregated across all devices)

**New Schema Missing:**
- ❌ Most of the above (stored in JSONB but not extracted)
- ❌ Endpoint analytics
- ❌ Crash tracking
- ❌ Warranty tracking
- ❌ Time-series trends
- ❌ Conditional Access
- ❌ Device actions history
- ❌ Lost Mode
- ❌ Autopilot details
- ❌ Exchange ActiveSync
- ❌ Configuration Manager
- ❌ Security baselines
- ❌ Malware detection
- ❌ Device Guard state
- ❌ User sign-in activity
- ❌ License service plans
- ❌ User analytics aggregates

---

### 4. **Critical Properties Not in New Schema**

**High Priority (P0):**
1. `complianceGracePeriodExpiration` - Need to know when grace period ends
2. `partnerReportedThreatState` - Third-party threat detection
3. `notes` - Admin notes/comments field
4. `imei` - Mobile device identifier
5. `phoneNumber` - Mobile phone number
6. `givenName` / `surname` - User first/last names
7. `mobilePhone` - User mobile phone
8. `officeLocation` - User office location

**Medium Priority (P1):**
1. Endpoint analytics scores (overall, startup, reliability, battery)
2. Crash tracking (total crashes, last crash, top app)
3. Warranty information (start date, end date, in warranty)
4. Device actions history (last action, action states)
5. Lost Mode (iOS - state, message, phone number)
6. Autopilot details (enrolled, profile name, group tag)
7. Exchange ActiveSync details (activation, access state)
8. Security baselines (applied baselines, versions)
9. Malware detection (active count, remediated count)
10. User sign-in activity (last sign-in, recent applications)
11. License service plans (provisioning status per service)

**Low Priority (P2):**
1. Configuration Manager integration (client health, features)
2. Device Guard/Credential Guard state (VBS, CG)
3. Time-series trend data (scores over time, crashes over time)
4. Conditional Access named locations
5. Role scope tags
6. User analytics aggregates (average boot time across all devices)

---

### 5. **Storage Efficiency**

**Legacy OpenSearch:**
- ~230 device properties → Estimated ~50-80 KB per device document (with all nested objects)
- ~100 user properties → Estimated ~20-30 KB per user document
- Total for 1,000 devices + 500 users → ~65-95 MB

**New PostgreSQL:**
- 51 flat device columns + 17 JSONB columns → Estimated ~30 KB per device (current)
- 14 flat user columns → Estimated ~2 KB per user (current)
- Total for 1,000 devices + 500 users → ~31 MB
- **Storage savings: ~50-70% due to JSONB compression and less denormalization**

---

### 6. **Query Performance Implications**

**Legacy OpenSearch Advantages:**
- Fast full-text search across all fields
- Fast aggregations (count by manufacturer, OS, compliance state)
- Fast filtering on any nested field (no schema changes needed)
- Denormalized top-level fields for instant access

**New PostgreSQL Advantages:**
- Fast relational joins (devices to users, devices to compliance history)
- ACID transactions (consistent writes)
- Mature ecosystem (tools, monitoring, backups)
- Cheaper at scale (no OpenSearch licensing/hosting costs)

**New PostgreSQL Disadvantages (Current State):**
- JSONB queries are slow without GIN indexes (**CRITICAL GAP**)
- Can't easily aggregate on JSONB fields (need to extract first)
- No full-text search on JSONB (need to extract to flat columns or use tsvector)

---

## Recommendations

### Phase 2: Schema Updates (Add Missing Flat Columns)

**Add to Devices Table:**
1. `complianceGracePeriodExpiration` (timestamp) - P0
2. `partnerReportedThreatState` (text) - P0
3. `notes` (text) - P0
4. `imei` (text) - P0
5. `phoneNumber` (text) - P0
6. `subscriberCarrier` (text) - P1
7. `meid` (text) - P2
8. `iccid` (text) - P2
9. `udid` (text) - P2

**Add to Users Table:**
1. `givenName` (text) - P0
2. `surname` (text) - P0
3. `mobilePhone` (text) - P0
4. `officeLocation` (text) - P0
5. `manager` (text) - P1
6. `employeeId` (text) - P1
7. `employeeType` (text) - P2
8. `hireDate` (date) - P2
9. `leaveDate` (date) - P2
10. `lastSignInDateTime` (timestamp) - P1

### Phase 3: JSONB Optimization

**Add GIN Indexes:**
```sql
CREATE INDEX idx_security_details ON devices USING GIN (securityDetails);
CREATE INDEX idx_installed_apps ON devices USING GIN (installedApps);
CREATE INDEX idx_detected_apps ON devices USING GIN (detectedApps);
CREATE INDEX idx_hardware_details ON devices USING GIN (hardwareDetails);
CREATE INDEX idx_network_details ON devices USING GIN (networkDetails);
CREATE INDEX idx_compliance_details ON devices USING GIN (complianceDetails);
CREATE INDEX idx_configuration_details ON devices USING GIN (configurationDetails);
```

**Extract Frequently Queried JSONB Fields:**
- Extract `analytics.scores.overall` to flat column `analyticsOverallScore` (numeric)
- Extract `crashes.summary.total` to flat column `totalCrashes` (integer)
- Extract `warranty.inWarranty` to flat column `inWarranty` (boolean)
- Extract `security.protection.defenderStatus` to flat column `defenderStatus` (text)

### Phase 4: New Tables for Complex Data

**Consider Creating:**
1. `device_analytics` table (1:1 with devices)
   - Columns: device_id, overall_score, startup_score, reliability_score, battery_score, etc.
   - Benefit: Dedicated table for analytics makes queries faster

2. `device_crashes` table (1:many with devices)
   - Columns: id, device_id, timestamp, app_name, process_name, version, error_code
   - Benefit: Queryable crash history without JSONB parsing

3. `device_warranty` table (1:1 with devices)
   - Columns: device_id, status, start_date, end_date, vendor, in_warranty
   - Benefit: Fast warranty expiration queries

4. `device_actions` table (1:many with devices)
   - Columns: id, device_id, action_name, action_state, start_time, end_time, user_id
   - Benefit: Actionable history without JSONB

5. `user_licenses` table (1:many with users)
   - Columns: id, user_id, sku_id, sku_part_number, assigned_date
   - Benefit: License tracking and reporting

6. `user_sign_ins` table (1:many with users)
   - Columns: id, user_id, sign_in_time, app_name, ip_address, location, result
   - Benefit: User activity monitoring

---

## Conclusion

**Legacy Schema Strengths:**
- ✅ Rich data model with ~330 properties
- ✅ Denormalized for query performance
- ✅ Endpoint analytics, crash tracking, warranty tracking
- ✅ Full-text search and aggregations

**New Schema Strengths:**
- ✅ Simpler, relational model
- ✅ ACID transactions
- ✅ Lower storage costs
- ✅ Mature PostgreSQL ecosystem

**Migration Strategy:**
1. **Phase 1 (Current):** Document gaps, prioritize properties
2. **Phase 2:** Add P0 flat columns to existing tables
3. **Phase 3:** Optimize JSONB with GIN indexes
4. **Phase 4:** Extract frequently queried JSONB fields to flat columns
5. **Phase 5:** Create new tables for complex data (analytics, crashes, warranty, etc.)
6. **Phase 6:** Build API endpoints to expose new data
7. **Phase 7:** Update UI to display new data

**Expected Outcome:**
- Migrate 80-100 high-value properties (~30% of legacy schema)
- Improve query performance with GIN indexes
- Maintain storage efficiency (~30 KB per device)
- Keep JSONB for rarely queried data (auditability)

---

**Document Version:** 1.0  
**Last Updated:** February 10, 2026  
**Next Steps:** Phase 1.5 - Property-by-Property Comparison
