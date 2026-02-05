# Document 06: Fetcher Logic

## 1. Service Description
The Fetcher is a specialized background service responsible for the extraction and transmission of data from Microsoft Graph. It operates as an independent container service.

## 2. Operational Lifecycle
1.  **Scheduling:** The service is triggered based on a Cron schedule (`*/30 * * * *`), managed by `supercronic`.
2.  **Configuration Loading:**
    *   Upon startup, the service retrieves encrypted configuration parameters (Client IDs, Certificates) from Redis.
    *   This allows for configuration updates (e.g., credential rotation) without container restarts.
3.  **Data Extraction:**
    *   Authenticates with Microsoft Graph using a PFX Certificate.
    *   Executes parallel "Delta Queries" for devices and users to retrieve only changed data.
    *   Fetches supplementary data: Compliance policies, Hardware details, and Application health.
4.  **Transmission:**
    *   Compiles the collected data into a unified JSON payload.
    *   Transmits the payload to the Backend API via HTTP POST (`/api/v2/ingest/all`).

## 3. Integration Contract
The Fetcher adheres to a strict data contract with the API. The expected payload structure includes:
*   `managedDevices`: Array of device objects (Intune schema).
*   `users`: Array of user objects (Entra ID schema).
*   `deviceComplianceStatus`: Map of compliance states.
*   `hardwareInformation`: Detailed hardware telemetry.
*   `crashes`: Application reliability events.
