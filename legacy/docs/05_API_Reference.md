# Document 05: API Reference

## 1. Service Overview
The Backend API (`api-ts`) is a RESTful service built with Express.js and TypeScript, running on Bun. It serves as the primary interface for data ingestion, querying, and system management.

**Base URL:** `/` (Proxied via Caddy)
**Version:** v2

## 2. Route Catalog (Verified)

### Inventory Endpoints (`/v2`)
*   `GET /api/v2/devices`: Retrieve paginated device lists with filtering capabilities.
*   `GET /api/v2/users`: Retrieve user profiles and associated devices.
*   `GET /api/v2/licenses`: Access software license utilization data.
*   `GET /api/v2/analytics`: Aggregate system health and performance metrics.
*   `GET /api/v2/compliance`: Access compliance policy definitions and states.

### Ingestion Endpoints (`/v2/ingest`)
*   `POST /api/v2/ingest/all`: Bulk ingestion endpoint used by the Fetcher. Accepts a payload containing devices, users, and telemetry.
*   `POST /api/v2/ingest/devices`: Ingest specifically managed device data.
*   `POST /api/v2/ingest/users`: Ingest user directory data.
*   `DELETE /api/v2/ingest/clear/:index`: Operations for index maintenance.

### System Management (`/v2`)
*   `GET /api/v2/settings`: Retrieve current system configuration.
*   `POST /api/v2/provisioning`: Endpoint for the automated "Zero-Touch" setup wizard.
*   `GET /api/v2/diagnostics`: System health status and component connectivity checks.

## 3. Middleware Architecture
The API utilizes a layered middleware approach:
1.  **Request Protection:** `helmet` and `cors` for standard web security.
2.  **Authentication:**
    *   `sessionMiddleware`: Validates Redis-backed user sessions.
    *   `createIngestAuthMiddleware`: Validates Bearer tokens for machine-to-machine communication.
3.  **Rate Limiting:** Redis-backed rate limiter (`rate-limit-redis`) protecting ingest and auth routes.
4.  **Logging:** Winston-based logger with PII redaction (`piiRedactionMiddleware`).
