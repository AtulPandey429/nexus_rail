# 📅 Day 12: Blockchain Ledger Transaction Watcher Workers

## 🎯 Day Objective
Deploy background listener workers in `apps/api` to monitor XRPL and Stellar Horizon ledgers for incoming payments with automatic re-connection logic.

---

## 🛠 Backend Tasks
- [ ] Implement `XRPLWatcherWorker` maintaining persistent WebSocket subscription (`subscribe` to account tx streams).
- [ ] Implement `StellarWatcherWorker` maintaining persistent SSE stream to Stellar Horizon.
- [ ] Add auto-reconnect exponential backoff retry mechanism (1s, 2s, 4s, 8s up to 60s max).
- [ ] Handle valid transactions: update order status to `PAID`, emit Socket.io event to user room.

## 🎨 Frontend Tasks
- [ ] Connect Socket.io client to listen for `order:paid` events on the checkout page.
- [ ] Trigger confetti animation and redirect to Order Receipt page on payment detection.

## ✅ Definition of Done (DoD)
1. Ledger watcher worker automatically reconnects if WebSocket connection drops.
2. Order marks `PAID` within 2 seconds of testnet ledger validation.
