# 📅 Day 16: Function Tool Calling Engine Architecture

## 🎯 Day Objective
Register backend function tools allowing the AI Agent to query inventory, check wallet balance, create order proposals, and fetch reviews.

---

## 🛠 Backend Tasks
- [ ] Define Function Tool Schemas in `apps/api/src/agent/tools/`:
  - `search_catalog({ query, category, maxPriceCents })`
  - `check_wallet_balance({ currency })`
  - `propose_purchase_order({ sku, quantity, paymentRail })`
  - `fetch_product_reviews({ sku })`
- [ ] Implement Function Execution Registry mapping tool calls to backend services.

## 🎨 Frontend Tasks
- [ ] Build Agent Tool Call Execution Badge component displaying active tool calls (e.g. `⚙️ Calling tool: search_catalog...`).

## ✅ Definition of Done (DoD)
1. Agent accurately invokes function tools based on user chat instructions.
2. Structured JSON arguments validated with Zod before execution.
