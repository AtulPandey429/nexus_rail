# 📅 Day 13: IPFS Decentralized Order Receipts via Pinata

## 🎯 Day Objective
Generate cryptographic immutable order receipt JSON documents and pin them to IPFS via Pinata SDK upon payment confirmation.

---

## 🛠 Backend Tasks
- [ ] Install `@pinata/sdk` in `apps/api`.
- [ ] Implement `IpfsService.pinOrderReceipt(orderData)` generating canonical JSON containing `orderId`, `txHash`, `items`, `timestamp`, and `signature`.
- [ ] Store returned IPFS CID (`ipfs_cid`) in Supabase `orders` table.
- [ ] Create route `GET /api/v1/orders/:orderId/ipfs-receipt`.

## 🎨 Frontend Tasks
- [ ] Build IPFS Receipt Viewer widget in Order Details page displaying IPFS CID and direct IPFS Gateway link (`https://gateway.pinata.cloud/ipfs/...`).
- [ ] Add "View Raw IPFS JSON" toggle.

## ✅ Definition of Done (DoD)
1. Every paid order produces a pinned IPFS receipt JSON document.
2. Gateway link resolves and verifies valid receipt payload.
