# NexusRail

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/)
[![Stellar](https://img.shields.io/badge/Stellar-Horizon-black?logo=stellar)](https://stellar.org/)
[![XRPL](https://img.shields.io/badge/XRPL-Altnet-0055ff?logo=xrp)](https://xrpl.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

NexusRail is an enterprise-grade multi-rail commerce platform combining native Web3 settlements (Stellar & XRPL), traditional fiat checkout (Stripe), an immutable double-entry ledger in MongoDB Atlas, and an autonomous AI commerce assistant.

---

## 🌐 Deployments

| Service | Platform | URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Vercel | [https://nexus-rail-one.vercel.app](https://nexus-rail-one.vercel.app) | 🟢 Production |
| **Backend API** | Render | [https://nexus-rail.onrender.com](https://nexus-rail.onrender.com) | 🟢 Active |
| **Health Check** | Render | [https://nexus-rail.onrender.com/health](https://nexus-rail.onrender.com/health) | 🟢 200 OK |
| **API Proxy** | Vercel | [https://nexus-rail-one.vercel.app/api/v1/health](https://nexus-rail-one.vercel.app/api/v1/health) | 🟢 200 OK |

---

## 📚 Documentation Index

| Document | Purpose |
| :--- | :--- |
| [**`docs/PROJECT_OVERVIEW.md`**](./docs/PROJECT_OVERVIEW.md) | High-level project purpose, value propositions, and verified capabilities. |
| [**`docs/ARCHITECTURE.md`**](./docs/ARCHITECTURE.md) | System topology, request lifecycle, multi-chain provider patterns, and diagrams. |
| [**`docs/API_REFERENCE.md`**](./docs/API_REFERENCE.md) | Complete reference for all verified endpoints, request bodies, and responses. |
| [**`docs/DATA_SOURCES.md`**](./docs/DATA_SOURCES.md) | Inventory of databases, blockchains, APIs, caching mechanisms, and data flows. |
| [**`docs/CONFIGURATION.md`**](./docs/CONFIGURATION.md) | Environment variable definitions, deployment profiles, and defaults. |
| [**`docs/TESTING_AND_OPERATIONS.md`**](./docs/TESTING_AND_OPERATIONS.md) | Test suites, commands, 33/33 test verification results, and operational runbooks. |
| [**`docs/KNOWN_LIMITATIONS.md`**](./docs/KNOWN_LIMITATIONS.md) | Catalog of stubbed routes (HTTP 501), in-memory fallbacks, and known constraints. |
| [**`docs/ROADMAP.md`**](./docs/ROADMAP.md) | Prioritized (P0–P3) technical improvement proposals with implementation outlines. |
| [**`docs/SOURCE_OF_TRUTH.md`**](./docs/SOURCE_OF_TRUTH.md) | Strict claim-to-code audit mapping verifying real vs planned features. |
| [**`openapi.yaml`**](./openapi.yaml) | Valid OpenAPI 3.0.3 specification for the REST API. |

---

## ✨ Features

- **Multi-Rail Crypto Settlement**:
  - **Stellar Horizon**: Direct XLM settlement with transaction memo matching and sequence verification.
  - **XRPL Altnet**: Direct XRP settlement via WebSocket RPC with 32-bit Destination Tag routing.
- **Traditional Card Payments**: Stripe Checkout session support with webhook fulfillment.
- **AI Commerce Assistant**: Sub-300ms conversational agent (Groq / Gemini) with a structured tool registry for catalog search, discounts, and order management.
- **Double-Entry Ledger**: Immutable transaction logging in MongoDB ensuring balanced accounting between customer escrow and merchant settlement.
- **Modern Responsive Frontend**: Next.js 15 App Router with React 19, Tailwind CSS, dark/light theme switching, portfolio animations, and mobile drawer navigation.
- **API Reverse Proxy**: Frontend routes `/api/v1/*` through Next.js server handlers directly to the backend to eliminate cross-origin issues in browsers.

---

## 🏗 Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (Vercel)"]
        UI["Next.js 15 App Router\n(React 19 + Tailwind CSS)"]
        Theme["Theme Provider\n(Dark / Light)"]
        Wallets["Wallet Connectors\n(Freighter / GemWallet)"]
        Proxy["Next.js Route Proxy\n(/api/v1/*)"]
    end

    subgraph Backend ["Backend API (Render)"]
        API["Express.js Server\n(TypeScript ESM)"]
        AuthService["Auth & Session\n(JWT HMAC-SHA256)"]
        AgentEngine["AI Commerce Desk\n(Groq Llama 3.3 / Tool Registry)"]
        LedgerWatcher["Ledger Watcher Worker\n(On-chain Poller)"]
    end

    subgraph DataSettlement ["Data & Settlement"]
        Mongo[("MongoDB Atlas\nUsers, Orders, Ledger")]
        StellarNet["Stellar Horizon\n(XLM Settlement)"]
        XrplNet["XRPL Altnet WebSocket\n(XRP Settlement)"]
        StripeGateway["Stripe Payments\n(Card Checkout)"]
        PinataIPFS["Pinata IPFS\n(Receipt CIDs)"]
    end

    UI --> Proxy
    Proxy --> API
    API --> AuthService
    API --> AgentEngine
    API --> LedgerWatcher
    API --> Mongo
    API --> StellarNet
    API --> XrplNet
    API --> StripeGateway
    API --> PinataIPFS
```

---

## 📂 Repository Structure

```
nexus-rail/
├── frontend/                   # Next.js 15 Web Application (Vercel)
│   ├── public/                 # Optimized WebP assets and favicons
│   ├── src/
│   │   ├── app/                # App Router pages (store, cart, checkout, swap, admin, profile, receipt, guide, payment)
│   │   ├── components/         # Organized by domain:
│   │   │   ├── admin/          # Modular Admin Console shell, design primitives & 11 tabs (incl. AnalyticsTab)
│   │   │   ├── layout/         # AppShell, SiteHeader, SiteFooter, ThemeProvider
│   │   │   ├── wallet/         # WalletConnectModal, WalletIcons, AuthModal
│   │   │   ├── checkout/       # MultiRailCheckoutSelector, StripeCheckoutModal, TransactionSafetyCenter
│   │   │   ├── agent/          # AgentDeskPanel, FloatingAIAgentWidget, RobotMascot
│   │   │   └── ui/             # NexusLogo, Nexus3DCanvas, ProductShowdownCard, RwaGoldVaultCard
│   │   ├── lib/                # Utilities, wallet integrations, and client state
│   │   └── types/              # Self-contained Frontend TypeScript definitions
│   ├── vercel.json             # Standalone Vercel configuration
│   └── README.md               # Frontend Documentation
│
├── backend/                    # Express.js Microservice (Render)
│   ├── src/
│   │   ├── agent/              # Tool registry and proposal lock management
│   │   ├── config/             # Environment schema validation
│   │   ├── middleware/         # Auth and security middlewares
│   │   ├── routes/             # REST API endpoints
│   │   ├── services/           # Stellar, XRPL, Stripe, $NXL AMM, Analytics, AI, and MongoDB services
│   │   ├── types/              # Self-contained Backend TypeScript definitions & Zod schemas
│   │   └── workers/            # Ledger watcher, Webhook DLQ, and keep-alive workers
│   ├── render.yaml             # Standalone Render configuration
│   └── README.md               # Backend Documentation
│
├── docs/                       # System & Module-by-Module Documentation (docs/modules/)
├── openapi.yaml                # OpenAPI 3.0.3 Specification
├── .env.example                # Environment variable template
├── vercel.json                 # Root Vercel configuration
├── render.yaml                 # Root Render configuration
├── package.json                # Workspaces configuration (frontend & backend)
└── README.md                   # Project overview
```

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or higher
- **MongoDB**: Local or MongoDB Atlas instance

### 2. Installation
```bash
git clone https://github.com/AtulPandey429/nexus_rail.git
cd nexus_rail
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Provide the required configuration:
```env
PORT=4000
NODE_ENV=development
JWT_SECRET=your_32_character_jwt_secret_here
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexusrail?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
API_SERVER_URL=http://localhost:4000
```

### 4. Build Backend & Frontend
```bash
npm run build:backend
npm run build:frontend
```

### 5. Run Development Servers
```bash
# Terminal 1: Backend API (http://localhost:4000)
npm run dev:backend

# Terminal 2: Next.js Frontend (http://localhost:3000)
npm run dev:frontend
```

---

## 📊 Admin Console, Business Analytics & Optimizations

- **Modular Admin Console (`/admin`, `/admin/orders`)**:
  - 11 scoped views: **Executive overview**, **Business analytics**, **Orders & settlements**, **Fulfillment queue**, **Treasury & split**, **Custody & asset ledger**, **$NXL liquidity pool**, **Dual-rail vaults**, **Baskets & catalog**, **Exchange rates & oracles**, **AI settlement desk**, and **Security audit trail**.
  - All views read live MongoDB, Redis/cache, oracle, and blockchain telemetry with zero hardcoded mock numbers or demo datasets.
- **Business Analytics (`AnalyticsTab` + `GET /api/v1/admin/analytics`)**:
  - Supports `7d`, `30d`, `90d`, `1y`, and `all` date ranges with `day`, `week`, and `month` granularities.
  - Strictly distinguishes **settled order volume** (`PAID`, `FULFILLING`, `FULFILLED`), **platform revenue** (`platform_treasury` fees, spreads, gas surplus), **net owner profit**, **$NXL AMM reserve liquidity**, and **assets under custody**.
  - Explicitly documents unavailable metrics (`dataQuality.unavailableMetrics`) when underlying accounting ledgers (bank cash balance, external fiat deposits, COGS, negative refund entries) do not exist.
- **Database Indexes & Backend Performance**:
  - Compound and descending indexes on `users` (`createdAt`, `created_at`), `orders` (`created_at`, `status + created_at`, `payment_rail + created_at`), `wallet_ledger` (`created_at`, `type + created_at`), `user_holdings` (`symbol + quantity`), `token_withdrawals` (`created_at`), and `platform_chain_logs` (`created_at`).
  - Server-side MongoDB `$facet` and `$lookup` aggregations replace full-collection scans in `AdminAnalyticsService`, `TreasuryService.getTreasurySummary()`, `PortfolioService.getPlatformAUC()`, `GET /api/v1/admin/stats`, `GET /api/v1/admin/orders`, and `GET /api/v1/analytics/summary`.
  - Short-TTL caching (`RedisCacheService`) on analytics (`30s`), admin products (`60s`), Soroban contract/RPC metadata (`60s`), and XRPL/Stellar dual-rail summary (`30s`) with write-through cache invalidation.

---

## 📜 Scripts

- `npm run build`: Compiles backend TypeScript and builds the Next.js frontend.
- `npm test`: Runs the backend Node.js test suite (`backend/test/**/*.test.ts`).
- `npm run dev:backend` (alias `dev:api`): Starts backend API in development mode with live reload.
- `npm run dev:frontend` (alias `dev:web`): Starts Next.js development server.
- `npm run build:backend` (alias `build:api`): Compiles the backend API (`tsc`).
- `npm run build:frontend` (alias `build:web`): Builds the Next.js frontend for production.

---

## 📄 License
MIT
