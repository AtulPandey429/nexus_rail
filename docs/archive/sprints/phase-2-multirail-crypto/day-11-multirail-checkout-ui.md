# 📅 Day 11: Multi-Rail Checkout Selector UI Component

## 🎯 Day Objective
Build a unified, polished payment selector interface allowing seamless tabbed switching between Fiat (Stripe), Internal Wallet, XRPL (XRP), and Stellar (XLM).

---

## 🛠 Backend Tasks
- [ ] Implement `POST /api/v1/checkout/select-rail` route accepting `orderId` and `paymentRail`.
- [ ] Calculate exchange rates and total price for selected currency (USD, XRP, XLM).

## 🎨 Frontend Tasks
- [ ] Build `MultiRailCheckoutSelector.tsx` component with tabbed choices:
  - 💳 **Stripe Credit Card**
  - 👛 **Internal USD Wallet**
  - ⚡ **XRPL XRP Direct Pay**
  - 🚀 **Stellar XLM Horizon**
- [ ] Display live fee estimations ($0.00 internal/crypto vs Stripe standard fees).
- [ ] Add smooth tab animations using Framer Motion (`layoutId="activeRailTab"`).

## ✅ Definition of Done (DoD)
1. Seamless tab switching between all 4 payment rails.
2. Order total updates dynamically based on live crypto market prices.
