# 📅 Day 10: Soroban Smart Contract Status Inspector

## 🎯 Day Objective
Integrate Soroban RPC queries to check smart contract execution state and transaction confirmation on Stellar's smart contract platform.

---

## 🛠 Backend Tasks
- [ ] Connect Soroban RPC client (`https://soroban-testnet.stellar.org`).
- [ ] Implement `SorobanService.getContractEvents(contractId)` for real-time contract execution status.
- [ ] Create route `GET /api/v1/crypto/soroban/status/:txHash`.

## 🎨 Frontend Tasks
- [ ] Build Soroban Contract Execution Inspector widget inside order tracking page.
- [ ] Render step-by-step transaction validation status (Submitted -> In Ledger -> Contract Executed -> Receipt Issued).

## ✅ Definition of Done (DoD)
1. Soroban contract events queried dynamically via RPC.
2. Step-by-step execution status updates accurately in real-time UI.
