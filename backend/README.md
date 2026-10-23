# NexusRail Backend Engine (`@nexusrail/api`)

[![Express](https://img.shields.io/badge/Express-4.21.2-lightgrey?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/)
[![Stellar SDK](https://img.shields.io/badge/Stellar%20SDK-13.3.0-black?logo=stellar)](https://developers.stellar.org/)
[![XRPL SDK](https://img.shields.io/badge/XRPL%20SDK-4.7.0-0055ff?logo=xrp)](https://js.xrpl.org/)
[![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?logo=render)](https://nexus-rail.onrender.com)

The backend microservice for **NexusRail**. Provides native multi-rail payment verification (Stellar & XRPL), double-entry ledger bookkeeping, Stripe payment processing, and autonomous AI commerce agent orchestration.

---

## Live Endpoints
- **Base URL**: [https://nexus-rail.onrender.com](https://nexus-rail.onrender.com)
- **Health Check**: `GET https://nexus-rail.onrender.com/health`
- **API Version 1 Root**: `https://nexus-rail.onrender.com/api/v1`

---

## Core Architecture

### 1. Multi-Rail Settlement Providers
- **Stellar Horizon (`StellarHorizonProvider`)**:
  - Connects to the Stellar Horizon network (`https://horizon-testnet.stellar.org`).
  - Generates payment invoices with unique transaction memos.
  - Verifies payment operations, addresses, and sequence numbers directly via Horizon REST.
- **XRPL Altnet (`XrplAltnetProvider`)**:
  - Persistent WebSocket connection to `wss://s.altnet.rippletest.net:51233`.
  - Routes invoices using deterministic 32-bit `DestinationTag` values.
  - Subscribes to ledger validation streams to confirm `tesSUCCESS` finality.

### 2. Double-Entry Wallet Ledger
- Backed by MongoDB Atlas collection `wallet_ledger`.
- Every incoming transaction records matched debit and credit journal entries (`customer_escrow` and `merchant_settlement`) ensuring balanced, traceable accounting.

### 3. AI Commerce Assistant
- LLM inference via Groq (`llama-3.3-70b-versatile`) and Gemini.
- Tool execution registry supporting product discovery, cart adjustments, and checkout preparation.
- Distributed proposal locks (`proposalLock.ts`) prevent race conditions during concurrent cart operations.

### 4. Authentication
- Session tokens signed with HMAC-SHA256 (`jwt.ts`).
- Google OAuth token verification and account linking.
- API key middleware for service-to-service access.

---

## REST Endpoints

### Auth (`/api/v1/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user account. |
| `POST` | `/api/v1/auth/login` | Authenticate user and issue JWT. |
| `POST` | `/api/v1/auth/google` | Verify Google OAuth token. |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile. |

### Products & Cart (`/api/v1/products`, `/api/v1/cart`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/products` | Query product catalog. |
| `GET` | `/api/v1/products/:id` | Fetch product details. |
| `GET` | `/api/v1/cart` | Get current user's cart. |
| `POST` | `/api/v1/cart` | Add item or update quantity. |
| `DELETE` | `/api/v1/cart/:id` | Remove item from cart. |

### Web3 Settlement (`/api/v1/crypto`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/crypto/invoice` | Generate payment invoice (memo / destination tag). |
| `POST` | `/api/v1/crypto/verify` | Submit transaction hash for on-chain verification. |
| `GET` | `/api/v1/crypto/rails` | List active payment rails and node status. |

### Fiat & Webhooks (`/api/v1/checkout`, `/api/v1/webhooks`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/checkout/session` | Create Stripe Checkout session. |
| `POST` | `/api/v1/webhooks/stripe` | Handle Stripe payment events. |

### AI Agent (`/api/v1/agent`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/agent/chat` | Send prompt to conversational AI assistant. |
| `GET` | `/api/v1/agent/tools` | List registered agent tools. |

---

## Background Workers

- **`ledgerWatcher.ts`**: Asynchronous payment watcher polling Horizon and XRPL streams for transaction finality.
- **`keepAlive.ts`**: Periodic health ping keeping cloud instances active.

---

## Local Development

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **MongoDB**: Connection string for MongoDB Atlas or local MongoDB

### 2. Environment Configuration
Create `.env` in the root directory:
```env
PORT=4000
NODE_ENV=development
JWT_SECRET=your_32_character_jwt_secret_here
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexusrail?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
# From monorepo root:
npm run dev:api

# Or from apps/api:
npm run dev
```

### 4. Build
```bash
npm run build
```

---

## Dependencies
- `express`: HTTP server framework
- `@stellar/stellar-sdk`: Stellar Horizon SDK
- `xrpl`: XRPL WebSocket and RPC SDK
- `mongodb`: MongoDB driver
- `stripe`: Payment processing
- `zod`: Schema validation
