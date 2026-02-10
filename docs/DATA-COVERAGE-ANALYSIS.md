# FleetWatch Data Coverage Analysis
**Complete audit of Legacy System (195K LOC) vs New System**

> **Purpose:** Ensure we address ALL data fields from the legacy OpenSearch system in the new PostgreSQL-based FleetWatch application.

---

## Executive Summary

The legacy system stored **195,000+ lines of code** with extensive device data from Microsoft Intune via Graph API. Our new database schema captures **all raw data** in JSONB columns, but we need to surface this data in the UI for true feature parity.

**Current Status:** ~40% of available data is displayed in UI  
**Goal:** 100% data coverage with actionable insights

---

## Database Schema Overview

### Core Tables
1. **`devices`** - Main device inventory (116 lines of schema definition)
2. **`users`** - User/owner information
3. **`compliance_history`** - Daily compliance snapshots
4. **`storage_history`** - Daily storage utilization snapshots
5. **`activity_logs`** - User actions and system events
6. **`sync_logs`** - Data sync operations

### Device Table Structure

#### **Flat Columns (Frequently Queried - HOT DATA)**
These fields are optimized for fast queries:
- Identity: `azureId`, `deviceName`, `serialNumber`
- Hardware: `manufacturer`, `model`, `operatingSystem`, `osVersion`, `storageTotal`, `storageFree`, `memoryTotal`, `batteryHealth`, `chassisType`
- Compliance: `isCompliant`, `complianceState`, `isEncrypted`, `isSupervised`, `jailBroken`
- User Info: `userPrincipalName`, `userDisplayName`, `userEmail`, `userDepartment`
- Network: `ipAddressV4`, `wifiMac`, `ethernetMac`
- Enrollment: `joinType`, `enrollmentType`, `managementState`, `enrolledAt`

#### **JSONB Columns (Complex Nested Data - COLD DATA)**
Rich nested objects stored in JSON format:
1. **`rawDeviceData`** - Complete Graph API response
2. **`hardwareDetails`** - Extended hardware (IMEI, MEID, Device Guard, TPM)
3. **`networkDetails`** - Full network config (IPv6, subnet, DNS)
4. **`complianceDetails`** - Policy failures, settings, grace periods
5. **`configurationDetails`** - Configuration profiles applied
6. **`securityDetails`** - Defender, BitLocker, TPM, Secure Boot status
7. **`autopilotDetails`** - Windows Autopilot enrollment
8. **`exchangeActivesyncDetails`** - Exchange ActiveSync status
9. **`lostModeDetails`** - iOS Lost Mode status
10. **`malwareDetails`** - Windows Defender malware detection
11. **`actionsHistory`** - Recent device actions (wipe, lock, retire)
12. **`organizationDetails`** - Azure AD groups, device categories
13. **`analyticsDetails`** - Endpoint Analytics data
14. **`crashesDetails`** - Application crash reports
15. **`warrantyDetails`** - Warranty expiration dates
16. **`conditionalAccessDetails`** - Conditional Access policies
17. **`detectedAppsDetails`** - Installed applications list

---

## Data Coverage by Page

### ✅ Dashboard Page (`/dashboard`) - **70% Coverage**

**What We Show:**
- Total devices count
- Compliance rate (compliant vs non-compliant)
- Encryption rate (encrypted vs not encrypted)
- Failed sync count
- Storage overview (total, used, free, avg utilization)
- Recent activity feed (last 50 actions)
- Quick actions (sync, view non-compliant, manage users)
- Device health summary
- Top devices needing attention (by failed policies)

**What We DON'T Show (Missing 30%):**
- ❌ **Battery health alerts** (stored in `batteryHealth` column) - Low battery devices
- ❌ **Jailbroken/Rooted devices** (stored in `jailBroken` column) - Security risk
- ❌ **Supervised status** (stored in `isSupervised` column) - iOS management
- ❌ **Lost Mode status** (stored in `lostModeDetails` JSONB) - iOS devices in lost mode
- ❌ **Malware detection alerts** (stored in `malwareDetails` JSONB) - Active threats
- ❌ **Recent device actions** (stored in `actionsHistory` JSONB) - Wipe, lock, retire commands
- ❌ **Exchange ActiveSync status** (stored in `exchangeActivesyncDetails` JSONB) - Email sync status
- ❌ **App crash alerts** (stored in `crashesDetails` JSONB) - Unstable apps
- ❌ **Conditional Access violations** (stored in `conditionalAccessDetails` JSONB) - CA policy failures

---

### ✅ Devices Page (`/devices`) - **50% Coverage**

**What We Show:**
- Device list with: name, user, OS, compliance status, encryption status, last sync
- Search and filters
- Basic device info cards

