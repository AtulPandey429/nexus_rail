# 🧪 NexusRail — Testing, Operations & Verification Guide

This document outlines the automated verification test suites, operational commands, monitoring endpoints, background workers, and troubleshooting runbooks for **NexusRail**.

---

## 1. Automated Verification Test Suites

NexusRail includes specialized integration test runners located in `scripts/`. Because the backend runs on Node.js 22 ESM with CJS module loading, tests must be executed with the `--experimental-require-module` flag.

### A. Test Execution Quick Reference

```bash
# 1. Master End-to-End Suite (Validates all 7 subsystems end-to-end)
node --experimental-require-module scripts/verify-master-flow.mjs

# 2. Phase 6 Security & Exploit Prevention Suite
node --experimental-require-module scripts/test-phase6-security-verification.mjs

# 3. Phase 1: Registration, scrypt Password Hashing & JWT Auth
node --experimental-require-module scripts/test-phase1-auth.mjs

# 4. Phase 2: Product Catalog & Atomic Upvotes
node --experimental-require-module scripts/test-phase2-products.mjs

# 5. Phase 3: Shopping Cart & Tamper-Proof Order Pricing
node --experimental-require-module scripts/test-phase3-cart-orders.mjs

# 6. Phase 4: Stellar & XRPL Multi-Chain Invoices
node --experimental-require-module scripts/test-phase4-multichain.mjs

# 7. Phase 5: Double-Entry Ledger & AI Proposal Locks
node --experimental-require-module scripts/test-phase5-ledger-agent.mjs
```

---

## 2. Verified Test Results & Assertions

### Master Flow Suite (`scripts/verify-master-flow.mjs`)
- **Total Assertions:** 33 Passed, 0 Failed
- **Tested Subsystems:**
  1. **MongoDB Atlas Connectivity:** Verified database connection, listing of active collections (`users`, `cart_items`, `proposals`, `orders`, `wallet_ledger`, `products`, `auth_nonces`, `agent_audit_traces`).
  2. **Auth Flow:** User registration with unique salt, scrypt password hashing, absence of password hash in return payload, login success, and invalid password rejection.
  3. **Product Catalog:** Auto-seeding of 10 default products, active status check, and atomic `$inc` upvote increment.
  4. **Shopping Cart & Orders:** Multi-item cart persistence and server-side pricing enforcement.
  5. **Multi-Chain Provider Engine:** Invoice creation on Stellar Horizon Testnet (validating G-address, memo_text, and live account balance) and XRPL Altnet (validating r-address and 32-bit DestinationTag).
  6. **Double-Entry Wallet Ledger:** Credit entries, running balance calculation, overdraft prevention, and atomic AI proposal consumption with single-use replay protection.
  7. **Analytics Telemetry:** Paid order volume and revenue aggregation from MongoDB.

### Security & Exploit Prevention Suite (`scripts/test-phase6-security-verification.mjs`)
- **Total Assertions:** 11 Passed, 0 Failed
- **Tested Security Measures:**
  - Token signature tampering rejection (`crypto.timingSafeEqual`).
  - Expired JWT token rejection.
  - Role-forgery rejection (attempting to elevate role from `user` to `admin`).
  - Deterministic XRPL destination tag derivation within safe range `[100000, 2147483647]`.
  - Stellar memo formatting compliance (prefix `NR` and exact 28-byte limit).
  - On-chain exploit prevention (unvalidated or non-existent transaction hashes rejected).

---

## 3. Operational Monitoring & Health Checks

### Health Endpoints
- **Base Health Check:** `GET https://nexus-rail.onrender.com/health`
  - Returns: `{ "status": "ok", "service": "nexusrail-api", "uptimeSeconds": 1420 }`
  - HTTP Status: `200 OK`
- **Detailed Health Check:** `GET https://nexus-rail.onrender.com/api/v1/health`
  - Returns version, uptime, and ISO timestamp.
- **Frontend Reverse Proxy Check:** `GET https://nexus-rail-one.vercel.app/api/v1/health`
  - Verifies the Next.js edge proxy can reach the Render backend.

### Background Workers
- **`LedgerWatcherWorker` (`apps/api/src/workers/ledgerWatcher.ts`)**:
  - Automatically started during server boot.
  - Scans MongoDB `orders` collection every 20 seconds for pending orders on crypto rails.
- **`KeepAliveWorker` (`apps/api/src/workers/keepAlive.ts`)**:
  - Pings `RENDER_EXTERNAL_URL/api/v1/health` every 10 minutes.
  - Prevents the Render free-tier dyno from sleeping during business hours.

---

## 4. Troubleshooting & Known Failure Modes

| Symptom | Probable Cause | Resolution |
|:---|:---|:---|
| **`MONGODB_URI is not set in environment`** | Missing or incorrect `.env` in root or `apps/api`. | Add `MONGODB_URI` to `.env` pointing to your Atlas cluster. |
| **`CORS policy violation: Origin "..." is not authorized`** | Client requesting from an unwhitelisted domain. | Add domain to `CORS_ORIGIN` in `.env`. Note that `*.vercel.app` domains are auto-allowed in production. |
| **`Failed to load Stellar testnet account`** | Testnet Horizon RPC node is congested or resetting. | Verify node connectivity at `https://horizon-testnet.stellar.org`. Friendbot may need to fund the merchant address. |
| **`XRPL testnet lookup failed`** | WebSocket connection to `wss://s.altnet.rippletest.net:51233` was dropped. | Check network access to port 51233. The provider automatically reconnects via `ensureConnected()`. |
| **`Insufficient USD balance`** | User attempting to purchase item without sufficient ledger balance. | Credit balance via `walletService.creditBalance()` or pay via direct crypto testnet invoice. |
| **`All Groq AI models were unavailable`** | Invalid `GROQ_API_KEY` or temporary Groq Cloud API outage. | The AI Router automatically searches live models via `GET /models`. If unavailable, a fallback message is returned. |
| **`SUPABASE_URL is not set` when accessing `/api/v1/guide`** | Optional Supabase credentials omitted. | `/api/v1/guide` requires Supabase. For AI chat, use `/api/v1/agent/chat` which runs on Groq and MongoDB. |
