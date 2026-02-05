# Document 07: Frontend Stack

## 1. Technology Stack
The Frontend service is built using **Next.js**, a React framework for production.

*   **Framework:** Next.js (App Router architecture implied by structure).
*   **Runtime:** Node.js / Bun.
*   **Build Output:** The service runs from compiled artifacts (`.next`).

## 2. Architectural Integration
*   **Proxy Pattern:** The frontend operates behind the Caddy proxy.
*   **API Consumption:**
    *   **Server-Side:** Connects to the API container via the internal Docker network (`http://api-ts:3001`).
    *   **Client-Side:** Connects to the API via the public proxy path (`/api`).
*   **Configuration:**
    *   `NEXT_PUBLIC_API_URL`: Configured to `/api` for relative path routing.
    *   `API_BASE_URL`: Configured for internal container resolution.

## 3. Deployment
The service is containerized (`legacy/frontend-next/Dockerfile`) and orchestrated via Docker Compose, exposing port `3002` internally to the Caddy proxy.
