# Module 4: Platform Owner Profit Engine, Database Ledger & Stellar Protocol 22 Smart Contract

> **Target Architecture:** NexusRail Monorepo (`backend/`, `frontend/`, `contracts/`)  
> **Status:** Active Execution  
> **Dependencies:** `M1` ($NR Token AMM), `M2` (Live Smart Baskets), `M3` (User Portfolio & Cashout)

---

## Overview

Module 4 establishes the **economic and smart contract foundation** of NexusRail:
1. **Double-Entry Platform Treasury**: Segregates customer deposits from platform revenue.
2. **50 / 50 Ecosystem Split**: 50% directly to Owner Net Profit, 50% directly into `$NR` AMM liquidity pool reserve to mathematically raise token value.
3. **Stellar Protocol 22 Smart Contract (`NexusVault`)**: Written in Rust, utilizing `CAP-0058` atomic constructors and native in-place WASM upgradability (`update_current_contract_wasm`) so the contract address never changes.
4. **Authoritative Database Persistence**: Records smart contract deployments, code upgrades, dynamic fee configurations, and on-chain token issuance in MongoDB Atlas.
5. **Interactive Admin Command Center**: Live profit analytics, fee adjustment sliders, Protocol 22 RPC status, and 1-click on-chain token withdrawal.

---

## Directory Navigation

- [01 Research & Protocol 22 Math](./01_RESEARCH_AND_SOROBAN_P22_MATH.md)
- [02 Database Schema & Types](./02_DATABASE_SCHEMA_AND_TYPES.md)
- [03 Backend API & Service Flow](./03_BACKEND_API_AND_FLOW.md)
- [04 Frontend Admin Console Flow](./04_FRONTEND_AND_ADMIN_UI_FLOW.md)
- [05 Implementation Plan & Changelog](./05_IMPLEMENTATION_PLAN_AND_CHANGELOG.md)