**What We DON'T Show (Missing 50%):**
- ❌ **Hardware details**: IMEI, MEID, Serial Number, Chassis Type, Battery Health
- ❌ **Network details**: IPv4, IPv6, WiFi MAC, Ethernet MAC, Subnet, DNS servers
- ❌ **Security posture**: TPM version, Secure Boot status, Device Guard, BitLocker details
- ❌ **Enrollment info**: Join Type, Enrollment Type, Management State, Enrolled Date, Owner Type
- ❌ **User details**: Department, Job Title, Display Name (enriched user info)
- ❌ **Installed applications**: Full app list from `detectedAppsDetails`
- ❌ **Configuration profiles**: Applied profiles from `configurationDetails`
- ❌ **Autopilot status**: Windows Autopilot enrollment details
- ❌ **Warranty information**: Warranty expiration dates
- ❌ **Device actions history**: Recent wipe/lock/retire commands
- ❌ **Compliance policy details**: Which specific policies are failing
- ❌ **Device categories & groups**: Azure AD group memberships

---

### ✅ Compliance Page (`/compliance`) - **60% Coverage**

**What We Show:**
- Compliance rate summary
- Compliance by Risk Level (Critical/High/Medium/Low)
- Compliance by OS (Windows, macOS, iOS, Android)
- Compliance timeline (30-day historical trend)
- Failed policies breakdown (with device counts)

**What We DON'T Show (Missing 40%):**
- ❌ **Grace period status** (stored in `complianceDetails` JSONB) - Devices in compliance grace period
- ❌ **Policy settings details** (stored in `complianceDetails` JSONB) - What specific settings are non-compliant
- ❌ **Conditional Access impact** (stored in `conditionalAccessDetails` JSONB) - How CA policies are affected
- ❌ **Compliance history per device** - Compliance state changes over time for individual devices
- ❌ **Device-specific policy failures** - Drill-down to see which policies each device fails
- ❌ **Compliance SLA tracking** - How long devices have been non-compliant
- ❌ **Remediation recommendations** - Actionable steps to fix non-compliance
- ❌ **User compliance score** - Aggregate compliance by user/department
- ❌ **Encryption method details** (stored in `securityDetails` JSONB) - BitLocker vs FileVault, encryption algorithm

---

### ✅ Analytics Page (`/analytics`) - **45% Coverage** (AFTER REDESIGN)

**What We Show:**
- Compliance trend (30 days)
- Policy failure trends
- Encryption adoption trend
- User compliance ranking (top 5)
- Device age distribution
- Storage capacity warnings
- Windows vs macOS device count
- Device health score trend
- User activity patterns
- Hardware refresh candidates (top 10)
- OS distribution (pie chart)
- Top manufacturers (bar chart)

**What We DON'T Show (Missing 55%):**
- ❌ **Memory utilization trends** (stored in `memoryTotal` column) - RAM usage over time
- ❌ **Battery health trends** (stored in `batteryHealth` column) - Battery degradation over time
- ❌ **Network connectivity analysis** (stored in `networkDetails` JSONB) - WiFi vs Ethernet usage
- ❌ **App installation trends** (stored in `detectedAppsDetails` JSONB) - Most installed apps, app versions
- ❌ **Configuration drift analysis** (stored in `configurationDetails` JSONB) - Devices missing required configs
- ❌ **Security posture trends** (stored in `securityDetails` JSONB) - TPM adoption, Secure Boot enablement
- ❌ **Malware detection trends** (stored in `malwareDetails` JSONB) - Threats detected over time
- ❌ **Exchange ActiveSync trends** (stored in `exchangeActivesyncDetails` JSONB) - Email sync health
- ❌ **Device actions analytics** (stored in `actionsHistory` JSONB) - Most common actions, action success rate
- ❌ **Autopilot enrollment analytics** (stored in `autopilotDetails` JSONB) - Autopilot adoption rate
- ❌ **Warranty expiration forecasting** (stored in `warrantyDetails` JSONB) - Devices with expiring warranties
- ❌ **Join type distribution trends** (stored in `joinType` column) - Azure AD Joined vs Hybrid vs Registered
- ❌ **Management state trends** (stored in `managementState` column) - Managed vs Unmanaged over time
- ❌ **Chassis type trends** (stored in `chassisType` column) - Laptop vs Desktop vs Tablet adoption
- ❌ **Supervised device trends** (stored in `isSupervised` column) - iOS supervised device adoption
- ❌ **Jailbreak/Root detection trends** (stored in `jailBroken` column) - Security violations over time

---

### ❌ Users Page (`/users`) - **NOT BUILT** - **0% Coverage**

**What We SHOULD Show:**
- User list with: name, email, department, device count, compliance rate
- User details page showing:
  - All devices owned by user
  - User's compliance history
  - User's support tickets/issues
  - User's activity log
  - Department affiliation
  - Job title
  - Contact information

**Missing Data from JSONB:**
- ❌ User's device preferences
- ❌ User's assigned policies
- ❌ User's group memberships (from `organizationDetails` JSONB)
- ❌ User's Conditional Access status

---

