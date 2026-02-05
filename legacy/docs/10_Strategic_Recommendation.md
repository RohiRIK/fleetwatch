# Document 10: Technical State Summary

## 1. System Architecture State
The current system implements a microservices architecture centered around OpenSearch as the primary data store.

*   **Architecture Pattern:** Containerized Microservices.
*   **Data Strategy:** Document-based (NoSQL) with heavy normalization performed at the API layer.
*   **Ingestion Strategy:** Scheduled batch ingestion (30-minute intervals) via a dedicated Fetcher service.

## 2. Component State
*   **Backend API:** TypeScript/Express application containing the core business logic. Source code is present and accessible.
*   **Frontend:** Next.js application delivered as compiled artifacts.
*   **Fetcher:** Background worker defined by container configuration and runtime scripts.
*   **Infrastructure:** Orchestrated via Docker Compose with persistent volumes for data and certificates.

## 3. Technology Stack Summary
*   **Runtime:** Bun (API, Fetcher), Node.js (Frontend).
*   **Database:** OpenSearch (Java/Lucene).
*   **Cache/Bus:** Redis.
*   **Proxy:** Caddy (Go).
