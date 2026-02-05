# Document 09: Repository Inventory

## 1. Folder Structure
The `legacy/` directory contains the containerized microservices and their configuration.

### Active Components
*   **`legacy/api-ts/`**: 
    *   Contains the source code (`src/`) for the Backend API.
    *   Includes configuration services, data normalizers, and route definitions.
    *   Key Logic: `device-normalizer.ts`, `auto-provisioning.service.ts`.

### Build Contexts
*   **`legacy/fetcher/`**:
    *   Contains `Dockerfile` and `entrypoint.sh`.
    *   Defines the runtime environment (Bun) and scheduling (Supercronic) for the sync service.
*   **`legacy/frontend-next/`**:
    *   Contains build artifacts (`.next` directory).
    *   Serves as the deployment context for the UI container.

## 2. Configuration Files
*   **`docker-compose.yml`**: Definition of the 6-service stack, networks, and volumes.
*   **`.env`**: Environment variable template for system configuration.