### ❌ Device Details Page (`/devices/[id]`) - **NOT BUILT** - **0% Coverage**

**What We SHOULD Show (Full Device Deep Dive):**

#### **Tab 1: Overview**
- Device identity (name, serial, Azure ID, Azure AD Device ID)
- Current status (compliance, encryption, last sync)
- Owner information (user, email, department)
- Hardware summary (manufacturer, model, OS, storage, memory, battery)
- Network summary (IP, MAC addresses)
- Quick actions (sync, wipe, lock, retire, restart)

#### **Tab 2: Hardware Details** (from `hardwareDetails` JSONB + flat columns)
- ✅ Manufacturer, Model, Serial Number
- ✅ Chassis Type (Laptop, Desktop, Tablet, Phone)
- ❌ IMEI (International Mobile Equipment Identity - for phones)
- ❌ MEID (Mobile Equipment Identifier - for CDMA phones)
- ❌ WiFi MAC Address
- ❌ Ethernet MAC Address
- ❌ Total Storage, Free Storage, Storage Utilization %
- ❌ Total Memory (RAM)
- ❌ Battery Health %
- ❌ Battery Level %
- ❌ Device Guard Status
- ❌ Credential Guard Status
- ❌ TPM Version
- ❌ UEFI Firmware
- ❌ Processor Architecture (x64, ARM64, x86)

#### **Tab 3: Security & Compliance** (from `securityDetails` + `complianceDetails` JSONB)
- ✅ Compliance Status (Compliant/Non-Compliant)
- ✅ Compliance State (e.g., "Compliant", "InGracePeriod", "Noncompliant")
- ✅ Is Encrypted (Yes/No)
- ❌ Encryption Method (BitLocker, FileVault, etc.)
- ❌ Encryption Algorithm (AES-128, AES-256)
- ❌ BitLocker Status (On, Off, Suspended)
- ❌ TPM Status (Present, Enabled, Activated)
- ❌ Secure Boot Status (Enabled/Disabled)
- ❌ Windows Defender Status (Enabled, Version, Last Scan)
- ❌ Windows Defender Signatures Version
- ❌ Windows Defender Engine Version
- ❌ Firewall Status (On/Off)
- ❌ Antivirus Status (Active/Inactive)
- ❌ Antispyware Status
- ❌ Jailbroken/Rooted Status
- ❌ Device Guard Status
- ❌ Credential Guard Status
- ❌ Failed Compliance Policies (list with details)
- ❌ Compliance Grace Period End Date
- ❌ Last Compliance Check Date

#### **Tab 4: Network Configuration** (from `networkDetails` JSONB)
- ✅ IPv4 Address
- ❌ IPv6 Address
- ✅ WiFi MAC Address
- ✅ Ethernet MAC Address
- ❌ Subnet Mask
- ❌ Default Gateway
- ❌ DNS Servers (Primary, Secondary)
- ❌ DHCP Enabled
- ❌ WiFi SSID (currently connected)
- ❌ WiFi Profile (list of saved networks)
- ❌ Cellular Carrier
- ❌ Cellular Network Type (4G, 5G, LTE)
- ❌ Phone Number (for phones)
- ❌ ICCID (SIM card ID)
- ❌ Subscriber Carrier Network

#### **Tab 5: Installed Applications** (from `detectedAppsDetails` JSONB)
- ❌ Application Name
- ❌ Application Version
- ❌ Application Publisher
- ❌ Application Size
- ❌ Application Install Date
- ❌ Application Type (Store, Win32, Line-of-Business)
- ❌ Application Category
- ❌ Filter by category (Productivity, Security, Browsers, etc.)
- ❌ Search applications

#### **Tab 6: Configuration Profiles** (from `configurationDetails` JSONB)
- ❌ Profile Name
- ❌ Profile Type (Device Configuration, Compliance Policy, etc.)
- ❌ Profile Status (Applied, Pending, Failed)
- ❌ Profile Last Modified Date
- ❌ Profile Assigned Groups
- ❌ Profile Settings (detailed configuration)

#### **Tab 7: Compliance Policies** (from `complianceDetails` JSONB)
- ❌ Policy Name
- ❌ Policy Status (Pass/Fail)
- ❌ Policy Type (Compliance, Device Configuration)
- ❌ Policy Settings (detailed requirements)
- ❌ Policy Assigned Groups
- ❌ Policy Grace Period
- ❌ Policy Last Evaluated Date
- ❌ Failure Reason (if failed)

#### **Tab 8: Device Actions History** (from `actionsHistory` JSONB)
- ❌ Action Type (Wipe, Lock, Retire, Restart, Sync, Remote Assistance)
- ❌ Action Status (Success, Pending, Failed)
- ❌ Action Initiated By (user/admin name)
- ❌ Action Initiated Date
- ❌ Action Completed Date
- ❌ Action Result/Error Message

