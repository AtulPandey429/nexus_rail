# 📅 Day 17: Redis Proposal Lock Manager

## 🎯 Day Objective
Implement transactional Redis proposal locks to enforce human authorization (**Propose → Confirm → Act**) before high-value action execution.

---

## 🛠 Backend Tasks
- [ ] Implement `ProposalLockManager.createProposal(userId, actionPayload, ttlSeconds = 300)`.
- [ ] Save proposal in Redis with key `proposal:{proposalId}` and status `PROPOSED`.
- [ ] Implement `ProposalLockManager.getProposal(proposalId)`.
- [ ] Implement `ProposalLockManager.consumeProposal(proposalId, userId)` ensuring single atomic execution using Redis `GETDEL` / Lua script.

## 🎨 Frontend Tasks
- [ ] Build `ActionProposalCard.tsx` displaying proposed action details, total cost, payment rail, countdown timer (5:00), and "Confirm & Pay" / "Decline" buttons.

## 🗄 Redis Proposal Spec
```json
{
  "proposalId": "prop_981a72b",
  "userId": "usr_123",
  "action": "PURCHASE_ORDER",
  "payload": {
    "sku": "PROD-XRP-KIT",
    "quantity": 1,
    "paymentRail": "XRPL",
    "priceCents": 2500
  },
  "status": "PROPOSED",
  "expiresAt": 1775681900
}
```

## ✅ Definition of Done (DoD)
1. Agent cannot execute financial transactions directly without user clicking "Confirm".
2. Expired proposal locks (> 5 mins) automatically invalidate and refuse execution.
