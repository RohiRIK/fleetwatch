# Document 11: Service Catalog (Infrastructure)

## 1. OpenSearch
**Service Name:** `opensearch`
**Type:** Document Store / Search Engine

### Responsibilities
*   **Primary Data Store:** Persists all normalized device and user records.
*   **Search Engine:** Provides querying capabilities for the API (filtering, aggregation).
*   **Indexing:** Maintains indices for `devices_v2`, `users_v1`, `logs`, and `configurations`.

### Configuration
*   **Java Heap:** Configured with 512MB min/max heap.
*   **Resource Limit:** container memory limit set to 2GB.
*   **Discovery:** Single-node configuration.

---

## 2. Redis
**Service Name:** `redis`
**Type:** In-Memory Key-Value Store

### Responsibilities
*   **Session Store:** Persists authenticated user sessions to allow for stateless API operation.
*   **Signal Bus:** Facilitates communication between API and Fetcher (e.g., config reload signals).
*   **Credential Cache:** Stores encrypted ephemeral keys and configuration parameters.

### Configuration
*   **Persistence:** AOF (Append Only File) enabled for durability.
*   **Eviction:** `allkeys-lru` policy with 100MB max memory.

---

## 3. Caddy
**Service Name:** `caddy`
**Type:** Reverse Proxy / Web Server

### Responsibilities
*   **Gateway:** Handles all incoming HTTP/HTTPS traffic from the host.
*   **TLS Termination:** Manages SSL certificates for secure communication.
*   **Request Routing:** Directs traffic to the appropriate container (`api-ts` or `frontend-next`).

### Configuration
*   **Ports:** Exposes 80 and 443.
*   **Mounts:** Maps local certificates and configuration files.