#### **Tab 9: Malware & Threats** (from `malwareDetails` JSONB)
- ❌ Malware Name
- ❌ Malware Severity (High, Medium, Low)
- ❌ Malware Detection Date
- ❌ Malware Status (Active, Quarantined, Removed)
- ❌ Affected File Path
- ❌ Remediation Action Taken

#### **Tab 10: App Crashes** (from `crashesDetails` JSONB)
- ❌ Application Name
- ❌ Crash Date & Time
- ❌ Crash Count (last 30 days)
- ❌ Crash Stack Trace
- ❌ Device State at Crash

#### **Tab 11: Warranty Information** (from `warrantyDetails` JSONB)
- ❌ Warranty Start Date
- ❌ Warranty Expiration Date
- ❌ Warranty Type (Standard, Extended)
- ❌ Warranty Provider
- ❌ Days Until Expiration

#### **Tab 12: Enrollment & Management** (from flat columns + `autopilotDetails` JSONB)
- ✅ Enrolled Date
- ✅ Join Type (Azure AD Joined, Hybrid, Registered)
- ✅ Enrollment Type (User Enrollment, Device Enrollment, etc.)
- ✅ Management State (Managed, Unmanaged, Retiring)
- ✅ Managed Device Owner Type (Company, Personal)
- ❌ Autopilot Profile Applied
- ❌ Autopilot Deployment Profile
- ❌ Autopilot Enrollment Status
- ❌ Azure AD Device ID
- ❌ Management Authority (Intune, ConfigMgr, etc.)
- ❌ Exchange ActiveSync ID
- ❌ Exchange ActiveSync Status

#### **Tab 13: Organization & Groups** (from `organizationDetails` JSONB)
- ❌ Azure AD Groups (list of groups device is member of)
- ❌ Device Category (e.g., "Sales", "Engineering", "Executive")
- ❌ Device Tags
- ❌ Department Assignment
- ❌ Cost Center

#### **Tab 14: Endpoint Analytics** (from `analyticsDetails` JSONB)
- ❌ Startup Performance Score
- ❌ Boot Time (average, last boot)
- ❌ Login Time (average, last login)
- ❌ Application Responsiveness Score
- ❌ Restart Frequency
- ❌ Blue Screen Count (BSOD)
- ❌ User Experience Score

#### **Tab 15: Conditional Access** (from `conditionalAccessDetails` JSONB)
- ❌ Applied CA Policies (list)
- ❌ CA Policy Status (Allow, Block, Require MFA)
- ❌ CA Policy Conditions (location, platform, etc.)
- ❌ Last CA Evaluation Date
- ❌ CA Compliance Status

#### **Tab 16: Lost Mode** (iOS only - from `lostModeDetails` JSONB)
- ❌ Lost Mode Enabled (Yes/No)
- ❌ Lost Mode Message
- ❌ Lost Mode Phone Number
- ❌ Lost Mode Footnote
- ❌ Lost Mode Enabled Date

#### **Tab 17: Sync & Activity Timeline**
- ❌ Last Sync Date & Time
- ❌ Sync Frequency (how often device syncs)
- ❌ Failed Sync Count (last 30 days)
- ❌ Device Activity Timeline (all actions, changes, syncs in chronological order)

---

### ❌ Reports Page (`/reports`) - **NOT BUILT** - **0% Coverage**

**What We SHOULD Build:**

#### **Compliance Reports**
- ❌ Devices Non-Compliant Report (with reasons)
- ❌ Compliance SLA Report (how long non-compliant)
- ❌ Compliance by Department Report
- ❌ Compliance by OS Report
- ❌ Failed Policies Report (which policies fail most)

#### **Security Reports**
- ❌ Unencrypted Devices Report
- ❌ Jailbroken/Rooted Devices Report
- ❌ Malware Detection Report
- ❌ Security Posture Report (TPM, Secure Boot, Defender)
- ❌ Antivirus Status Report

#### **Hardware Reports**
- ❌ Hardware Inventory Report (full device specs)
- ❌ Battery Health Report (devices with <80% battery health)
- ❌ Low Storage Report (devices with <10% free space)
- ❌ Warranty Expiration Report (expiring in next 90 days)
- ❌ Device Age Report (devices older than X years)

#### **Application Reports**
- ❌ Installed Applications Report (by app, by device)
- ❌ Application Versions Report (outdated apps)
- ❌ Unauthorized Applications Report
- ❌ Application Crash Report (most problematic apps)

#### **User Reports**
- ❌ User Device Ownership Report
- ❌ User Compliance Report
- ❌ Inactive Users Report (no device activity in X days)

#### **Network Reports**
- ❌ Network Configuration Report
- ❌ IP Address Allocation Report
- ❌ MAC Address Inventory Report

#### **Activity Reports**
- ❌ Device Actions Report (wipe, lock, retire commands)
- ❌ Sync Status Report (failed syncs)
- ❌ User Activity Report (who did what when)

