# Document 04: Data Schema Analysis

## 1. Data Store
The system uses OpenSearch as its primary document store. Data is organized into indices corresponding to the core entities.

## 2. Core Entities

### Device Entity (`devices_v2`)
The `devices_v2` index stores a unified representation of managed devices. It aggregates data from multiple source points (Intune, Entra ID, Hardware).

**Key Fields:**
*   **Identity:** `id`, `serialNumber`, `deviceName`, `userPrincipalName`.
*   **Hardware:** `totalStorageSpaceInBytes`, `physicalMemoryInBytes`, `batteryHealthPercentage`.
*   **Compliance:** 
    *   `isCompliant` (Boolean).
    *   `compliance` (Object): Contains calculated compliance state and policy references.
*   **Security:** `isEncrypted`, `isSupervised`, `firewallStatus`.
*   **Management:** `managementAgent`, `enrollmentType`, `lastSyncDateTime`.
*   **Telemetry:** `crashes` (Array of reliability events), `analytics` (Boot performance metrics).

### User Entity (`users_v1`)
The `users_v1` index correlates user identities with their assigned assets.

**Key Fields:**
*   **Identity:** `id`, `userPrincipalName`, `displayName`, `department`.
*   **Licensing:** `assignedLicenses` (Array of SKU definitions).
*   **Correlations:** `deviceIds` (Array of associated device IDs).

## 3. Schema implementation
*   **Definition Source:** TypeScript interfaces in `legacy/api-ts/src/schemas/`.
*   **Normalization Logic:** `legacy/api-ts/src/normalizers/` transforms external API responses into this schema before ingestion.
*   **Nested Structures:** Usage of OpenSearch `nested` types for arrays like `compliance.policies` and `crashes` to enable property-specific querying.
