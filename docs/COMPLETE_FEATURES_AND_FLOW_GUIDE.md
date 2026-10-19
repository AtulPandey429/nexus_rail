# 📖 NexusRail — Complete Features & End-to-End System Flows Guide

Welcome to the definitive architectural and functional reference for **NexusRail**. This document details every platform capability, system flow, cryptographic settlement engine, database model, and end-to-end user lifecycle implemented in the codebase.

---

## 📑 Table of Contents
1. [Platform Overview & Tech Stack](#1-platform-overview--tech-stack)
2. [Master Feature Matrix](#2-master-feature-matrix)
3. [End-to-End System & User Flows](#3-end-to-end-system--user-flows)
   - [Flow 1: User Authentication & Identity](#flow-1-user-authentication--identity)
   - [Flow 2: Product Discovery & Dynamic Catalog](#flow-2-product-discovery--dynamic-catalog)
   - [Flow 3: Tamper-Proof Cart & Order Lifecycle](#flow-3-tamper-proof-cart--order-lifecycle)
   - [Flow 4: Native Multi-Rail Web3 Crypto Settlement (Stellar & XRPL)](#flow-4-native-multi-rail-web3-crypto-settlement-stellar--xrpl)
   - [Flow 5: Traditional Card Checkout (Stripe Gateway)](#flow-5-traditional-card-checkout-stripe-gateway)
   - [Flow 6: Double-Entry Ledger Bookkeeping](#flow-6-double-entry-ledger-bookkeeping)
   - [Flow 7: Autonomous Sub-300ms AI Commerce Desk](#flow-7-autonomous-sub-300ms-ai-commerce-desk)
   - [Flow 8: Real-World Asset (RWA) Gold Vault & Perps](#flow-8-real-world-asset-rwa-gold-vault--perps)
   - [Flow 9: Social Commerce (Showdowns & Mento Reviews)](#flow-9-social-commerce-showdowns--mento-reviews)
   - [Flow 10: Next.js Reverse Proxy & Zero-CORS Architecture](#flow-10-nextjs-reverse-proxy--zero-cors-architecture)
4. [Database Architecture & Collections Schema](#4-database-architecture--collections-schema)
5. [Complete API Endpoints Map](#5-complete-api-endpoints-map)
6. [Verification & Test Suites](#6-verification--test-suites)

---

## 1. Platform Overview & Tech Stack

NexusRail is an enterprise-grade multi-rail commerce super-platform featuring native public testnet settlements, immutable double-entry ledgering, and an autonomous AI agent desk.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NEXUSRAIL ECOSYSTEM                           │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Frontend Web App         │ Next.js 15 (React 19), Tailwind CSS,        │
│                          │ Dark/Light Theme Provider, Lucide Icons     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Backend API Gateway      │ Express 4 (Node.js 22 ESM), TypeScript,     │
│                          │ Socket.io, Zod runtime validation           │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Settlement Rails         │ Stellar Horizon (XLM), XRPL Altnet (XRP),   │
│                          │ Stripe (Credit/Debit cards), Pinata IPFS    │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Primary Database         │ MongoDB Atlas M0 (Users, Orders, Ledger,    │
│                          │ Products, Cart, Showdowns, Audit Traces)    │
├──────────────────────────┼─────────────────────────────────────────────┤
│ AI Intelligence Engine   │ Groq API (llama-3.3-70b-versatile) / Gemini │
│                          │ with Function Tool Calling & Atomic Locks   │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Live Deployments         │ Frontend: https://nexus-rail-one.vercel.app │
│                          │ Backend:  https://nexus-rail.onrender.com   │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. Master Feature Matrix

| # | Feature Domain | Key Capabilities | Code Reference |
|---|---|---|---|
| **1** | **Authentication** | Email/Password with `scrypt` hashing & unique salt, HMAC-SHA256 JWT sessions, Web3 wallet nonce signing, Google OAuth exchange | `apps/api/src/services/auth.ts`<br>`apps/api/src/routes/auth.ts` |
| **2** | **Storefront & Catalog** | Live product catalog from MongoDB, atomic upvoting, search bar with embedded WebP branding, category filtering | `apps/api/src/routes/products.ts`<br>`apps/web/src/app/store/page.tsx` |
| **3** | **Tamper-Proof Orders** | Backend-enforced unit pricing, unique order IDs (`NR-XXXXXXXX`), atomic cart operations | `apps/api/src/routes/orders.ts`<br>`apps/api/src/routes/cart.ts` |
| **4** | **Stellar Settlement** | Direct Horizon testnet integration, alphanumeric memo matching, payment envelope decoding, sequence validation | `apps/api/src/services/crypto/stellarProvider.ts` |
| **5** | **XRPL Settlement** | Persistent WebSocket RPC connection, 32-bit Destination Tag matching, `tesSUCCESS` validation | `apps/api/src/services/crypto/xrplProvider.ts` |
| **6** | **Stripe Checkout** | Hosted Stripe Checkout sessions, asynchronous webhook handler, automatic order status update | `apps/api/src/services/stripe.ts`<br>`apps/api/src/routes/checkout.ts` |
| **7** | **Double-Entry Ledger** | Immutable debit/credit journal entries (`customer_escrow` & `merchant_settlement`), overdraft protection | `apps/api/src/services/wallet.ts`<br>`apps/api/src/routes/wallet.ts` |
| **8** | **Sub-300ms AI Desk** | LLM agent tool calling (`findProducts`, `prepareCheckout`, `checkLedgerStatus`), 5-min TTL proposal locks | `apps/api/src/agent/toolRegistry.ts`<br>`apps/api/src/agent/proposalLock.ts` |
| **9** | **RWA Gold Vault** | Live gold oracle quotes, fractional `nGOLD` minting simulation, 2x-5x perpetual futures trading | `apps/api/src/routes/rwa/`<br>`apps/web/src/app/rwa/page.tsx` |
| **10** | **Social Commerce** | Community product showdowns with voting, Mento verified reviews, real-time activity explorer | `apps/api/src/routes/showdowns.ts`<br>`apps/web/src/app/activity/page.tsx` |
| **11** | **Theme & UI** | Dark & Light modes with persistent `localStorage`, CSS variable tokens, portfolio keyframe animations | `apps/web/src/components/ThemeProvider.tsx`<br>`apps/web/src/app/globals.css` |
| **12** | **Reverse Proxy** | Edge API route forwarding `/api/v1/*` to Render, eliminating browser CORS mismatches | `apps/web/src/app/api/v1/[...path]/route.ts` |

---

## 3. End-to-End System & User Flows

### Flow 1: User Authentication & Identity

Users can authenticate via traditional credentials, Web3 wallet nonces, or Google OAuth.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Web App
    participant Proxy as Next.js API Proxy
    participant API as Express API Server
    participant DB as MongoDB Atlas

    User->>Web: Enters Email & Password
    Web->>Proxy: POST /api/v1/auth/register or /login
    Proxy->>API: Forwards request to Render API
    API->>DB: Query users collection by email
    alt Registration Flow
        API->>API: Generate random salt & hash password using scrypt
        API->>DB: Insert new user { email, passwordHash, salt, role: "user" }
    else Login Flow
        API->>API: Derive hash with stored salt & timingSafeEqual check
    end
    API->>API: Sign JWT with HMAC-SHA256 (sub: userId, email, role)
    API-->>Proxy: Return { success: true, token, user }
    Proxy-->>Web: Store token in localStorage / cookies
    Web-->>User: Redirect to Store / Dashboard
```

---

### Flow 2: Product Discovery & Dynamic Catalog

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Storefront
    participant API as Express API Server
    participant Rates as CoinGecko / Market Service
    participant DB as MongoDB Atlas

    User->>Web: Opens /store (views catalog & enters search)
    Web->>API: GET /api/v1/products?category=...&search=...
    API->>DB: Query products collection
    DB-->>API: Return product documents
    Web->>API: GET /api/v1/crypto/rails (Fetch XLM & XRP live exchange rates)
    API->>Rates: Check 60s memory cache or fetch CoinGecko API
    Rates-->>API: Return XLM/USD and XRP/USD rates
    API-->>Web: Return products with live dual-rail converted amounts
    Web-->>User: Renders product cards with USD, XLM, and XRP badges
```

---

### Flow 3: Tamper-Proof Cart & Order Lifecycle

Client-side price tampering is completely prevented. Product prices are strictly resolved server-side.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Web App
    participant API as Express API Server
    participant DB as MongoDB Atlas

    User->>Web: Clicks "Add to Cart"
    Web->>API: POST /api/v1/cart { productId, quantity }
    API->>DB: Upsert in cart_items collection
    User->>Web: Clicks "Proceed to Checkout"
    Web->>API: POST /api/v1/orders { items: [{ productId, quantity }] }
    Note over API: Security Rule: Client-supplied prices are discarded!
    API->>DB: Fetch official unit_price_cents from products collection
    API->>API: Calculate total_cents = sum(unit_price_cents * quantity)
    API->>API: Generate Order ID: "NR-" + 8-char crypto hex
    API->>DB: Insert order document { status: "pending", total_cents, items, rail: null }
    API-->>Web: Return { success: true, order: { id, orderNumber, totalCents } }
    Web-->>User: Redirect to /checkout?orderId=...
```

---

### Flow 4: Native Multi-Rail Web3 Crypto Settlement (Stellar & XRPL)

NexusRail executes direct on-chain verification against public testnets.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Checkout UI
    participant API as Express API Server
    participant ChainReg as ChainProviderRegistry
    participant Stellar as Stellar Horizon Testnet
    participant XRPL as XRPL Altnet Node
    participant DB as MongoDB Atlas
    participant IPFS as Pinata IPFS

    User->>Web: Selects Payment Rail (Stellar or XRPL)
    Web->>API: POST /api/v1/checkout/:chain/create-invoice { orderId }
    API->>ChainReg: Resolve provider (Stellar or XRPL)
    
    alt Stellar Horizon Rail
        ChainReg->>API: Generate invoice with Merchant G-Address & alphanumeric memo
    else XRPL Altnet Rail
        ChainReg->>API: Generate invoice with Merchant r-Address & 32-bit DestinationTag
    end

    API-->>Web: Return invoice details (Deposit address, exact crypto amount, Memo / Tag)
    Web-->>User: Display payment QR code, address, and block explorer link

    Note over User,Web: User sends transaction via Freighter / GemWallet / Testnet Faucet
    
    User->>Web: Submits Transaction Hash (txHash)
    Web->>API: POST /api/v1/checkout/:chain/verify-payment { orderId, txHash }
    
    alt Stellar Verification
        API->>Stellar: GET /transactions/{txHash} & verify memo matches order
    else XRPL Verification
        API->>XRPL: tx command via WebSocket & verify DestinationTag + tesSUCCESS
    end

    API->>DB: Update order status to "paid", record txHash & paymentRail
    API->>API: Trigger Double-Entry Ledger credit
    API->>IPFS: Upload order receipt JSON and retrieve IPFS CID
    API->>DB: Save IPFS CID to order document
    API-->>Web: Return { verified: true, orderStatus: "paid", ipfsHash }
    Web-->>User: Show verified green receipt screen with IPFS receipt gateway link
```

---

### Flow 5: Traditional Card Checkout (Stripe Gateway)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Web App
    participant API as Express API Server
    participant Stripe as Stripe Gateway
    participant DB as MongoDB Atlas

    User->>Web: Chooses "Pay with Card (Stripe)"
    Web->>API: POST /api/v1/checkout/session { orderId }
    API->>DB: Fetch order details & items
    API->>Stripe: stripe.checkout.sessions.create({ line_items, metadata: { orderId } })
    Stripe-->>API: Return Checkout Session URL
    API-->>Web: Return { sessionUrl }
    Web-->>User: Redirect or open Stripe modal
    User->>Stripe: Submits card details & confirms payment
    Stripe->>API: Webhook POST /api/v1/webhooks/stripe (event: checkout.session.completed)
    API->>API: Verify Stripe webhook signature with STRIPE_WEBHOOK_SECRET
    API->>DB: Update order status to "paid" & trigger wallet ledger credit
    Stripe-->>Web: Redirects user to /receipt?orderId=...
    Web-->>User: Show paid receipt confirmation
```

---

### Flow 6: Double-Entry Ledger Bookkeeping

Every transaction is balanced in MongoDB collection `wallet_ledger` to guarantee mathematical integrity.

```
       DEPOSIT / ORDER PAYMENT
                │
                ▼
   ┌──────────────────────────┐
   │      Double-Entry        │
   │      Ledger Engine       │
   └────────────┬─────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
 ┌───────────┐     ┌───────────┐
 │   DEBIT   │     │  CREDIT   │
 │  Account: │     │  Account: │
 │  Customer │     │ Merchant  │
 │  Escrow   │     │Settlement │
 └───────────┘     └───────────┘
```

1. **Strict Immutability**: Ledger documents are write-only. Adjustments occur through offsetting reversal entries.
2. **Multi-Asset Support**: Individual sub-ledgers for `USD` (cents), `XLM` (stroops), and `XRP` (drops).
3. **Overdraft Protection**: A user's available balance is calculated before debiting; operations that exceed available funds are rejected with HTTP 400.

---

### Flow 7: Autonomous Sub-300ms AI Commerce Desk

The AI Commerce Desk uses LLMs with function tool-calling and atomic locks.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as AgentDeskPanel (Web)
    participant API as Express API (/api/v1/agent)
    participant Lock as ProposalLockManager
    participant Groq as Groq / Gemini LLM
    participant DB as MongoDB Atlas

    User->>UI: "Find me security keys under $100 and add 1 to my cart"
    UI->>API: POST /api/v1/agent/chat { prompt, sessionId }
    API->>Groq: Chat completion with tool declarations (findProducts, prepareCheckout)
    Groq-->>API: Function Call: findProducts({ category: "hardware", maxPrice: 100 })
    API->>DB: Query products matching criteria
    API->>Groq: Return tool output to LLM
    Groq-->>API: Function Call: prepareCheckout({ productId: "...", quantity: 1 })
    API->>Lock: Acquire 5-minute atomic proposal lock in proposals collection
    Lock-->>API: Lock granted { proposalId, expiresAt }
    API-->>UI: "I found the XRPL Security Module ($89). Would you like to confirm purchase?"
    User->>UI: Clicks "Confirm Proposal"
    UI->>API: POST /api/v1/agent/propose/confirm { proposalId }
    API->>Lock: Verify and consume proposal lock (single-use)
    API->>DB: Create confirmed order in orders collection
    API-->>UI: "Order NR-94A2B1 confirmed! Proceeding to payment..."
```

---

### Flow 8: Real-World Asset (RWA) Gold Vault & Perps

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js RWA Portal (/rwa)
    participant API as Express API Server
    participant Oracle as Commodity Oracle Service
    participant DB as MongoDB Atlas

    User->>Web: Opens /rwa (Gold Vault Dashboard)
    Web->>API: GET /api/v1/rwa/gold/quote
    API->>Oracle: Fetch spot gold rate per gram
    Oracle-->>API: Returns gold rate ($85.40/g)
    API-->>Web: Return live quote, proof-of-reserve, and vault backing data
    User->>Web: Enters buy amount: 10g of tokenized nGOLD
    Web->>API: POST /api/v1/rwa/gold/mint { grams: 10, paymentRail: "stellar" }
    API->>DB: Record nGOLD mint order and vault collateral entry
    API-->>Web: Return mint transaction confirmation
    User->>Web: Navigates to /rwa/perps (Opens 2x-5x Leveraged Long position)
    Web->>API: POST /api/v1/rwa/perps/open { asset: "GOLD", leverage: 3, marginUsd: 100 }
    API->>DB: Record perpetual contract position with liquidation price
    API-->>Web: Return active position tracker
```

---

### Flow 9: Social Commerce (Showdowns & Mento Reviews)

- **Product Showdowns (`/api/v1/showdowns`)**: Head-to-head community battles (e.g., "Hardware Security Key vs Biometric Dongle"). Users cast atomic upvotes recorded via MongoDB `$inc`.
- **Mento Verified Reviews (`/api/v1/reviews`)**: Only users with confirmed, paid orders for a product can leave a verified review. Reviews include rating, comment, and verified on-chain badge.
- **On-Chain Activity Explorer (`/activity`)**: A public timeline of settled invoices, confirmed block hashes, and IPFS receipt CIDs.

---

### Flow 10: Next.js Reverse Proxy & Zero-CORS Architecture

To eliminate CORS issues, browser origin mismatches, and third-party tracking:

```
[Browser Client]
       │
       ▼  GET/POST https://nexus-rail-one.vercel.app/api/v1/orders
┌────────────────────────────────────────────────────────┐
│ Next.js App Router Catch-all Route Handler             │
│ (apps/web/src/app/api/v1/[...path]/route.ts)          │
│                                                        │
│ 1. Rewrites target to API_SERVER_URL + /api/v1/{path}  │
│ 2. Strips browser origin & host headers                │
│ 3. Forwards authorization & payload to upstream Render │
│ 4. Pipes back upstream response & content headers      │
└────────────────────────────────────────────────────────┘
       │
       ▼  POST https://nexus-rail.onrender.com/api/v1/orders
[Express Backend Server]
```

---

## 4. Database Architecture & Collections Schema

MongoDB Atlas `nexusrail` database collections:

### 1. `users`
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "scrypt:salt:hash...",
  "role": "user | admin",
  "walletAddress": "G... | r...",
  "createdAt": "ISODate"
}
```
*Indexes: `{ email: 1 }` (unique), `{ walletAddress: 1 }` (sparse unique)*

### 2. `products`
```json
{
  "_id": "ObjectId",
  "title": "XRPL Hardware Validator Key",
  "slug": "xrpl-validator-key",
  "category": "hardware",
  "description": "Secure cryptographic signer...",
  "price_cents": 8900,
  "inventory": 42,
  "upvotes_count": 15,
  "createdAt": "ISODate"
}
```
*Indexes: `{ slug: 1 }` (unique), `{ category: 1 }`*

### 3. `orders`
```json
{
  "_id": "ObjectId",
  "orderNumber": "NR-B84A102F",
  "userId": "ObjectId",
  "total_cents": 8900,
  "status": "pending | paid | cancelled",
  "paymentRail": "stellar | xrpl | stripe",
  "txHash": "0x... / 4A2B...",
  "ipfsHash": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  "items": [
    {
      "productId": "ObjectId",
      "title": "XRPL Hardware Validator Key",
      "quantity": 1,
      "unit_price_cents": 8900
    }
  ],
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```
*Indexes: `{ orderNumber: 1 }` (unique), `{ userId: 1 }`, `{ status: 1 }`*

### 4. `wallet_ledger`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "orderId": "ObjectId",
  "type": "credit | debit",
  "account": "customer_escrow | merchant_settlement",
  "currency": "USD | XLM | XRP",
  "amount": 8900,
  "description": "Order NR-B84A102F settlement",
  "createdAt": "ISODate"
}
```
*Indexes: `{ userId: 1 }`, `{ account: 1 }`, `{ orderId: 1 }`*

### 5. `proposals`
```json
{
  "_id": "ObjectId",
  "proposalId": "prop_9f2a01",
  "userId": "ObjectId",
  "action": "cart_checkout",
  "payload": { "productId": "...", "quantity": 1 },
  "status": "active | consumed | expired",
  "createdAt": "ISODate",
  "expiresAt": "ISODate"
}
```
*Indexes: `{ proposalId: 1 }` (unique), `{ expiresAt: 1 }` (TTL: 300 seconds)*

---

## 5. Complete API Endpoints Map

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/health` | Server uptime & status check | No |
| `POST` | `/api/v1/auth/register` | Register new user | No |
| `POST` | `/api/v1/auth/login` | Login with email & password | No |
| `POST` | `/api/v1/auth/google` | Exchange Google OAuth credential | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated profile | Yes (Bearer) |
| `GET` | `/api/v1/products` | Query products catalog | No |
| `GET` | `/api/v1/products/:id` | Fetch product details | No |
| `POST` | `/api/v1/products/:id/upvote` | Atomic upvote | Yes (Bearer) |
| `GET` | `/api/v1/cart` | Get current user cart items | Yes (Bearer) |
| `POST` | `/api/v1/cart` | Add product to cart | Yes (Bearer) |
| `DELETE` | `/api/v1/cart/:id` | Remove product from cart | Yes (Bearer) |
| `POST` | `/api/v1/orders` | Create tamper-proof order | Yes (Bearer) |
| `GET` | `/api/v1/orders` | Fetch user order history | Yes (Bearer) |
| `GET` | `/api/v1/orders/:id` | Fetch specific order details | Yes (Bearer) |
| `POST` | `/api/v1/checkout/session` | Create Stripe checkout session | Yes (Bearer) |
| `POST` | `/api/v1/checkout/:chain/create-invoice` | Generate Web3 payment invoice | Yes (Bearer) |
| `POST` | `/api/v1/checkout/:chain/verify-payment` | Verify on-chain payment & settle | Yes (Bearer) |
| `GET` | `/api/v1/crypto/rails` | List active payment rails & rates | No |
| `POST` | `/api/v1/webhooks/stripe` | Stripe asynchronous fulfillment | Webhook Sig |
| `GET` | `/api/v1/wallet/balance` | Query double-entry balance | Yes (Bearer) |
| `GET` | `/api/v1/wallet/transactions` | Query ledger entries | Yes (Bearer) |
| `POST` | `/api/v1/agent/chat` | Send conversational prompt to AI | Yes (Bearer) |
| `POST` | `/api/v1/agent/propose/confirm` | Confirm & execute AI proposal lock | Yes (Bearer) |
| `GET` | `/api/v1/rwa/gold/quote` | Live spot gold oracle price | No |
| `POST` | `/api/v1/rwa/gold/mint` | Simulate tokenized gold minting | Yes (Bearer) |
| `GET` | `/api/v1/showdowns` | List community product showdowns | No |
| `POST` | `/api/v1/showdowns/:id/vote` | Cast vote on showdown | Yes (Bearer) |

---

## 6. Verification & Test Suites

The codebase includes automated test suites in `scripts/`:

```bash
# 1. Test Phase 1: MongoDB & Authentication Engine
node scripts/test-phase1-auth.mjs

# 2. Test Phase 2: Catalog, Upvotes & Social Commerce
node scripts/test-phase2-products.mjs

# 3. Test Phase 3: Cart & Tamper-Proof Order Pricing
node scripts/test-phase3-cart-orders.mjs

# 4. Test Phase 4: Multi-Chain Stellar & XRPL Testnet Settlements
node scripts/test-phase4-multichain.mjs

# 5. Test Phase 5: Double-Entry Wallet Ledger & AI Agent Locks
node scripts/test-phase5-ledger-agent.mjs

# 6. Master End-to-End Suite (Validates all 33 criteria across the full platform)
node scripts/verify-master-flow.mjs
```

---

## 📌 Summary Reference Map

| What you need | Where to look |
|---|---|
| Complete Step-by-Step Architecture & Blueprint | [`docs/NEXUSRAIL_PRODUCTION_BLUEPRINT.md`](./NEXUSRAIL_PRODUCTION_BLUEPRINT.md) |
| All Features, User & System Flows with Diagrams | [`docs/COMPLETE_FEATURES_AND_FLOW_GUIDE.md`](./COMPLETE_FEATURES_AND_FLOW_GUIDE.md) |
| Combined Super-Platform Architecture | [`docs/MASTER_COMBINED_ARCHITECTURE.md`](./MASTER_COMBINED_ARCHITECTURE.md) |
| RWA Gold & Perpetual Protocol Spec | [`docs/RWA_COMMODITY_MASTER_PLAN.md`](./RWA_COMMODITY_MASTER_PLAN.md) |
| 35-Day Implementation Roadmap | [`sprints/README.md`](../sprints/README.md) |
| Monorepo Root Overview | [`README.md`](../README.md) |
| Frontend Web Client Docs | [`apps/web/README.md`](../apps/web/README.md) |
| Backend API Engine Docs | [`apps/api/README.md`](../apps/api/README.md) |