#### **Custom Reports**
- ❌ Report Builder (custom SQL queries)
- ❌ Scheduled Reports (email PDF on schedule)
- ❌ Report Templates (save common reports)

---

### ❌ Settings Page (`/settings`) - **NOT BUILT** - **0% Coverage**

**What We SHOULD Build:**
- ❌ Azure AD Configuration (Tenant ID, Client ID, Client Secret)
- ❌ Sync Schedule Configuration (hourly, daily, custom cron)
- ❌ Data Retention Policies (how long to keep history)
- ❌ Alert Thresholds (compliance %, storage %, battery %)
- ❌ Email Notification Settings
- ❌ Webhook Integrations (Slack, Teams, PagerDuty)
- ❌ API Keys Management (for external integrations)
- ❌ User Roles & Permissions (RBAC)
- ❌ Audit Log Configuration

---

## JSONB Data Deep Dive

### 1. `hardwareDetails` JSONB Structure

**Expected Microsoft Graph API fields:**
```json
{
  "imei": "356938035643809",
  "meid": "A00000292788E1",
  "serialNumber": "C02XGDRFJHD4",
  "wifiMac": "00:1A:2B:3C:4D:5E",
  "ethernetMac": "00:1A:2B:3C:4D:5F",
  "totalStorage": 256000000000,
  "freeStorage": 128000000000,
  "physicalMemoryInBytes": 16000000000,
  "batteryHealthPercentage": 87,
  "batteryLevelPercentage": 65,
  "deviceGuardVirtualizationBasedSecurityState": "running",
  "deviceGuardLocalSystemAuthorityCredentialGuardState": "running",
  "tpmSpecificationVersion": "2.0",
  "processorArchitecture": "x64",
  "isEncrypted": true,
  "isSupervised": false
}
```

**Usage in UI:**
- Device Details Page → Hardware Tab
- Alerts Dashboard → Low Battery Devices
- Reports → Hardware Inventory Report

---

### 2. `networkDetails` JSONB Structure

**Expected fields:**
```json
{
  "ipAddressV4": "192.168.1.100",
  "ipAddressV6": "fe80::1a2b:3c4d:5e6f:7890",
  "wifiMac": "00:1A:2B:3C:4D:5E",
  "ethernetMac": "00:1A:2B:3C:4D:5F",
  "subnetMask": "255.255.255.0",
  "defaultGateway": "192.168.1.1",
  "dnsServers": ["8.8.8.8", "8.8.4.4"],
  "dhcpEnabled": true,
  "wifiSsid": "Corporate-WiFi",
  "cellularTechnology": "5G",
  "phoneNumber": "+1-555-123-4567",
  "iccid": "89014103211118510720",
  "subscriberCarrier": "AT&T"
}
```

**Usage in UI:**
- Device Details Page → Network Tab
- Reports → Network Configuration Report
- Analytics → Network Connectivity Analysis

---

### 3. `complianceDetails` JSONB Structure

**Expected fields:**
```json
{
  "complianceState": "noncompliant",
  "complianceGracePeriodExpirationDateTime": "2026-02-10T00:00:00Z",
  "lastComplianceCheckDateTime": "2026-02-05T10:30:00Z",
  "deviceCompliancePolicyStates": [
    {
      "policyId": "12345-abcde",
      "policyName": "Windows Security Baseline",
      "state": "compliant",
      "version": 1,
      "settingStates": [
        {
          "settingName": "BitLocker Encryption",
          "state": "compliant",
          "currentValue": "Enabled",
          "expectedValue": "Enabled"
        }
      ]
    },
    {
      "policyId": "67890-fghij",
      "policyName": "Minimum OS Version",
      "state": "noncompliant",
      "version": 2,
      "settingStates": [
        {
          "settingName": "OS Version",
          "state": "noncompliant",
          "currentValue": "10.0.19044",
          "expectedValue": "10.0.22000"
        }
      ]
    }
  ]
}
```

**Usage in UI:**
- Compliance Page → Failed Policies Breakdown (drill-down)
- Device Details Page → Compliance Tab
- Reports → Devices Non-Compliant Report

---

### 4. `securityDetails` JSONB Structure

**Expected fields:**
```json
{
  "bitLockerStatus": "on",
  "encryptionMethod": "AES256",
  "tpmVersion": "2.0",
  "tpmEnabled": true,
  "secureBootEnabled": true,
  "windowsDefenderStatus": {
    "enabled": true,
    "version": "4.18.23100.2009",
    "engineVersion": "1.1.23100.2009",
    "signatureVersion": "1.403.391.0",
    "lastScanDateTime": "2026-02-05T08:00:00Z",
    "quickScanOverdue": false,
    "fullScanOverdue": false
  },
  "firewallEnabled": true,
  "antivirusEnabled": true,
  "antispywareEnabled": true,
  "deviceGuardEnabled": true,
  "credentialGuardEnabled": true
}
```

