# 📅 Day 04: Transactional Double-Entry Wallet Ledger

## 🎯 Day Objective
Build a race-condition safe, double-entry atomic internal wallet ledger with credit/debit transaction logging and non-negative balance checks.

---

## 🛠 Backend Tasks
- [ ] Implement `WalletService.creditBalance(userId, amountCents, currency, refId)`.
- [ ] Implement `WalletService.debitBalance(userId, amountCents, currency, refId)` with SQL transaction lock (`SELECT ... FOR UPDATE`).
- [ ] Add SQL check constraint: `CONSTRAINT check_balance_non_negative CHECK (balance_after >= 0)`.
- [ ] Create `GET /api/v1/wallet/balance` route.
- [ ] Create `GET /api/v1/wallet/transactions` route returning audit history with pagination.

## 🎨 Frontend Tasks
- [ ] Build Wallet Balance Card component showing USD, XRP, and XLM balances.
- [ ] Build Recent Activity Ledger Table component with status indicators (`CREDIT` green, `DEBIT` red).
- [ ] Add "Top Up Balance" drawer modal for internal wallet deposits.

## 🗄 SQL Check Constraint Reference
```sql
ALTER TABLE public.wallet_transactions 
ADD CONSTRAINT check_positive_amount CHECK (amount_cents > 0);
```

## ✅ Definition of Done (DoD)
1. Simultaneous debit requests fail gracefully without double-spending or negative balances.
2. Balance checkpoint (`balance_after`) matches sum of previous credits minus debits.
3. Front-end ledger table updates dynamically after test balance top-up.
