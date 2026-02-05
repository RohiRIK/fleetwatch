# Device Inventory API (TypeScript/Bun)

The **Device Inventory API** is the central nervous system of the platform. Built on the ultra-fast **Bun** runtime, it orchestrates data flow, manages security, and serves the frontend dashboard.

---

## 🧠 Core Responsibilities

### 1. Data Ingestion & Normalization
The API receives raw data payloads from the Fetcher service and passes them through a rigorous normalization pipeline:
*   **Schema Validation:** Ensures incoming data matches the v2 OpenSearch schema.
*   **Data Enrichment:** Merges discrete data points (e.g., combining "Device" records with "Warranty" data and "User" mapping).
*   **Bulk Indexing:** efficiently writes data to OpenSearch using bulk APIs to maximize throughput.

### 2. Authentication & SSO
*   **Microsoft Entra ID (Azure AD):** Implements the OAuth 2.0 Authorization Code Flow for secure user login.
*   **Session Management:** Uses **Redis** to store encrypted session data, ensuring stateless and scalable API instances.
*   **Local Fallback:** Includes a secure local authentication system (bcrypt-hashed passwords) for admin recovery access.

### 3. Auto-Provisioning Service
A specialized module that automates the platform's setup:
*   **Azure Automation:** Uses the Microsoft Graph API to create and configure App Registrations and Service Principals programmatically.
*   **Certificate Authority:** Generates self-signed, 2048-bit RSA keys and packages them into **PKCS#12 (.pfx)** containers for secure Azure authentication.
*   **Environment Management:** Dynamically updates the running configuration and triggers service reloads via Redis pub/sub.

### 4. Query Engine
*   **Advanced Filtering:** Translates frontend filter parameters (e.g., `?status=noncompliant&manufacturer=Lenovo`) into complex OpenSearch DSL queries.
*   **Aggregations:** Calculates real-time metrics for dashboard widgets (e.g., "Compliance by OS Version").

---

## 🔌 Key Endpoints

### Devices
*   `GET /api/v2/devices`: List devices with pagination, sorting, and filtering.
*   `GET /api/v2/devices/{id}`: Get full details for a single device.
*   `GET /api/v2/devices/stats/compliance`: Get compliance aggregation metrics.

### Users
*   `GET /api/v2/users`: List users with correlated device counts.
*   `GET /api/v2/users/insights/ghosts`: List "Ghost Users" (inactive but licensed).

### Provisioning
*   `GET /api/v2/provisioning/status`: Check if the system is configured.
*   `POST /api/v2/provisioning/initiate`: Start the Azure Device Code flow.
*   `POST /api/v2/provisioning/execute`: Finalize setup and generate certificates.

---

## 🛠️ Local Development

### Prerequisites
*   **Bun** (v1.0+)
*   **Docker** (Running OpenSearch and Redis)

### Setup
1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Start backing services (from root):
    ```bash
    docker compose up -d opensearch redis
    ```
3.  Run the API:
    ```bash
    bun run dev
    ```
    The server will start on `http://localhost:3001`.

### Documentation
*   **Swagger UI:** Access interactive API docs at `http://localhost:3001/api-docs`.

---

## 🧪 Testing

We use Bun's built-in test runner.

*   **Unit Tests:** `bun test`
*   **Smoke Tests:** `bun test src/tests/smoke.test.ts` (Verifies OpenSearch connectivity).