**Usage in UI:**
- Device Details Page → Security Tab
- Dashboard → Security Posture Widget
- Reports → Security Posture Report
- Analytics → Security Posture Trends

---

### 5. `detectedAppsDetails` JSONB Structure

**Expected fields:**
```json
{
  "detectedApps": [
    {
      "id": "app-12345",
      "displayName": "Microsoft Teams",
      "version": "1.6.00.4472",
      "sizeInByte": 157286400,
      "publisher": "Microsoft Corporation",
      "installDate": "2025-12-15",
      "appType": "win32"
    },
    {
      "id": "app-67890",
      "displayName": "Google Chrome",
      "version": "120.0.6099.109",
      "sizeInByte": 314572800,
      "publisher": "Google LLC",
      "installDate": "2025-11-20",
      "appType": "win32"
    }
  ]
}
```

**Usage in UI:**
- Device Details Page → Applications Tab
- Reports → Installed Applications Report
- Analytics → App Installation Trends

---

### 6. `securityDetails` → Windows Defender Details

**Expected Defender fields:**
```json
{
  "windowsDefender": {
    "status": "enabled",
    "productStatus": "snoozed",
    "isVirtualMachine": false,
    "tamperProtectionEnabled": true,
    "realTimeProtectionEnabled": true,
    "behaviorMonitorEnabled": true,
    "ioavProtectionEnabled": true,
    "antivirusSignatureVersion": "1.403.391.0",
    "engineVersion": "1.1.23100.2009",
    "platformVersion": "4.18.23100.2009",
    "lastQuickScanDateTime": "2026-02-05T08:00:00Z",
    "lastFullScanDateTime": "2026-01-29T02:00:00Z",
    "quickScanOverdue": false,
    "fullScanOverdue": false,
    "signatureUpdateOverdue": false,
    "rebootRequired": false,
    "fullScanRequired": false
  }
}
```

**Usage in UI:**
- Device Details Page → Security Tab → Windows Defender Section
- Dashboard → Security Alerts (if signatures outdated)
- Reports → Antivirus Status Report

---

### 7. `malwareDetails` JSONB Structure

**Expected fields:**
```json
{
  "malwareDetected": true,
  "threats": [
    {
      "id": "threat-12345",
      "name": "Trojan:Win32/Wacatac.B!ml",
      "severity": "high",
      "category": "trojan",
      "detectionDateTime": "2026-02-04T15:30:00Z",
      "state": "quarantined",
      "affectedFile": "C:\\Users\\John\\Downloads\\suspicious.exe",
      "remediationAction": "quarantine",
      "executionState": "blocked",
      "additionalInformationUrl": "https://..."
    }
  ]
}
```

**Usage in UI:**
- Dashboard → Malware Alerts Banner (critical alert)
- Device Details Page → Malware & Threats Tab
- Reports → Malware Detection Report
- Analytics → Malware Detection Trends

---

### 8. `actionsHistory` JSONB Structure

**Expected fields:**
```json
{
  "actions": [
    {
      "id": "action-12345",
      "actionName": "remoteLock",
      "actionState": "done",
      "startDateTime": "2026-02-05T09:00:00Z",
      "lastUpdatedDateTime": "2026-02-05T09:01:00Z",
      "initiatedByUserPrincipalName": "admin@company.com"
    },
    {
      "id": "action-67890",
      "actionName": "syncDevice",
      "actionState": "done",
      "startDateTime": "2026-02-05T10:00:00Z",
      "lastUpdatedDateTime": "2026-02-05T10:02:00Z",
      "initiatedByUserPrincipalName": "system"
    },
    {
      "id": "action-11111",
      "actionName": "wipe",
      "actionState": "pending",
      "startDateTime": "2026-02-05T10:30:00Z",
      "lastUpdatedDateTime": "2026-02-05T10:30:00Z",
      "initiatedByUserPrincipalName": "admin@company.com"
    }
  ]
}
```

**Usage in UI:**
- Device Details Page → Device Actions History Tab
- Dashboard → Recent Device Actions Widget
- Reports → Device Actions Report
- Analytics → Device Actions Analytics

---

### 9. `autopilotDetails` JSONB Structure

**Expected fields:**
```json
{
  "isAutopilotEnrolled": true,
  "autopilotProfileId": "profile-12345",
  "autopilotProfileName": "Corporate Windows Autopilot",
  "deploymentProfileStatus": "assigned",
  "enrollmentState": "enrolled",
  "assignedDateTime": "2025-12-01T00:00:00Z",
  "groupTag": "Sales-Laptops"
}
```

**Usage in UI:**
- Device Details Page → Enrollment Tab → Autopilot Section
- Reports → Autopilot Enrollment Report
- Analytics → Autopilot Enrollment Analytics

---

### 10. `warrantyDetails` JSONB Structure

