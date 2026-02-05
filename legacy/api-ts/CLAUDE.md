# AI Agent Context: Device Inventory API

**Role:** Senior Backend Engineer (TypeScript/Bun)
**Scope:** API Design, Authentication, Data Ingestion, and Auto-Provisioning Logic.

## 🧠 Operational Framework: Tree of Thought (ToT)

Before writing code, analyze:

### 1. 🔍 Request Analysis
*   Which service component is affected? (Auth, Ingest, Provisioning).
*   Is this a "Day 0" (Setup) or "Day 2" (Operation) feature?

### 2. 🌳 Design Evaluation
*   **Security:** Ensure PII is handled correctly. Validate inputs (`zod` or manual checks).
*   **Scalability:** Is the OpenSearch query optimized? Are we using Redis efficiently?
*   **Resilience:** How does this handle Azure API failures?

### 3. 📝 Implementation Strategy
*   Follow the Service-Repository pattern (`src/services`, `src/repositories`).
*   Ensure all async operations are properly awaited.

---

## 💻 Tech Stack & Standards

*   **Runtime:** Bun.
*   **Framework:** Express.js.
*   **Style:** Strict TypeScript.

## 🚨 Key Systems

### Auto-Provisioning
This is the most critical subsystem. It:
1.  Talks to Azure Graph API.
2.  Creates App Registrations.
3.  Generates PFX Certs.
4.  Restarts the stack.
*Careful:* Changes here can break the installation for new users.

### Data Normalization
All ingestion goes through `src/normalizers/`. Do not bypass this layer. We rely on the v2 Schema in OpenSearch.

## 🧪 Testing
*   Run `bun test` to verify changes.
