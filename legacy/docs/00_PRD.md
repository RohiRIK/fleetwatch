# 00. Product Requirements Document (PRD): Device Inventory System

## 1. Executive Summary
The **Device Inventory System** is a distributed, containerized platform designed to provide a unified, "Single Pane of Glass" view of an organization's hardware assets and user identities. It bridges the gap between raw telemetry data (from Microsoft Intune/Entra ID) and actionable compliance analytics.

In complex enterprise environments, device data is often siloed across multiple systems: Intune for device management, functions for compliance calculation, and Azure AD for user identity. This system solves the data fragmentation problem by aggregating these disparate sources into a high-performance search engine, allowing for instant querying, historical tracking, and automated compliance reporting.

## 2. Purpose & Strategic Vision

### 2.1 Problem Statement
*   **Visibility Gaps:** Administrators cannot easily query complex questions like "Which users in the Application Development department have laptops with >80% battery wear and non-compliant BitLocker states?"
*   **Latency:** Native Microsoft reporting can be delayed by 24-48 hours. Real-time compliance decisions require fresher data.
*   **Manual Overhead:** IT teams depend on manual CSV exports and Excel manipulation to generate fleet health reports.
*   **Provisioning Complexity:** Setting up the necessary Azure App Registrations and Certificates for a custom tool is error-prone and requires high technical expertise.

### 2.2 The Solution
The Device Inventory System provides:
1.  **Near Real-Time Inventory:** A dedicated sync engine that pulls delta changes every 30 minutes.
2.  **Unified Data Model:** A single JSON document that contains *everything* about a device (Hardware + User + Compliance + Security).
3.  **Zero-Touch Provisioning:** An automated "Wizard" that handles the entire Azure infrastructure setup (App Registration, Service Principals, Certificate Generation) programmatically.
4.  **High-Performance Search:** Sub-second query response times for datasets of up to 100,000 devices using OpenSearch.

## 3. Technology Stack & Design Choices

The architecture was chosen to prioritize TypeScript consistency, type safety, and runtime performance.

### 3.1 Core Technologies
| Component | Choice | Justification |
| :--- | :--- | :--- |
| **Runtime** | **Bun** | Chosen for its fast startup times and built-in TypeScript support, eliminating the need for complex build steps in the API and Fetcher. |
| **Backend Framework** | **Express.js** | Used for its mature ecosystem, robust middleware support, and ease of routing definition. |
| **Frontend Framework** | **Next.js** | Provides a modern React-based UI with server-side rendering capabilities for the dashboard. |
| **Data Store** | **OpenSearch** | A distributed search and analytics engine. Selected over SQL for its ability to handle complex, nested JSON schemas and provide powerful full-text search capabilities. |
| **State Management** | **Redis** | A high-performance in-memory store used for user sessions, distributed signals (cache invalidation), and ephemeral secret storage. |
| **Ingress** | **Caddy** | A modern web server that handles automatic TLS termination and acts as a reverse proxy, simplifying the network topology. |

### 3.2 External Integrations
*   **Microsoft Graph API:** The primary source of truth. The system uses both `v1.0` and `beta` endpoints to access:
    *   `DeviceManagement/ManagedDevices` (Intune)
    *   `Users` (Entra ID)
    *   `SubscribedSkus` (Licensing)
*   **Azure Active Directory:** Used for OpenID Connect (OIDC) authentication, allowing administrators to sign in with their corporate credentials.

## 4. System Architecture

The system follows a microservices pattern orchestrated via Docker Compose, ensuring isolation and scalability.

### 4.1 Container Topology
1.  **Fetcher Service (`fetcher`):**
    *   **Role:** Background Worker.
    *   **Behavior:** Runs on a scheduled cron job (`*/30 * * * *`). It performs "Delta Queries" to fetch only changed data from Microsoft Graph, minimizing API quota usage.
    *   **Communication:** Pushes raw JSON payloads to the API service.
2.  **Backend API (`api-ts`):**
    *   **Role:** The "Brain" of the system.
    *   **Behavior:** Receives raw data, applies `DeviceNormalizer` logic to standardizes the schema, and writes to OpenSearch. It also serves the REST API consumed by the frontend.
    *   **Special Function:** Hosts the `AutoProvisioningService` which manages the Azure setup wizard.
3.  **Frontend (`frontend-next`):**
    *   **Role:** User Interface.
    *   **Behavior:** A Next.js application that consumes the Backend API to visualize data in tables, charts, and detailed device views.
4.  **OpenSearch (`opensearch`):**
    *   **Role:** Persistence Layer.
    *   **Behavior:** Stores the `devices_v2`, `users_v1`, and `logs` indices.
5.  **Redis (`redis`):**
    *   **Role:** The "Nervous System".
    *   **Behavior:** Stores session cookies, coordinates "reload" signals between API and Fetcher, and holds encrypted credentials.