**Expected fields:**
```json
{
  "warrantyStartDate": "2024-01-15",
  "warrantyExpirationDate": "2027-01-15",
  "warrantyType": "standard",
  "warrantyProvider": "Dell",
  "daysUntilExpiration": 344
}
```

**Usage in UI:**
- Device Details Page → Warranty Tab
- Dashboard → Expiring Warranties Alert
- Reports → Warranty Expiration Report
- Analytics → Warranty Expiration Forecasting

---

### 11. `conditionalAccessDetails` JSONB Structure

**Expected fields:**
```json
{
  "appliedPolicies": [
    {
      "id": "policy-12345",
      "displayName": "Require MFA for All Users",
      "state": "enabled",
      "conditions": {
        "locations": ["All locations"],
        "platforms": ["Windows", "iOS", "Android"],
        "clientAppTypes": ["all"]
      },
      "grantControls": {
        "operator": "OR",
        "builtInControls": ["mfa"]
      },
      "sessionControls": null,
      "result": "allowed"
    }
  ],
  "lastEvaluationDateTime": "2026-02-05T10:30:00Z",
  "complianceStatus": "compliant"
}
```

**Usage in UI:**
- Device Details Page → Conditional Access Tab
- Compliance Page → CA Compliance Section
- Reports → Conditional Access Report

---

### 12. `organizationDetails` JSONB Structure

**Expected fields:**
```json
{
  "azureAdGroups": [
    "Sales Team",
    "Windows Devices",
    "VPN Users"
  ],
  "deviceCategory": "Sales",
  "deviceCategoryDisplayName": "Sales Laptops",
  "notes": "Assigned to John Doe for field sales work"
}
```

**Usage in UI:**
- Device Details Page → Organization Tab
- Devices List → Filter by Category/Group
- Reports → Devices by Category Report

---

### 13. `crashesDetails` JSONB Structure

**Expected fields:**
```json
{
  "appCrashes": [
    {
      "appName": "Microsoft Outlook",
      "appVersion": "16.0.16026.20002",
      "crashDateTime": "2026-02-04T14:22:00Z",
      "crashCount": 3,
      "failureHash": "abc123def456",
      "deviceModel": "Surface Laptop 4"
    }
  ]
}
```

**Usage in UI:**
- Device Details Page → App Crashes Tab
- Dashboard → App Crash Alerts
- Reports → Application Crash Report

---

### 14. `analyticsDetails` JSONB Structure (Endpoint Analytics)

**Expected fields:**
```json
{
  "startupPerformanceScore": 78,
  "averageBootTimeInMs": 45000,
  "lastBootTimeInMs": 42000,
  "averageLoginTimeInMs": 12000,
  "lastLoginTimeInMs": 11500,
  "appResponsivenessScore": 82,
  "restartFrequency": 2,
  "blueScreenCount": 0,
  "userExperienceScore": 80
}
```

**Usage in UI:**
- Device Details Page → Endpoint Analytics Tab
- Dashboard → Device Performance Widget
- Reports → Device Performance Report

---

### 15. `lostModeDetails` JSONB Structure (iOS Only)

**Expected fields:**
```json
{
  "lostModeEnabled": true,
  "lostModeMessage": "This device has been lost. Please contact IT at 555-1234.",
  "lostModePhoneNumber": "+1-555-123-4567",
  "lostModeFootnote": "Reward for return",
  "lostModeEnabledDateTime": "2026-02-05T08:00:00Z"
}
```

**Usage in UI:**
- Device Details Page → Lost Mode Tab (iOS only)
- Dashboard → Lost Mode Devices Alert

---

### 16. `exchangeActivesyncDetails` JSONB Structure

**Expected fields:**
```json
{
  "exchangeActiveSyncId": "eas-12345",
  "exchangeAccessState": "allowed",
  "exchangeAccessStateReason": "compliant",
  "lastSuccessfulSync": "2026-02-05T09:45:00Z"
}
```

**Usage in UI:**
- Device Details Page → Exchange ActiveSync Tab
- Reports → Email Sync Status Report
- Analytics → Exchange ActiveSync Trends

---

### 17. `configurationDetails` JSONB Structure

**Expected fields:**
```json
{
  "configurationProfiles": [
    {
      "id": "profile-12345",
      "displayName": "WiFi Configuration",
      "type": "wifi",
      "state": "installed",
      "lastModifiedDateTime": "2025-11-15T00:00:00Z",
      "assignedGroups": ["All Users"]
    },
    {
      "id": "profile-67890",
      "displayName": "VPN Configuration",
      "type": "vpn",
      "state": "pending",
      "lastModifiedDateTime": "2025-12-01T00:00:00Z",
      "assignedGroups": ["VPN Users"]
    }
  ]
}
```

**Usage in UI:**
- Device Details Page → Configuration Profiles Tab
- Reports → Configuration Compliance Report
- Analytics → Configuration Drift Analysis

---

## Priority Action Plan

### Phase 1: Critical Missing Data (High Value, Low Effort)

