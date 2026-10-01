# 📅 Day 08: XRPL Testnet Integration & Payment Invoice Generator

## 🎯 Day Objective
Integrate the official `xrpl` JS library to generate Testnet payment invoices with unique destination tags for order tracking.

---

## 🛠 Backend Tasks
- [ ] Install `xrpl` package in `apps/api`.
- [ ] Connect to XRPL Testnet WebSocket (`wss://s.altnet.rippletest.net:51233`).
- [ ] Implement `XRPLService.createPaymentInvoice(orderId, amountXrp)`.
- [ ] Generate unique 32-bit integer `DestinationTag` for each transaction to map payments directly to order IDs.

## 🎨 Frontend Tasks
- [ ] Build XRPL Invoice Drawer component displaying XRPL Destination Address, Destination Tag, and QR code.
- [ ] Add "Copy Address" and "Copy Destination Tag" quick-action buttons with toast notifications.
- [ ] Show real-time transaction listener status spinner ("Waiting for XRPL ledger validation...").

## 🗄 XRPL Invoice Spec
```typescript
export interface XRPLInvoice {
  orderId: string;
  xrplAddress: string;
  destinationTag: number;
  amountDrops: string; // 1 XRP = 1,000,000 drops
  expiresAt: string;
}
```

## ✅ Definition of Done (DoD)
1. XRPL payment invoice generated with unique Destination Tag.
2. QR Code renders valid `ripple:r...` payment URI.
3. Testnet transaction sent from Xaman / XRPL test wallet is detected on ledger.
