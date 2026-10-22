# 📅 Day 18: Propose → Confirm → Act API Endpoints

## 🎯 Day Objective
Implement `POST /api/v1/agent/chat` and `POST /api/v1/agent/confirm` endpoints wrapping the proposal lifecycle.

---

## 🛠 Backend Tasks
- [ ] Implement `POST /api/v1/agent/chat` streaming LLM response tokens and proposal cards.
- [ ] Implement `POST /api/v1/agent/confirm` verifying JWT auth, fetching Redis proposal lock, and invoking `OrderService.executeOrder()`.
- [ ] Delete proposal key immediately after execution to prevent replay attacks.

## 🎨 Frontend Tasks
- [ ] Integrate confirmation action handler sending `proposalId` to `/api/v1/agent/confirm`.
- [ ] Render instant order creation feedback and redirect to order invoice on confirmation success.

## ✅ Definition of Done (DoD)
1. Single click on proposal card executes backend order instantly.
2. Re-submitting the same proposal ID returns `409 Conflict / Proposal already consumed`.
