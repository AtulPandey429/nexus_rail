# Module 4 — Implementation Plan, Verification & Changelog

> **Module:** `M4` Platform Owner Profit Engine, Database Ledger & Stellar Protocol 22 Smart Contract  
> **Status:** Implementation Active  
> **Execution Strategy:** 5-Day Chronological Commits

---

## 1. 5-Day Commit Strategy

| Day | Date | Commit Title & Scope | Files Modified / Added |
| :---: | :---: | :--- | :--- |
| **Day 1** | `2026-11-15` | `docs(m4): add Module 4 living documentation, Protocol 22 math, and database architecture suite` | `docs/modules/module-4-owner-profit-soroban/*`, `docs/modules/README.md` |
| **Day 2** | `2026-11-16` | `feat(m4): introduce platform_treasury, platform_config, platform_contracts schemas and Protocol 22 contract spec` | `backend/src/services/mongo.ts`, `backend/src/types/index.ts`, `frontend/src/types/index.ts`, `contracts/nexus_vault/*` |
| **Day 3** | `2026-11-17` | `feat(m4): implement TreasuryService with 50/50 profit split math and multi-rail settlement hooks` | `backend/src/services/treasuryService.ts`, `backend/src/services/portfolioService.ts`, `backend/src/routes/checkout.ts`, `backend/src/routes/stripe.ts` |
| **Day 4** | `2026-11-18` | `feat(m4): upgrade SorobanService with live Stellar Protocol 22 RPC, mount admin treasury routes and automated test suite` | `backend/src/services/soroban.ts`, `backend/src/routes/admin.ts`, `backend/src/scripts/deployStellarNrToken.ts`, `backend/test/treasury-profit.test.ts` |
| **Day 5** | `2026-11-19` | `feat(m4): add Admin Treasury Console, dynamic fee sliders, Protocol 22 contract card, and on-chain withdrawal UI` | `frontend/src/app/admin/page.tsx`, `frontend/src/app/profile/page.tsx` |

---

## 2. Automated Test Suite Verification Checklist (`backend/test/treasury-profit.test.ts`)

- [ ] **T4.1: Split Precision**: Verify $F_{\text{gross}}$ split into $\Pi_{\text{owner}}$ and $\Pi_{\text{pool}}$ has zero rounding leaks for odd and even amounts.
- [ ] **T4.2: Zero-Sum Balance Proof**: Verify total customer payment matches principal + owner profit + pool reserve + gas.
- [ ] **T4.3: Strict Idempotency**: Verify duplicate calls with same `reference_id` and `source_type` return early without double-counting profit.
- [ ] **T4.4: $NR Pool Backing Growth**: Verify `injectRevenueToPool` increases token reserve and spot price.
- [ ] **T4.5: Dynamic Config RBAC**: Verify only `role: 'admin'` can patch `platform_config`, rejecting non-admins with HTTP 403.
- [ ] **T4.6: Stellar RPC Protocol 22**: Verify `SorobanService.getStellarRpcHealth()` reports `protocolVersion >= 22`.
- [ ] **T4.7: Contract In-Place Upgradeability**: Verify contract metadata records new WASM hash in DB upgrade history.