### 4.2 Data Flow (The Ingestion Pipeline)
1.  **Trigger:** Supercronic (in Fetcher) triggers the sync script.
2.  **Extraction:** Fetcher requests `deltaToken` from Redis. Calls MS Graph `/deviceManagement/managedDevices/delta`.
3.  **Transmission:** Fetcher posts the array of raw devices to `http://api-ts:3001/api/v2/ingest/all`.
4.  **Processing:**
    *   API validates the generic Bearer token.
    *   `DeviceNormalizer` iterates through the payload.
    *   User UPNs are correlated with the `users_v1` index.
    *   Compliance policies are flattened into a boolean `isCompliant` state.
5.  **Persistence:** API performs a `bulk` upsert operation against OpenSearch.

## 5. Data & Schema Specifications

The system utilizes a denormalized schema optimized for read-heavy search operations.

### 5.1 Unified Device Object (`devices_v2`)
A single document represents the complete state of a device at a specific point in time.

*   **Identity:**
    *   `id`: The immutable Azure AD Device ID.
    *   `deviceName`: The hostname.
    *   `serialNumber`: Hardware serial for asset tracking.
    *   `userPrincipalName`: The primary user's email.
*   **Hardware Telemetry:**
    *   `totalStorageSpaceInBytes` / `freeStorageSpaceInBytes`
    *   `physicalMemoryInBytes`
    *   `batteryHealthPercentage` (if supported)
*   **Security Posture:**
    *   `isEncrypted`: BitLocker/FileVault status.
    *   `firewallStatus`: OS Firewall state.
    *   `complianceState`: Evaluated against Intune policies.
*   **Application Health:**
    *   `crashes`: An array of recent application crash events (BSOD, App Hangs).

### 5.2 User Object (`users_v1`)
*   **Identity:** `id`, `displayName`, `jobTitle`, `department`.
*   **Licensing:** `assignedLicenses` array mapping SKUs (e.g., "M365 E5") to the user.
*   **Assets:** `deviceIds` array listing all devices assigned to this user.

## 6. Security Architecture & "Zero-Touch" Provisioning

A comprehensive security model ensures data protection and ease of deployment.

### 6.1 Authentication
*   **User Context:** Implements OAuth2/OIDC via Azure AD. Users are redirected to Microsoft for login. Validated sessions are stored in Redis with an HTTP-Only cookie (`device_inventory_session`).
*   **Service Context:** Machine-to-machine communication (Fetcher -> API) is secured via a long-lived Bearer token generated during the provisioning phase.

### 6.2 The "Zero-Touch" Wizard
The `AutoProvisioningService` allows a non-expert admin to set up the environment in minutes.

1.  **Initiation:** Admin logs in and grants `Directory.AccessAsUser.All`.
2.  **App Creation:** The API programmatically creates an Azure App Registration for the Fetcher.
3.  **Certificate Provisioning:**
    *   The API generates a 2048-bit RSA Key Pair (Private/Public) using `node-forge`.
    *   The Public Key (PFX) is uploaded to the Azure App via Graph API.
4.  **Secret Management:**
    *   The Private Key and Client Secret are **encrypted** using a master `CONFIG_ENCRYPTION_KEY`.
    *   Encrypted blobs are stored in Redis, accessible only to the Fetcher service.
    *   The Fetcher decrypts these in-memory at runtime to authenticate.

## 7. Operational Requirements

### 7.1 Infrastructure Prerequisites
*   **Docker Engine:** Version 20.10+
*   **Docker Compose:** Version 2.0+
*   **RAM:** Minimum 8GB (Due to OpenSearch JVM requirements).
*   **Disk:** SSD recommended for OpenSearch IOPS.

### 7.2 Configuration Variables
The system is configured via a consolidated `.env` file containing:
*   **Service Ports:** `PORT`, `REDIS_PORT`, `OPENSEARCH_PORT`.
*   **Graph Credentials:** `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` (Initial setup).
*   **Encryption:** `CONFIG_ENCRYPTION_KEY` (32-byte generic key).
*   **Public URL:** `BASE_URL` (For OIDC redirects).

## 8. Current Technical Status & Constraints

### 8.1 Active Components
*   **Backend API (`legacy/api-ts`):** Fully functional. Contains the core logic for normalization, ingestion, and provisioning. This is the "Survivor" of the codebase.
*   **Infrastructure Definitions:** `docker-compose.yml` and `Caddyfile` are complete and valid.

### 8.2 Missing "Ghost" Components
Please note for any future development:
*   **Fetcher Source:** The `legacy/fetcher/src` directory is missing. While the *Docker* context exists, the actual TypeScript logic for the sync engine is absent.
*   **Frontend Source:** The `legacy/frontend-next` directory contains only build artifacts (`.next`). The React source code is missing.

### 8.3 Recommended Roadmap
Due to the missing source code, the recommended path forward is a strategic "Rewrite & Rescue":
1.  **Rescue:** Extract the `DeviceNormalizer` and `AutoProvisioningService` logic from the API.
2.  **Rewrite:** Re-implement the Fetcher using a simpler cron/serverless model.
3.  **Rebuild:** Create a new Frontend using the Next.js App Router, consuming the extracted logic.

## 9. Conclusion
The Device Inventory System represents a sophisticated attempt to solve the enterprise device visibility problem. Its architecture demonstrates advanced concepts in data normalization and automated cloud provisioning. While the current repository state requires remediation for the frontend and sync worker, the core backend logic provides a solid foundation for a next-generation rebuild.
