# 📅 Day 09: Stellar Horizon Testnet Integration

## 🎯 Day Objective
Integrate `@stellar/stellar-sdk` to monitor Stellar Horizon Testnet payments using memo text mapping.

---

## 🛠 Backend Tasks
- [ ] Install `@stellar/stellar-sdk` in `apps/api`.
- [ ] Connect to Stellar Horizon Testnet server (`https://horizon-testnet.stellar.org`).
- [ ] Implement `StellarService.createInvoice(orderId, amountXlm)` attaching a 28-character unique alphanumeric Memo text.
- [ ] Stream payments via Stellar Horizon server SSE stream (`server.payments().forAccount(account).cursor('now').stream(...)`).

## 🎨 Frontend Tasks
- [ ] Build Stellar Invoice Panel component displaying Stellar account ID and required Memo text.
- [ ] Add warning banner: "⚠️ Important: You MUST include the exact Memo text when sending XLM, or your payment will not be credited automatically."
- [ ] Add Freight / XLM currency converter widget.

## ✅ Definition of Done (DoD)
1. Stellar Horizon payment stream listens for incoming account payments.
2. Transactions matching order Memo text automatically update order status to `PAID`.