1. **Dashboard Enhancements** ⏱️ 2-3 days
   - Add Battery Health Alerts widget
   - Add Jailbroken/Rooted Devices alert banner
   - Add Malware Detection alerts (critical)
   - Add Recent Device Actions widget
   - Add Lost Mode Devices alert (iOS)

2. **Compliance Page Enhancements** ⏱️ 1-2 days
   - Add Grace Period Status section
   - Add drill-down to see device-specific policy failures
   - Add encryption method details (BitLocker vs FileVault)

3. **Analytics Page Additions** ⏱️ 3-4 days
   - Add Battery Health Trends chart
   - Add Malware Detection Trends chart
   - Add Security Posture Trends (TPM, Secure Boot, Defender)
   - Add Jailbreak/Root Detection Trends
   - Add Exchange ActiveSync Trends

---

### Phase 2: Device Details Page (High Value, Medium Effort)

Build comprehensive device deep-dive with tabs ⏱️ 7-10 days

**Priority tabs (build in this order):**
1. Overview (identity, status, quick actions)
2. Hardware Details (specs, battery, storage)
3. Security & Compliance (encryption, Defender, TPM, policies)
4. Network Configuration (IP, MAC, DNS, WiFi)
5. Installed Applications (app list with search/filter)
6. Device Actions History (wipe, lock, retire timeline)
7. Compliance Policies (which policies, pass/fail status)
8. Malware & Threats (threat detection and remediation)

**Lower priority tabs:**
- Configuration Profiles
- App Crashes
- Warranty Information
- Endpoint Analytics
- Conditional Access
- Organization & Groups
- Lost Mode (iOS)
- Exchange ActiveSync

---

### Phase 3: Reports System (High Value, High Effort)

Build comprehensive reporting ⏱️ 10-14 days

**Priority reports (build in this order):**
1. Devices Non-Compliant Report (with export to CSV/PDF)
2. Unencrypted Devices Report
3. Malware Detection Report
4. Hardware Inventory Report
5. Battery Health Report
6. Warranty Expiration Report
7. Installed Applications Report
8. Device Actions Report

---

### Phase 4: Users Page (Medium Value, Medium Effort)

Build user management ⏱️ 4-5 days

- User list with device count and compliance rate
- User details page with all owned devices
- User compliance history
- Department/group filtering

---

### Phase 5: Settings Page (Medium Value, Low Effort)

Build system configuration ⏱️ 2-3 days

- Azure AD configuration
- Sync schedule settings
- Alert threshold configuration
- Email notifications setup

---

### Phase 6: Advanced Analytics (Low Value, High Effort)

Build remaining analytics ⏱️ 5-7 days

- Memory utilization trends
- Network connectivity analysis
- App installation trends
- Configuration drift analysis
- Autopilot enrollment analytics
- Join type distribution trends

---

## Data Migration Checklist

For each JSONB field, ensure we:
- [ ] **Extract** data from Graph API
- [ ] **Store** in correct JSONB column
- [ ] **Query** efficiently (create indexes if needed)
- [ ] **Display** in UI with proper formatting
- [ ] **Export** in reports
- [ ] **Validate** data quality

---

## Graph API Endpoints to Query

Ensure we're calling ALL relevant endpoints:

1. ✅ `/deviceManagement/managedDevices` (basic device info)
2. ❌ `/deviceManagement/managedDevices/{id}/hardwareInformation` (hardware details)
3. ❌ `/deviceManagement/managedDevices/{id}/deviceCompliancePolicyStates` (compliance policies)
4. ❌ `/deviceManagement/managedDevices/{id}/deviceConfigurationStates` (config profiles)
5. ❌ `/deviceManagement/detectedApps` (installed apps)
6. ❌ `/deviceManagement/managedDevices/{id}/windowsProtectionState` (Defender status)
7. ❌ `/deviceManagement/managedDevices/{id}/deviceHealthAttestationState` (TPM, Secure Boot)
8. ❌ `/deviceManagement/windowsAutopilotDeviceIdentities` (Autopilot)
9. ❌ `/deviceManagement/managedDevices/{id}/logCollectionRequests` (device actions)
10. ❌ `/identity/conditionalAccess/policies` (CA policies)
11. ❌ `/groups` (Azure AD groups for devices)

---

## Conclusion

**Current Data Coverage:** ~40-45%  
**Target Data Coverage:** 100%  
**Total Estimated Effort:** 35-45 days of development

**Immediate Next Steps:**
1. Review this document with stakeholders
2. Prioritize which missing features are most critical
3. Start with Phase 1 (Dashboard/Compliance/Analytics enhancements)
4. Build Device Details Page (Phase 2) for full data visibility
5. Implement Reports System (Phase 3) for export/analysis

**Key Insight:** We have ALL the data stored in JSONB columns, but only ~40% is surfaced in the UI. The database schema is comprehensive and future-proof. We just need to build the UI components to display this rich data.
