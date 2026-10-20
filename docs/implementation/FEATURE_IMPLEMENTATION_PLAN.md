# 📋 NexusRail Feature Implementation Plan

This plan outlines the logical breakdown of implementation tasks, dependencies, and file modifications required for the complete milestone.

---

## 1. Task Breakdown & Dependency Graph

```
Task 1: Design Tokens & CSS System (globals.css, tailwind.config.ts)
  │
  ├─► Task 2: Core Layout Redesign (SiteHeader, SiteFooter, AppShell)
  │     │
  │     ├─► Task 3: Public Pages (Homepage, Store, Cart)
  │     │
  │     ├─► Task 4: Checkout & Order Confirmation (Checkout, Receipt)
  │     │
  │     ├─► Task 5: Swap & RWA Pages (Swap, Activity, Admin)
  │     │
  │     └─► Task 6: Modals & Drawers (WalletConnectModal, AgentDeskPanel)
  │
  └─► Task 7: Multi-Chain Wallet Auth Engine (AuthService, auth routes, wallet adapters)
        │
        ├─► Task 8: AI Agent Tool Handlers (agent routes & services)
        │
        └─► Task 9: End-to-End Local Testing & Verification
```

---

## 2. Detailed Task Specifications

### Task 1: Design System & Color Tokens
* **Files**:
  - `apps/web/tailwind.config.ts`
  - `apps/web/src/app/globals.css`
* **Changes**:
  - Add `nexus-bg`: `#08090C`
  - Add `nexus-surface`: `#111318`
  - Add `nexus-card`: `#171A20`
  - Add `nexus-gold`: `#D4AF37`
  - Add `nexus-gold-bright`: `#F2D675`
  - Add `nexus-text`: `#F8F7F2`
  - Add `nexus-muted`: `#A6A9B2`
  - Add `nexus-border`: `#2B2E36`
  - Define utility classes for gold gradients, gold subtle borders, and accessible high-contrast text.

### Task 2: Navigation & Global Chrome
* **Files**:
  - `apps/web/src/components/SiteHeader.tsx`
  - `apps/web/src/components/SiteFooter.tsx`
  - `apps/web/src/components/AppShell.tsx`
* **Changes**:
  - Style header with `#08090C` background and subtle `#2B2E36` border.
  - Active links highlighted with `#D4AF37` gold bottom indicator and warm text.
  - Remove intrusive "TESTNET / DEMO" badge from consumer header.
  - Re-theme AI Agent floating trigger with black and gold styling.

### Task 3: Storefront & Cart Pages
* **Files**:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/store/page.tsx`
  - `apps/web/src/app/cart/page.tsx`
* **Changes**:
  - Re-skin hero section: clean black & gold fintech typography.
  - Product cards: deep graphite `#171A20` card background, `#2B2E36` borders, gold price tags and primary buttons.
  - Cart table: elegant line items with gold checkout button and subtotal highlights.

### Task 4: Checkout & Official Receipt
* **Files**:
  - `apps/web/src/app/checkout/page.tsx`
  - `apps/web/src/app/receipt/page.tsx`
* **Changes**:
  - Checkout rails: Stellar (XLM), XRPL (XRP), and Stripe styled with gold selection halos.
  - Order review card with exact fee breakdown.
  - Official Receipt: Executive Black & Gold layout, high-res QR code, printable layout with `@media print` rules, vector typography, and on-chain verification links.

### Task 5: Cross-Chain Swap & Admin Console
* **Files**:
  - `apps/web/src/app/swap/page.tsx`
  - `apps/web/src/app/admin/page.tsx`
* **Changes**:
  - Swap: Black & gold swap card with gold invert arrow and rate pill.
  - Admin: Executive metrics dashboard, gold KPI numbers, dark table rows with gold status tags.

### Task 6: Multi-Chain Wallet Challenge-Response Authentication
* **Files**:
  - `apps/api/src/services/auth.ts`
  - `apps/api/src/routes/auth.ts`
  - `apps/web/src/lib/wallets.ts`
  - `apps/web/src/components/WalletConnectModal.tsx`
* **Changes**:
  - Support Ed25519 signature verification for Stellar public keys (`G...`).
  - Support GemWallet sign message verification for XRPL addresses (`r...`).
  - Flow: One-click "Connect Wallet" -> extension prompts -> backend challenge signed -> JWT session stored.

### Task 7: AI Agent Tools
* **Files**:
  - `apps/api/src/routes/agent.ts`
  - `apps/web/src/components/AgentDeskPanel.tsx`
* **Changes**:
  - Add query handlers for order status, product recommendations, and swap rates.
  - Re-theme the AI chat drawer in black and gold.
