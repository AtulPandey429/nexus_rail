# 📅 Day 05: Stripe Checkout Test Mode & Webhook Verification

## 🎯 Day Objective
Integrate Stripe Checkout API in test mode with webhook signature verification for automated order fulfillment upon payment capture.

---

## 🛠 Backend Tasks
- [ ] Install `stripe` SDK in `apps/api`.
- [ ] Implement `POST /api/v1/checkout/stripe/create-session` accepting product ID and quantity.
- [ ] Implement `POST /api/v1/webhooks/stripe` with `stripe.webhooks.constructEvent()` raw body signature check.
- [ ] Handle `checkout.session.completed` event: transition order status from `PENDING` to `PAID` and deduct product stock quantity.

## 🎨 Frontend Tasks
- [ ] Build Checkout Button UI component loading Stripe Checkout redirect session URL.
- [ ] Create `/checkout/success` page displaying animated checkmark and order summary.
- [ ] Create `/checkout/cancel` page allowing user to retry or select a different payment rail.

## 🗄 Webhook Signature Payload Spec
```typescript
// Fastify/Express webhook endpoint handler signature verification
const event = stripe.webhooks.constructEvent(
  rawBody,
  signatureHeader,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

## ✅ Definition of Done (DoD)
1. User clicks "Pay with Card", redirects to Stripe Test Checkout.
2. Webhook triggers order status update to `PAID` in Supabase `orders` table.
3. `/checkout/success` route displays order summary correctly.
