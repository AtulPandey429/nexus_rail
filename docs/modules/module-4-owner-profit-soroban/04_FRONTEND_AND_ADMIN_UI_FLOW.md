# Module 4 — Frontend Admin Console & On-Chain Withdrawal UI

> **Module:** `M4` Platform Owner Profit Engine, Database Ledger & Stellar Protocol 22 Smart Contract  
> **Target Pages:** `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/profile/page.tsx`  
> **UI Stack:** Next.js 15 App Router, React 19, Tailwind CSS, Lucide Icons

---

## 1. Admin Console Treasury Dashboard Layout (`/admin`)

The Admin console is upgraded from static mock values into an authoritative, real-time command center:

```
┌────────────────────────────────────────────────────────────────────────┐
│  PLATFORM TREASURY & OWNER PROFIT ENGINE                               │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│ TOTAL OWNER NET  │ 24H REVENUE      │ $NR BUYBACK POOL │ ZERO-SUM DIFF │
│ $12,450.80 USD   │ +$842.15 (Today) │ $12,450.80 INJ   │ $0.00 BALANCED│
├──────────────────┴──────────────────┴──────────────────┴───────────────┤
│                                                                        │
│  [ REVENUE ALLOCATION BREAKDOWN ]       [ DYNAMIC FEE CONTROLLER ]     │
│  • Order Routing Fees (52%)            • Order Routing Fee: [ 1.0 % ] │
│  • Swap / Cashout Spreads (36%)        • Swap Spread:       [ 0.5 % ] │
│  • Gas Arbitrage Surplus (8%)          • Cashout Spread:    [ 0.5 % ] │
│  • AI Execution Fees (4%)              • Buyback Share:     [ 50.0 %] │
│                                        [ Save Fee Settings ]           │
├────────────────────────────────────────────────────────────────────────┤
│  STELLAR PROTOCOL 22 SMART CONTRACT & MASTER VAULTS                    │
├───────────────────────────────────────┬────────────────────────────────┤
│  NexusVault Soroban Contract          │  Master Custody Liquidity      │
│  ID: CCB2V...TESTNET (Active)         │  • Stellar Vault: 12,450 XLM   │
│  Protocol: v22 (Stellar RPC Healthy)  │  • XRPL Vault:    4,892 XRP    │
│  WASM: 4f9a32c... (In-Place Upgrade)  │  • $NR Pool USD:  $100,000 USD │
│  [ View on Stellar.Expert ↗ ]         │  [ Deploy / Upgrade WASM ]     │
├────────────────────────────────────────────────────────────────────────┤
│  RECENT REVENUE AUDIT LOG                                              │
│  Time       | Source       | Gross   | Fee/Spread | Owner Profit | $NR│
│  15:02:12   | ORDER        | $120.00 | $1.20      | $0.60        | $0.60
│  14:58:34   | CASHOUT      | $340.00 | $1.70      | $0.85        | $0.85
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Interactive Components

### 2.1 Dynamic Fee Controller Modal & Sliders
- Admin can adjust fee parameters live without touching smart contracts:
  - `Order Fee %` slider (0.0% to 5.0%)
  - `Swap Spread %` slider (0.1% to 2.0%)
  - `Cashout Spread %` slider (0.1% to 2.0%)
  - `$NR Buyback Share %` slider (0% to 100%)
  - `Emergency Pause Contract` switch
- Submits `PATCH /api/v1/admin/treasury/config` with instant toast notification.

### 2.2 Protocol 22 Smart Contract Card
- Displays live Stellar RPC status (`v22+`), RPC latency (ms), and latest ledger height.
- Clickable link to Stellar.Expert explorer.
- "In-Place Upgrade" trigger that opens a modal to submit a new compiled WASM hash without modifying the contract address!

### 2.3 User `$NR` Withdrawal Modal (`/profile` & `/swap`)
- Displays user's available `$NR` balance.
- Input: Destination Stellar Public Address (`G...`).
- 1-Click "Withdraw to Freighter Wallet" action calling `POST /api/v1/crypto/nr/withdraw`.
- Returns on-chain transaction hash with link to testnet explorer.
