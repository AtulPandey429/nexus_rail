# 🌐 NexusRail — Project Overview & Verified Capabilities

**Status:** Production-Ready & Deployed  
**Target Environments:** Vercel (Frontend Client) + Render (API Microservice)  
**Live Production URL:** [https://nexus-rail-one.vercel.app](https://nexus-rail-one.vercel.app)  
**Backend API URL:** [https://nexus-rail.onrender.com](https://nexus-rail.onrender.com)  

---

## 1. Executive Summary

**NexusRail** is an enterprise-grade multi-rail digital commerce platform and autonomous AI agent desk. It bridges the gap between traditional fiat commerce (Stripe) and decentralized public Web3 ledgers (**Stellar Horizon** and **XRPL Altnet**) through a unified, clean-room payment gateway.

The platform provides mathematically consistent financial accounting via an internal double-entry ledger in MongoDB Atlas, tamper-proof server-side pricing validation, and an autonomous conversational AI commerce assistant powered by Groq LLMs.

---

## 2. Core Value Propositions

1. **Non-Custodial Multi-Rail Payments**: Customers can pay using **Stellar XLM** or **XRP** directly on public testnet ledgers without custodial intermediaries or payment processors taking percentage fees.
2. **Traditional Card Fallback**: Traditional buyers can check out using credit/debit cards via an integrated **Stripe Checkout** session modal.
3. **Sub-300ms Conversational AI Desk**: Buyers can discover items, query live exchange rates, and authorize purchases through natural language using the autonomous Groq-backed AI assistant.
4. **Tamper-Proof Commerce**: Product pricing is never trusted from client payloads. Unit prices, inventory availability, and order totals are strictly derived from the verified backend MongoDB catalog.
5. **Mathematically Balanced Ledger**: Every deposit and settlement generates balanced debit and credit entries in MongoDB (`wallet_ledger`), completely preventing overdrafts and orphaned funds.

---

## 3. Implemented & Verified Capabilities

### A. Authentication & Identity
- **Credential Auth**: Registration and login using `crypto.scryptSync` with unique random salt (16 bytes) and constant-time string comparison (`crypto.timingSafeEqual`).
- **Session Tokens**: Custom HMAC-SHA256 signed JWTs with sub-second issuance and zero third-party auth lock-in.
- **Web3 Wallet Challenge**: Nonce creation with 5-minute MongoDB TTL; signature verification using `ethers.verifyMessage`.
- **Google OAuth**: Decodes Google JWT identity tokens, auto-provisions user records in MongoDB, and issues platform JWTs.
- **Manual Wallet Entry**: Validates Stellar G-addresses (56 chars) and XRPL classic r-addresses (25-35 chars).

### B. Catalog & Shopping Cart
- **Product Catalog**: Multi-category hardware and digital gear seeded into MongoDB `products` collection with categories (`hardware`, `workspace`, `essentials`, `software`, `subscription`).
- **Atomic Upvotes**: Community upvoting using MongoDB `$inc: { upvotes_count: 1 }`.
- **Persistent Cart**: User cart line items stored in MongoDB `cart_items` collection with add, update quantity, and delete operations.
- **Leaderboard**: Top trending products endpoint sorted by community upvotes.

### C. Multi-Rail Settlement Engine
- **Stellar Horizon Provider**:
  - Connects to `https://horizon-testnet.stellar.org`.
  - Derives collision-resistant 28-byte HMAC-SHA256 memos (`NR...`).
  - Pre-builds unsigned payment XDR envelopes for Freighter browser wallet.
  - Verifies delivered XLM amounts and transaction sequence numbers via Horizon REST.
- **XRPL Altnet Provider**:
  - Persistent pooled WebSocket client connected to `wss://s.altnet.rippletest.net:51233`.
  - Computes deterministic 32-bit `DestinationTag` values in the range `[100000, 2147483647]`.
  - Validates `tesSUCCESS` finality and delivered drops/XRP via WebSocket `tx` command.
- **Stripe Card Checkout**:
  - Creates hosted Stripe Checkout Sessions from MongoDB cart items.
  - Asynchronous webhook handler validates `stripe-signature` and updates order to `PAID`.
- **Pinata IPFS Archiving**:
  - Pins finalized order receipt JSON to IPFS gateway and stores IPFS CID in order records.

### D. Double-Entry Wallet Ledger
- **Internal Balance**: Multi-asset support (`USD`, `XLM`, `XRP`) backed by immutable records in `wallet_ledger`.
- **Overdraft Guard**: Prevents debits if requested funds exceed verified balance.
- **Reconciliation**: Allows buyers to top up balances or purchase items directly using internal funds.

### E. Autonomous AI Agent Desk
- **Inference Engine**: Connects to Groq OpenAI-compatible chat completions (`llama-3.3-70b-versatile`).
- **Self-Healing Model Discovery**: Dynamically queries Groq `GET /models` to discover active chat models and fall back gracefully if a model is decommissioned.
- **Tool Registry**: Functions for `search_catalog`, `check_wallet_balance`, `get_exchange_rates`, and `get_live_gold_rates`.
- **Atomic Proposal Locks**: Single-use proposal records in MongoDB `proposals` with 5-minute TTL preventing race conditions during cart modifications.
- **Audit Telemetry**: Asynchronously logs AI prompts, replies, and latency to `agent_audit_traces`.

### F. Social Commerce Hub
- **Product Showdowns**: Head-to-head community battles with atomic voting recorded in `showdowns`.
- **Mento Verified Reviews**: Review submission with automatic `verified_purchase` verification based on matching paid orders in MongoDB.

### G. Client Architecture & UI
- **Next.js 15 App Router**: Server and Client Components with React 19.
- **Adaptive Theming**: Dark/Light mode toggle with `localStorage` persistence and CSS variable tokens.
- **Reverse Proxy**: Server catch-all route (`apps/web/src/app/api/v1/[...path]/route.ts`) proxies API calls to the Render backend, preventing browser CORS leaks.
- **WebP Assets**: Ultra-lightweight branding icons (`logo-icon.webp` at 1.6 KB).

---

## 4. Current Implementation Status Summary

| Area | Implementation Status | Real Behavior in Codebase |
| :--- | :--- | :--- |
| **MongoDB Atlas Database** | 🟢 Complete & Verified | Primary database for all collections, indexes, and sessions. |
| **User Auth & JWT** | 🟢 Complete & Verified | Scrypt hashing, timing-safe validation, HMAC-SHA256 JWTs. |
| **Cart & Tamper-Proof Orders** | 🟢 Complete & Verified | Server-side pricing enforcement; unique `NR-XXXXXXXX` IDs. |
| **Stellar Horizon Testnet** | 🟢 Complete & Verified | Real on-chain invoice generation, XDR build, memo matching. |
| **XRPL Altnet Testnet** | 🟢 Complete & Verified | Real WebSocket RPC, 32-bit DestinationTag, `tesSUCCESS`. |
| **Stripe Checkout** | 🟢 Complete & Verified | Session creation and webhook signature validation. |
| **Double-Entry Wallet** | 🟢 Complete & Verified | Balanced immutable ledger, overdraft prevention. |
| **Groq AI Agent Desk** | 🟢 Complete & Verified | Live inference, tool calling, 5-min TTL proposal locks. |
| **Market Rates (CoinGecko/Binance)** | 🟢 Complete & Verified | Live XLM, XRP, PAXG gold, and KAG silver rates with 30-min cache. |
| **In-Memory Caching** | 🟡 Partial | In-memory `Map` used in `redis.ts`; external Redis not connected. |
| **WebSockets** | 🟡 Partial | `SocketService` logs to console; `socket.io` library not installed. |
| **RWA Gold Token Minting** | ⚪ Planned (501) | Returns HTTP 501 Not Implemented; spot gold pricing is live. |
| **Perpetuals / DeFi Engines** | ⚪ Planned (501) | Returns HTTP 501 Not Implemented via `superPlatformRouter`. |
| **UPI / TRON TRC20 Rails** | ⚪ Planned (501) | Stated in aspirational blueprints; returns HTTP 501 in code. |

---

## 5. System Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (Edge Network)                   │
│  - Next.js 15 App Router Frontend (React 19)                │
│  - Responsive UI with Dark/Light Theme Provider             │
│  - WebP Branding Assets                                     │
│  - Reverse Proxy Route: /api/v1/*                           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (Reverse Proxy Forward)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     RENDER (API Microservice)               │
│  - Express 4 Server (Node.js 22 ESM)                        │
│  - JWT Middleware & Security Guards                         │
│  - Multi-Chain Provider Registry (Stellar + XRPL)           │
│  - AI Router Service (Groq API Client)                      │
│  - Background Ledger Watcher & Keep-Alive Daemon            │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      MONGODB ATLAS M0        │ │    PUBLIC BLOCKCHAINS      │
│  - users & auth_nonces (TTL) │ │  - Stellar Horizon Testnet │
│  - products & cart_items     │ │  - XRPL Altnet Node (WSS)  │
│  - orders & wallet_ledger    │ │  - Stripe API Gateway      │
│  - proposals (TTL) & traces  │ │  - Pinata IPFS Gateway     │
└──────────────────────────────┘ └────────────────────────────┘
```
