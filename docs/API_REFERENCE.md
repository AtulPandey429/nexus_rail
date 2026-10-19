# 📡 NexusRail — Complete API Reference

**Base Production URL:** `https://nexus-rail.onrender.com`  
**Proxied Frontend Base URL:** `https://nexus-rail-one.vercel.app/api/v1`  
**API Version:** `v1`  
**Authentication Scheme:** Bearer JWT in `Authorization` header (`Authorization: Bearer <token>`)  

---

## 📑 Table of Contents
1. [System & Health Endpoints](#1-system--health-endpoints)
2. [Authentication (`/api/v1/auth`)](#2-authentication-apiv1auth)
3. [Product Catalog (`/api/v1/products`)](#3-product-catalog-apiv1products)
4. [Shopping Cart (`/api/v1/cart`)](#4-shopping-cart-apiv1cart)
5. [Orders (`/api/v1/orders`)](#5-orders-apiv1orders)
6. [Multi-Rail Checkout (`/api/v1/checkout`)](#6-multi-rail-checkout-apiv1checkout)
7. [Crypto Providers & Rates (`/api/v1/crypto`)](#7-crypto-providers--rates-apiv1crypto)
8. [Wallet & Ledger (`/api/v1/wallet`)](#8-wallet--ledger-apiv1wallet)
9. [AI Agent Desk (`/api/v1/agent`)](#9-ai-agent-desk-apiv1agent)
10. [Community Showdowns (`/api/v1/showdowns`)](#10-community-showdowns-apiv1showdowns)
11. [Analytics & Admin (`/api/v1/analytics`, `/api/v1/admin`)](#11-analytics--admin-apiv1analytics-apiv1admin)
12. [Webhooks (`/api/v1/webhooks`)](#12-webhooks-apiv1webhooks)
13. [Commodities & RWA (`/api/v1/rwa`, `/api/v1/rwa-modular`)](#13-commodities--rwa-apiv1rwa-apiv1rwa-modular)
14. [SuperPlatform Stubs (`/api/v1/superplatform`)](#14-superplatform-stubs-apiv1superplatform)

---

## 1. System & Health Endpoints

### `GET /health`
- **Status:** Production-verified
- **Auth:** None
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "nexusrail-api",
    "uptimeSeconds": 1420
  }
  ```

### `GET /api/v1/health`
- **Status:** Production-verified
- **Auth:** None
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "nexusrail-api",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "timestamp": "2026-10-20T11:00:00.000Z"
  }
  ```

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **Status:** Production-verified
- **Auth:** None
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Validation:** `email` string, `password` min 8 characters.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "user": {
      "id": "c88f1234-abcd-...",
      "email": "user@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "success": false, "error": "An account with this email already exists" }`

### `POST /api/v1/auth/login`
- **Status:** Production-verified
- **Auth:** None
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (200):** Same format as register.
- **Error Response (401):** `{ "success": false, "error": "Invalid email or password" }`

### `GET /api/v1/auth/me`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):**
  ```json
  {
    "success": true,
    "user": {
      "id": "c88f1234-abcd-...",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```

### `POST /api/v1/auth/nonce`
- **Status:** Tested
- **Auth:** None
- **Request Body:** `{ "walletAddress": "0x71C... / G... / r..." }`
- **Response (200):**
  ```json
  {
    "success": true,
    "nonce": "Sign in to NexusRail\n9a8f2b..."
  }
  ```

### `POST /api/v1/auth/verify-signature`
- **Status:** Tested
- **Auth:** None
- **Request Body:**
  ```json
  {
    "walletAddress": "0x71C...",
    "signature": "0xabc...",
    "nonce": "Sign in to NexusRail\n9a8f2b..."
  }
  ```
- **Response (200):** `{ "success": true, "user": {...}, "token": "..." }`

### `POST /api/v1/auth/google`
- **Status:** Production-verified
- **Auth:** None
- **Request Body:**
  ```json
  {
    "credential": "eyJhbGciOiJSUzI1NiIs...",
    "email": "user@gmail.com",
    "name": "Jane Doe",
    "googleId": "10492810..."
  }
  ```
- **Response (200):** `{ "success": true, "token": "...", "user": {...}, "message": "Welcome, Jane Doe!" }`

### `POST /api/v1/auth/logout`
- **Status:** Implemented
- **Auth:** None
- **Response (200):** `{ "success": true, "message": "Signed out" }`

---

## 3. Product Catalog (`/api/v1/products`)

### `GET /api/v1/products`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):**
  ```json
  {
    "success": true,
    "cached": false,
    "count": 10,
    "data": [
      {
        "id": "prod_rail_one_01",
        "sku": "RAIL-ONE",
        "title": "Rail One",
        "description": "Self-custody, beautifully offline...",
        "price_cents": 12900,
        "category": "hardware",
        "stock_quantity": 45,
        "active": true,
        "upvotes_count": 248,
        "rail": "stellar",
        "tag": "Flagship Hardware",
        "rating": 4.9,
        "created_at": "2026-10-18T00:00:00.000Z"
      }
    ]
  }
  ```

### `GET /api/v1/products/:sku`
- **Status:** Implemented
- **Auth:** None
- **Response (200):** `{ "success": true, "data": { ...product } }`
- **Error (404):** `{ "success": false, "error": "Product not found" }`

### `GET /api/v1/products/leaderboard`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):** Returns all active products sorted descending by `upvotes_count`.

### `POST /api/v1/products/:id/upvote`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):**
  ```json
  {
    "success": true,
    "upvotes_count": 249
  }
  ```

### `GET /api/v1/products/:id/reviews`
- **Status:** Implemented
- **Auth:** None
- **Response (200):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "rev_123",
        "product_id": "prod_rail_one_01",
        "sku": "RAIL-ONE",
        "user_id": "usr_...",
        "rating": 5,
        "comment": "Exceptional build quality.",
        "verified_purchase": true,
        "created_at": "2026-10-18T12:00:00.000Z"
      }
    ]
  }
  ```

### `POST /api/v1/products/:id/reviews`
- **Status:** Implemented
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "rating": 5, "comment": "Great product!" }`
- **Validation:** `rating` between 1 and 5; `comment` min 5 characters.
- **Behavior:** Checks MongoDB `orders` collection for matching paid order to set `verified_purchase: true`.

---

## 4. Shopping Cart (`/api/v1/cart`)

### `GET /api/v1/cart`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "sku": "RAIL-ONE", "qty": 1 }
      ]
    }
  }
  ```

### `PUT /api/v1/cart/items`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "sku": "RAIL-ONE", "qty": 2 }`
- **Behavior:** If `qty <= 0`, removes item. Otherwise, updates or inserts.
- **Response (200):** Returns updated cart `{ "success": true, "data": { "items": [...] } }`.

### `DELETE /api/v1/cart/items/:sku`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):** Returns updated cart `{ "success": true, "data": { "items": [...] } }`.

---

## 5. Orders (`/api/v1/orders`)

### `POST /api/v1/orders`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Request Body:**
  ```json
  {
    "items": [
      { "sku": "RAIL-ONE", "qty": 1 }
    ],
    "rail": "STELLAR",
    "fromCart": true
  }
  ```
- **Pricing Security:** Client-supplied prices are strictly ignored. Unit price is queried from the verified MongoDB catalog.
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "order": {
        "id": "e9b2184a-...",
        "orderNumber": "NR-4A2B9F01",
        "status": "PENDING",
        "totalCents": 12900,
        "rail": "STELLAR",
        "createdAt": "2026-10-20T11:00:00.000Z",
        "items": [
          {
            "sku": "RAIL-ONE",
            "title": "Rail One",
            "qty": 1,
            "unit_price_cents": 12900
          }
        ]
      }
    }
  }
  ```

### `GET /api/v1/orders`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):** Returns array of user's orders sorted descending by `created_at`.

### `GET /api/v1/orders/:id`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Path Param:** `id` can be either the UUID `id` or the `orderNumber` (`NR-XXXXXXXX`).

---

## 6. Multi-Rail Checkout (`/api/v1/checkout`)

### `POST /api/v1/checkout/:chain/create-invoice`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Path Param:** `:chain` must be `stellar` or `xrpl`.
- **Request Body:** `{ "orderId": "e9b2184a-..." }`
- **Response (200) for Stellar:**
  ```json
  {
    "success": true,
    "invoice": {
      "orderId": "e9b2184a-...",
      "chain": "stellar",
      "network": "testnet",
      "recipientAddress": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
      "destination": "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR",
      "paymentIdentifierType": "memo_text",
      "paymentIdentifier": "NR1D7B7A36B3E1C74101ACD26806",
      "memo": "NR1D7B7A36B3E1C74101ACD26806",
      "memoType": "text",
      "amountAsset": 725.534308,
      "amountXlm": "725.534308",
      "assetSymbol": "XLM",
      "amountUsdCents": 12900,
      "fxRateUsd": 0.1778,
      "qrPayload": "stellar:pay?destination=GAIH...&amount=725.534308&memo=NR1D..."
    }
  }
  ```
- **Response (200) for XRPL:**
  ```json
  {
    "success": true,
    "invoice": {
      "orderId": "e9b2184a-...",
      "chain": "xrpl",
      "network": "testnet",
      "recipientAddress": "rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW",
      "destination": "rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW",
      "paymentIdentifierType": "destination_tag",
      "paymentIdentifier": 1346357161,
      "destinationTag": 1346357161,
      "amountAsset": 99.444958,
      "amountXrp": 99.444958,
      "assetSymbol": "XRP",
      "amountUsdCents": 12900,
      "fxRateUsd": 1.2972,
      "qrPayload": "xrpl:rp4Q...?amount=99444958&dt=1346357161"
    }
  }
  ```

### `POST /api/v1/checkout/:chain/verify-payment`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Path Param:** `:chain` (`stellar` or `xrpl`).
- **Request Body:**
  ```json
  {
    "orderId": "e9b2184a-...",
    "txHash": "4A2B8C..."
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "verified": true,
      "txHash": "4A2B8C...",
      "amountDelivered": 725.534308,
      "assetSymbol": "XLM",
      "network": "testnet"
    },
    "orderStatus": "PAID"
  }
  ```

### `POST /api/v1/checkout/stellar/prepare-xdr`
- **Status:** Implemented
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "orderId": "...", "sourcePublicKey": "G..." }`
- **Response (200):** Returns unsigned Stellar transaction XDR for Freighter signing.

### `POST /api/v1/checkout/stellar/submit-xdr`
- **Status:** Implemented
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "signedXdr": "AAAA..." }`
- **Response (200):** `{ "success": true, "txHash": "...", "ledger": 12345, "successful": true }`

### `POST /api/v1/checkout/stripe/create-session`
- **Status:** Implemented
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "clientUrl": "https://..." }` (optional)
- **Response (200):** `{ "success": true, "data": { "sessionId": "cs_...", "url": "https://checkout.stripe.com/..." } }`

### `GET /api/v1/checkout/orders/:orderId/ipfs-receipt`
- **Status:** Implemented
- **Auth:** Required (`Bearer <token>`)
- **Response (200):**
  ```json
  {
    "success": true,
    "receipt": {
      "orderId": "e9b2184a-...",
      "ipfsHash": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      "gatewayUrl": "https://gateway.pinata.cloud/ipfs/QmXoyp..."
    }
  }
  ```

---

## 7. Crypto Providers & Rates (`/api/v1/crypto`)

### `GET /api/v1/crypto/rates`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "usd": 1,
      "xrpUsd": 1.2972,
      "xlmUsd": 0.1778,
      "source": "coingecko",
      "fromCache": false,
      "fetchedAt": "2026-10-20T11:00:00.000Z"
    }
  }
  ```

### `GET /api/v1/crypto/providers`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):** Returns list of registered chains (`stellar`, `xrpl`), vault balances, and network (`testnet`).

### `GET /api/v1/crypto/balance/:chain`
- **Status:** Production-verified
- **Auth:** None
- **Query Param:** `?address=G...` or `?address=r...` (defaults to merchant vault).

---

## 8. Wallet & Ledger (`/api/v1/wallet`)

### `GET /api/v1/wallet/balance`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):**
  ```json
  {
    "success": true,
    "balance": {
      "USD": 5000,
      "XRP": 0,
      "XLM": 0
    }
  }
  ```

### `GET /api/v1/wallet/transactions`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Response (200):**
  ```json
  {
    "success": true,
    "transactions": [
      {
        "id": "tx_123",
        "user_id": "usr_...",
        "currency": "USD",
        "amount_cents": 5000,
        "type": "CREDIT",
        "reference_id": "deposit",
        "balance_after": 5000,
        "created_at": "2026-10-20T11:00:00.000Z"
      }
    ]
  }
  ```

### `POST /api/v1/wallet/topup`
- **Status:** Implemented (Policy Guard)
- **Auth:** Required
- **Response (400):** `{ "success": false, "error": "Wallet credits are recorded only after a confirmed provider payment. This route does not mint a balance." }`

---

## 9. AI Agent Desk (`/api/v1/agent`)

### `POST /api/v1/agent/chat`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "message": "Find hardware wallets" }`
- **Success Response (200):**
  ```json
  {
    "success": true,
    "reply": "I recommend the Rail One ($129.00) or the XRPL Starter Validator Kit ($499.00).",
    "latencyMs": 142
  }
  ```
- **Purchase Intent Response (200):** If user asks to buy with sufficient balance:
  ```json
  {
    "success": true,
    "reply": "Confirm purchase of Rail One for $129.00 USD from your internal wallet balance.",
    "proposal": {
      "proposalId": "prop_9f2a01...",
      "userId": "usr_...",
      "action": "PURCHASE_ORDER",
      "payload": {
        "sku": "RAIL-ONE",
        "title": "Rail One",
        "priceCents": 12900,
        "paymentRail": "WALLET"
      },
      "status": "PROPOSED",
      "expiresAt": "2026-10-20T11:05:00.000Z"
    }
  }
  ```

### `POST /api/v1/agent/confirm`
- **Status:** Production-verified
- **Auth:** Required (`Bearer <token>`)
- **Request Body:** `{ "proposalId": "prop_9f2a01..." }`
- **Behavior:** Consumes proposal lock atomically, debits wallet balance, inserts confirmed paid order.
- **Response (200):** `{ "success": true, "message": "Proposal authorized and executed successfully!", "order": {...}, "transaction": {...} }`

---

## 10. Community Showdowns (`/api/v1/showdowns`)

### `GET /api/v1/showdowns`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):** Returns array of active showdown cards with `item_a_sku`, `item_b_sku`, `votes_a`, `votes_b`.

### `POST /api/v1/showdowns/:id/vote`
- **Status:** Production-verified
- **Auth:** None
- **Request Body:** `{ "choice": "A" }` or `{ "choice": "B" }`
- **Response (200):** Returns updated showdown document with incremented vote count.

---

## 11. Analytics & Admin (`/api/v1/analytics`, `/api/v1/admin`)

### `GET /api/v1/analytics/summary`
- **Status:** Production-verified
- **Auth:** None
- **Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "totalRevenueCents": 17940,
      "totalOrders": 4,
      "railBreakdown": { "STELLAR": 2, "XRPL": 1, "STRIPE": 1 },
      "averageOrderValueCents": 4485,
      "timestamp": "2026-10-20T11:00:00.000Z"
    }
  }
  ```

### `GET /api/v1/admin/stats`
- **Status:** Implemented
- **Auth:** Required (`role: "admin"`)
- **Response (200):** `{ "success": true, "data": { "totalVolumeCents": ..., "totalOrdersCount": ..., "productsCount": 10, "usersCount": ... } }`

### `GET /api/v1/admin/orders`
- **Status:** Implemented
- **Auth:** Required (`role: "admin"`)
- **Response (200):** Full list of all orders across all users with settlement status.

### `PATCH /api/v1/admin/orders/:id`
- **Status:** Implemented
- **Auth:** Required (`role: "admin"`)
- **Request Body:** `{ "status": "FULFILLING" }`
- **State Machine Guard:** Enforces valid order transitions (`PENDING` -> `PAID` -> `FULFILLING` -> `FULFILLED`).

---

## 12. Webhooks (`/api/v1/webhooks`)

### `POST /api/v1/webhooks/stripe`
- **Status:** Implemented
- **Auth:** Stripe Signature verification via `stripe-signature` header.
- **Request:** Raw JSON bytes.
- **Response (200):** `{ "success": true, "received": true, "order": {...} }`

---

## 13. Commodities & RWA (`/api/v1/rwa`, `/api/v1/rwa-modular`)

### `GET /api/v1/rwa/live-prices` & `GET /api/v1/rwa-modular/oracle/rates`
- **Status:** Runtime-verified
- **Auth:** None
- **Response (200):**
  ```json
  {
    "status": "success",
    "success": true,
    "data": {
      "goldUsdPerGram": 88.50,
      "goldInrPerGram": 7420.00,
      "silverUsdPerGram": 1.05,
      "silverInrPerGram": 88.00,
      "source": "coingecko",
      "fromCache": false,
      "fetchedAt": "2026-10-20T11:00:00.000Z"
    }
  }
  ```

### `POST /api/v1/rwa/issue-token` & `POST /api/v1/rwa-modular/tokens/mint`
- **Status:** Planned (501 Stub)
- **Response (501):** `{ "success": false, "error": "Token issuance is not available. A licensed issuer and custody provider are required." }`

### `GET /api/v1/rwa-modular/perps/quote`
- **Status:** Planned (501 Stub)
- **Response (501):** `{ "success": false, "error": "Perpetual quotes are not connected to a provider." }`

---

## 14. SuperPlatform Stubs (`/api/v1/superplatform`)

### `ALL /api/v1/superplatform/*`
- **Status:** Planned (501 Stub)
- **Response (501):** `{ "success": false, "error": "This provider is not connected. Risk scores, UPI, TRON, and perpetuals quotes are not issued by this API." }`
