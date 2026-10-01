# 📅 Day 33: B2B Developer API Keys & Partner Middleware

## 🎯 Day Objective
Implement API key generation (`nr_live_...`) allowing external developer services to programmatically query products and create orders.

---

## 🛠 Backend Tasks
- [ ] Implement `ApiKeyMiddleware` in `apps/api/src/middleware/apiKey.ts`.
- [ ] Implement `POST /api/v1/developer/keys` generating hashed API keys.

## 🎨 Frontend Tasks
- [ ] Build Developer Portal UI for API key management and usage metering.

## ✅ Definition of Done (DoD)
1. Requests with `x-api-key: nr_live_...` authenticate external B2B callers successfully.
