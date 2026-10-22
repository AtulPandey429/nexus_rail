# 📅 Day 23: Verified Buyer Reviews with On-Chain Proof

## 🎯 Day Objective
Implement verified buyer review submissions attached to order IDs and verified against paid database orders.

---

## 🛠 Backend Tasks
- [ ] Implement `POST /api/v1/products/:id/reviews` checking user purchase history (`orders` table status = `PAID`).
- [ ] Return `403 Forbidden` if user has not purchased product.

## 🎨 Frontend Tasks
- [ ] Build Review Submission Form with star rating picker.
- [ ] Render "Verified Buyer ✓" badge alongside reviews.

## ✅ Definition of Done (DoD)
1. Only users with completed orders can submit reviews.
2. Verified badge displays next to authenticated reviewer names.
