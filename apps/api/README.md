# ⚙️ NexusRail Backend Engine (`@nexusrail/api`)

[![Express](https://img.shields.io/badge/Express-4.21.2-lightgrey?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20M0-green?logo=mongodb)](https://www.mongodb.com/)
[![Stellar SDK](https://img.shields.io/badge/Stellar%20SDK-13.3.0-black?logo=stellar)](https://developers.stellar.org/)
[![XRPL SDK](https://img.shields.io/badge/XRPL%20SDK-4.7.0-0055ff?logo=xrp)](https://js.xrpl.org/)
[![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?logo=render)](https://nexus-rail.onrender.com)

The enterprise-grade backend service powering **NexusRail**. Provides native multi-rail crypto payment verification (Stellar & XRPL), double-entry ledger bookkeeping, Stripe payment processing, and autonomous AI commerce agent orchestration.

---

## 🌐 Live Service & Endpoints
- **Base API URL**: [https://nexus-rail.onrender.com](https://nexus-rail.onrender.com)
- **Health Check**: `GET https://nexus-rail.onrender.com/health` (Returns HTTP 200 `status: "ok"`)
- **API Version Root**: `https://nexus-rail.onrender.com/api/v1`

---

## 🏗 Key Architectural Pillars

### 1. ⚡ Clean-Room Dual-Rail Settlement
Unlike payment processors that rely on third-party custodial APIs, NexusRail settles directly on public blockchain ledgers:
- **Stellar Horizon (`StellarHorizonProvider`)**:
  - Connects to `https://horizon-testnet.stellar.org`.
  - Generates unique invoice payment addresses with alphanumeric transaction memos.
  - Verifies payment operations, sender/receiver addresses, and ledger sequence numbers directly via Horizon REST.
  - Zero invented transaction hashes.
- **XRPL Altnet (`XrplAltnetProvider`)**:
  - Establishes a persistent WebSocket connection to `wss://s.altnet.rippletest.net:51233`.
  - Uses a deterministic 32-bit `DestinationTag` to uniquely associate payments with shopping carts.
  - Subscribes to ledger close streams to verify `tesSUCCESS` transaction engine results.

### 2. 📒 Immutable Double-Entry Ledger
- Backed by MongoDB Atlas collection `wallet_ledger`.
- Every incoming transaction produces offsetting debit and credit journal entries:
  - Account: `merchant_settlement`
  - Account: `customer_escrow`
- Guarantees zero orphaned funds and mathematical consistency during concurrent order processing.

### 3. 🤖 Sub-300ms AI Commerce Desk
- Direct integration with **Groq (`llama-3.3-70b-versatile`)** with sub-second response times.
- **Tool Calling Registry** ([toolRegistry.ts](file:///d:/live/nexus-rail/apps/api/src/agent/toolRegistry.ts)):
  - `findProducts(query, category, maxPrice)`
  - `prepareCheckout(cartId, rail)`
  - `checkLedgerStatus(orderId)`
  - `applyDiscount(code)`
- **Proposal Locks** ([proposalLock.ts](file:///d:/live/nexus-rail/apps/api/src/agent/proposalLock.ts)):
  - Distributed lock manager preventing race conditions when the AI agent modifies customer baskets.

### 4. 🔒 Authentication & Security Model
- **JWT Authentication**: High-security HMAC-SHA256 signed session tokens (`jwt.ts`).
- **Google OAuth**: Verified token exchange endpoint (`/api/v1/auth/google`) with automatic user account provisioning.
- **API Key Guard**: Middleware protection (`apiKey.ts`) for external B2B access.
- **Environment Isolation**: Zero hardcoded credentials; validated at boot via Zod schema ([env.ts](file:///d:/live/nexus-rail/apps/api/src/config/env.ts)).

---

## 📡 REST API Reference

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register a new user account with email and password. |
| `POST` | `/api/v1/auth/login` | Authenticate credentials and receive a bearer JWT. |
| `POST` | `/api/v1/auth/google` | Exchange a Google OAuth token for a session JWT. |
| `GET` | `/api/v1/auth/me` | Fetch currently authenticated user profile and roles. |

### Products & Store (`/api/v1/products`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Retrieve store catalog with category and price filters. |
| `GET` | `/api/v1/products/:id` | Fetch specific product details, inventory, and reviews. |

### Cart & Orders (`/api/v1/cart`, `/api/v1/orders`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/cart` | Get current customer's cart items and computed subtotals. |
| `POST` | `/api/v1/cart` | Add product to cart or increment quantity. |
| `DELETE` | `/api/v1/cart/:id` | Remove specific item from cart. |
| `GET` | `/api/v1/orders` | List user orders and settlement statuses. |
| `GET` | `/api/v1/orders/:id` | Get order detail with on-chain transaction hash and IPFS CID. |

### Web3 & Crypto Payments (`/api/v1/crypto`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/crypto/invoice` | Generate a new settlement invoice (Stellar memo or XRPL destination tag). |
| `POST` | `/api/v1/crypto/verify` | Submit transaction hash for on-chain verification and immediate ledger credit. |
| `GET` | `/api/v1/crypto/rails` | Inspect available settlement rails and active network nodes. |

### Traditional Checkout & Webhooks (`/api/v1/checkout`, `/api/v1/webhooks`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/checkout/session` | Create a Stripe Checkout Session for card payments. |
| `POST` | `/api/v1/webhooks/stripe` | Handle Stripe asynchronous payment fulfillment events. |

### AI Agent Desk (`/api/v1/agent`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/agent/chat` | Send conversational prompt; returns streaming or structured AI response with tool executions. |
| `GET` | `/api/v1/agent/tools` | Inspect available tool definitions in the registry. |

### Real-World Assets (`/api/v1/rwa`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/rwa/gold/quote` | Fetch live gold oracle price per gram. |
| `POST` | `/api/v1/rwa/gold/mint` | Simulate minting of tokenized gold backing tokens. |

---

## 🛠 Background Workers

1. **`ledgerWatcher.ts`**:
   - Asynchronous payment reconciler that monitors pending on-chain invoices.
   - Automatically polls Stellar Horizon and XRPL WebSocket streams until ledger finality is reached.
2. **`keepAlive.ts`**:
   - Periodic self-ping service ensuring Render free-tier instances remain responsive and do not experience cold-start delays during active business hours.

---

## 💻 Local Development

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **MongoDB**: Local instance or MongoDB Atlas M0 URI

### 2. Configure Environment
Copy `.env.example` from the root directory into `.env` (or configure `apps/api/.env`):
```env
PORT=4000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_passphrase_at_least_32_characters
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexusrail?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000

# Optional Web3 Testnets
HORIZON_URL=https://horizon-testnet.stellar.org
XRPL_WSS=wss://s.altnet.rippletest.net:51233
```

### 3. Run Development Server
```bash
# From monorepo root:
npm run dev:api

# Or from apps/api:
npm run dev
```
The server will start at [http://localhost:4000](http://localhost:4000).

### 4. Build for Production
```bash
# Compiles TypeScript to dist/
npm run build
```

---

## 📦 Key Dependencies
- `express`: Core REST HTTP server
- `@stellar/stellar-sdk`: Native Stellar blockchain client
- `xrpl`: Ripple XRPL WebSocket and RPC library
- `mongodb`: Official MongoDB driver for Atlas M0
- `stripe`: Payment gateway integration
- `zod`: Runtime type validation for configurations and payloads
- `tsx`: Rapid development runtime with TypeScript support
