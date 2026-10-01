# 📅 Day 20: Real-Time Socket.io Event Streaming

## 🎯 Day Objective
Integrate Socket.io real-time websocket event channels in `apps/api` for live order fulfillment updates and flash-sale ticker streaming.

---

## 🛠 Backend Tasks
- [ ] Setup `socket.io` server attached to Fastify/Express HTTP server in `apps/api/src/sockets/server.ts`.
- [ ] Create authenticated room joining middleware (`socket.join('user:' + userId)`).
- [ ] Emit `agent:thinking`, `order:updated`, and `flash_sale:price_drop` real-time events.

## 🎨 Frontend Tasks
- [ ] Create `useSocket.ts` React hook managing auto-reconnecting WebSocket client.
- [ ] Display live toast notifications when backend background workers update order fulfillment status.

## ✅ Definition of Done (DoD)
1. WebSocket connection connects securely with JWT payload.
2. Status updates push instantly to front-end UI without page refreshes.
