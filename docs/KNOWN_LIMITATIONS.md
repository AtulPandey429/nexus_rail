# ⚠️ NexusRail — Known Limitations, Gaps & Architectural Trade-Offs

**Audit Date:** October 2026  
**Auditor:** Senior Software Engineer & Code Auditor  

This document catalogs all verified limitations, stubbed routes, partial implementations, and known behavioral constraints in **NexusRail**.

---

## 1. Stubbed & Non-Functional Routes (HTTP 501)

### A. SuperPlatform Router (`apps/api/src/routes/superPlatform.ts`)
- **Status:** Planned / Stubbed
- **Reachable Route:** `/api/v1/superplatform/*`
- **Current Behavior:** Returns `HTTP 501 Not Implemented`:
  ```json
  {
    "success": false,
    "error": "This provider is not connected. Risk scores, UPI, TRON, and perpetuals quotes are not issued by this API."
  }
  ```
- **Context:** Historical roadmap documents mentioned UPI deep linking, TRON TRC-20 USDT settlement, and Ostium Perps. These features are not implemented in the current codebase.

### B. RWA Token Minting & Perpetual Quotes (`apps/api/src/routes/rwa/rwaModularRouter.ts`)
- **Status:** Planned / Stubbed
- **Reachable Routes:**
  - `POST /api/v1/rwa/issue-token`
  - `POST /api/v1/rwa-modular/tokens/mint`
  - `GET /api/v1/rwa-modular/perps/quote`
- **Current Behavior:** Returns `HTTP 501 Not Implemented`.
- **Note:** Real-world asset spot price querying (`GET /api/v1/rwa/live-prices` and `GET /api/v1/rwa-modular/oracle/rates`) **is implemented and working** via CoinGecko PAXG/KAG price feeds. Only on-chain asset minting and perpetual contracts are stubbed.

---

## 2. In-Memory Subsystems (Partial Implementations)

### A. Redis Cache Service (`apps/api/src/services/redis.ts`)
- **Status:** Partial (In-Memory Fallback)
- **Current Behavior:** The class `RedisCacheService` implements an in-memory JavaScript `Map<string, { value: any; expiresAt: number }>` with time-to-live expiration.
- **Limitation:** In a multi-instance or serverless container environment, caches are not shared between instances, and restarts flush the cache.
- **Dependency Note:** Neither `ioredis` nor `@upstash/redis` is currently installed in `apps/api/package.json`.

### B. Real-Time WebSockets (`apps/api/src/sockets/server.ts`)
- **Status:** Partial (Console-Logging Stub)
- **Current Behavior:** `SocketService.initializeSockets()`, `emitAgentThinking()`, and `emitOrderUpdated()` write log messages to stdout (`console.log`) rather than maintaining active WebSocket connections with browser clients.
- **Dependency Note:** `socket.io` is not installed in `apps/api/package.json`. Live checkout status updates in the frontend currently rely on client-initiated HTTP polling rather than push events.

---

## 3. External Service Dependencies & Constraints

### A. Public Testnet Settlement Latencies
- **Stellar Horizon Testnet**: Block finality typically occurs in 3–5 seconds. If the Stellar testnet experiences ledger resets or congestion, Horizon queries may return 504 Gateway Timeout.
- **XRPL Altnet Node**: Ledger closes occur every 3–4 seconds. The persistent WebSocket client (`wss://s.altnet.rippletest.net:51233`) handles connection drops via `ensureConnected()`, but testnet resets require new faucet funding.

### B. Legacy Supabase Dependency for Catalog Guide
- **Reachable Route:** `/api/v1/guide/*`
- **Limitation:** While all core commerce (users, cart, orders, ledger, products, traces) has been migrated to MongoDB Atlas, `/api/v1/guide/messages` still calls `db().from('guide_messages')` in Supabase Postgres.
- **Impact:** If `SUPABASE_URL` is omitted, `/api/v1/guide` returns an error. The primary conversational assistant at `/api/v1/agent/chat` is unaffected because it runs entirely on Groq and MongoDB Atlas.

### C. Stripe Webhook Testing
- In local development, incoming webhooks require the Stripe CLI (`stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe`) to forward signed events to the server. Without this, card orders remain in `PENDING` status.
