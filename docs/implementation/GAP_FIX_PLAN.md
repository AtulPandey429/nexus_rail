# 🛠️ NexusRail Gap Fix Plan

This document establishes the precise step-by-step remediation plan for every gap identified in `AUDIT_FINDINGS.md`.

---

## Phase 1: Security & Chain-Agnostic Web3 Wallet Authentication (P0)

### Task 1.1: Backend Multi-Chain Signature Verification Engine
- **Objective**: Support cryptographic challenge-response authentication for Stellar (Freighter), XRPL (GemWallet), and EVM (MetaMask/Coinbase) without manual public-key typing.
- **Implementation**:
  - Update `apps/api/src/services/auth.ts`:
    - Add `verifyStellarSignature(publicKey, nonce, signature)`: verifies Ed25519 signature using `@stellar/stellar-sdk` `Keypair.fromPublicKey(publicKey).verify(...)`.
    - Add `verifyXrplSignature(address, nonce, signature)`: verifies signature using `xrpl` / `ripple-keypairs` cryptographic verify functions.
    - Keep EVM verification via `ethers.verifyMessage`.
  - Update `apps/api/src/routes/auth.ts`:
    - Accept `chain: 'stellar' | 'xrpl' | 'evm'` in `/api/v1/auth/verify-signature`.
    - Retrieve single-use nonce from `auth_nonces` collection.
    - Atomically consume nonce and issue JWT with user document.
- **Acceptance Criteria**:
  - Valid Stellar signature from Freighter generates JWT for address `G...`.
  - Valid XRPL signature from GemWallet generates JWT for address `r...`.
  - Replay attempts with same nonce fail.
  - Invalid signature returns 401 Unauthorized.

### Task 1.2: Frontend Seamless Wallet Authentication Handshake
- **Objective**: Eliminate manual address typing in `apps/web/src/components/WalletConnectModal.tsx` and `apps/web/src/app/login/page.tsx`.
- **Implementation**:
  - When user clicks "Connect Freighter":
    1. Connects extension via `connectFreighter()`.
    2. Requests challenge from `POST /api/v1/auth/nonce`.
    3. Prompts Freighter to sign challenge (`signFreighterMessage` or transaction memo auth).
    4. Posts signature to `/api/v1/auth/verify-signature`.
    5. Saves session via `saveSession(user, token)` and closes modal.
  - When user clicks "Connect GemWallet":
    1. Obtains address via `gemWallet.getAddress()`.
    2. Requests challenge from `POST /api/v1/auth/nonce`.
    3. Prompts GemWallet `signMessage`.
    4. Posts signature to `/api/v1/auth/verify-signature`.
    5. Saves session and closes modal.

---

## Phase 2: Premium Black & Gold Design System Implementation (P1)

### Task 2.1: Design Tokens in Tailwind & CSS Variables
- **Objective**: Standardize the design tokens across `tailwind.config.ts` and `globals.css`.
- **Palette**:
  - Background: `#08090C` (`nexus-bg`)
  - Secondary Surface: `#111318` (`nexus-surface`)
  - Card: `#171A20` (`nexus-card`)
  - Gold Accent: `#D4AF37` (`nexus-gold`)
  - Bright Gold: `#F2D675` (`nexus-gold-bright`)
  - Primary Text: `#F8F7F2` (`nexus-text`)
  - Secondary Text: `#A6A9B2` (`nexus-muted`)
  - Subtle Border: `#2B2E36` (`nexus-border`)
  - State Colors: Green `#10B981`, Red `#EF4444`, Amber `#F59E0B`
- **Component Styling**:
  - Restrained gold accents on active tabs, primary action buttons, key metrics, and focus rings.
  - Subtle dark graphite cards with fine `#2B2E36` borders.
  - Clean contrast for maximum financial readability.

### Task 2.2: System-Wide Application
Apply tokens to:
1. `SiteHeader.tsx` & `SiteFooter.tsx`: Gold accents on active links, logo, and action buttons.
2. `apps/web/src/app/page.tsx`: Premium Black & Gold hero, feature cards, and typography.
3. `apps/web/src/app/store/page.tsx`: Product cards, filter pills, price highlights in warm gold.
4. `apps/web/src/app/cart/page.tsx`: Order summary, checkout buttons, item badges.
5. `apps/web/src/app/checkout/page.tsx`: Multi-rail payment selectors, transaction review.
6. `apps/web/src/app/swap/page.tsx`: Cross-chain bridge interface with gold routing elements.
7. `apps/web/src/app/admin/page.tsx`: Operator dashboard with gold KPI metrics and tab highlights.
8. `apps/web/src/app/login/page.tsx`: Auth forms with gold primary buttons.
9. `apps/web/src/components/AgentDeskPanel.tsx`: AI chat drawer with gold accents.

---

## Phase 3: Receipt & PDF Overhaul (P1)

### Task 3.1: Executive Black & Gold Receipt Design
- **Objective**: Redesign `/receipt` into a document suitable for official and commercial use.
- **Implementation**:
  - Professional Black & Gold certificate layout with gold borders, watermarked logo, and crisp typography.
  - Clear sections:
    1. Header: Document title, Receipt ID, Verification Status.
    2. Metadata Grid: Issue Date, Payment Method (Stellar XLM / XRPL XRP), Ledger Sequence, Exchange Rate.
    3. Counterparty Info: Customer Account, Merchant Platform Vault.
    4. Line Items Table: Product Title, Description, Quantity, Unit Price, Total.
    5. Financial Summary: Subtotal, Network Fee, Total Amount Paid (USD and Native Crypto).
    6. Cryptographic Proof: Transaction Hash, Ledger Confirmation, Verification QR code.
  - High-res print stylesheet (`@media print`) ensuring 0 clipping, clean margins, vector text, and no unwanted page breaks.

---

## Phase 4: Customer-Facing Network Cleanliness & Backend Safety (P2)

### Task 4.1: Clean Production Presentation
- **Objective**: Remove loud demo badges and banners from ordinary customer-facing screens.
- **Implementation**:
  - Remove "TESTNET / DEMO" badge from `SiteHeader.tsx`.
  - Remove demo banners from `/store` and `/checkout`.
  - Ensure backend strictly defaults to `BLOCKCHAIN_NETWORK=testnet` via `apps/api/src/config/env.ts`.
  - Retain full technical diagnostics and ledger latency counters in `/admin`.

---

## Phase 5: Cart, Checkout & Order History State Reliability (P1)

### Task 5.1: Payment Confirmation Order Pipeline
- **Objective**: Ensure cart is only cleared when payment is verified on-chain, and orders persist reliably.
- **Implementation**:
  - In `apps/web/src/app/checkout/page.tsx`:
    - After wallet signing, call `/api/v1/checkout/stellar/verify-payment` or `/api/v1/checkout/xrpl/verify-payment`.
    - Only upon `verified: true` status call `clearCart()` and route to `/receipt`.
    - Order is immediately queryable in MongoDB and visible on `/activity` and `/app/orders`.

---

## Phase 6: AI Agent Desk Enhancements (P2)

### Task 6.1: Expanded Tool Execution
- **Objective**: Support customer queries for order history, product lookup, and swap rates.
- **Implementation**:
  - Update `apps/api/src/routes/agent.ts`:
    - Handle queries like "Show my orders" by retrieving real orders for `req.user.id`.
    - Handle queries like "What is the price of XRP to XLM" by calling `getFxQuote()`.
    - Handle product search by querying active catalog.
