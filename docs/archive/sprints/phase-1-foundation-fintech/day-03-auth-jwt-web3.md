# 📅 Day 03: Hybrid Auth System (JWT + Web3 Signature Nonce)

## 🎯 Day Objective
Implement dual-authentication supporting standard Email/Password JWTs and EVM/XRPL Web3 crypto wallet cryptographic signature verification.

---

## 🛠 Backend Tasks
- [ ] Implement `POST /api/v1/auth/nonce` returning a random cryptographic challenge nonce string for wallet address signing.
- [ ] Implement `POST /api/v1/auth/verify-signature` using `ethers.js` / `xrpl.js` signature verification.
- [ ] Implement `POST /api/v1/auth/login` (email/password) with bcrypt hash comparison.
- [ ] Issue HTTP-only JWT cookies containing `userId`, `role`, and `walletAddress`.
- [ ] Implement Fastify/Express Auth Middleware `apps/api/src/middleware/auth.ts`.

## 🎨 Frontend Tasks
- [ ] Build Auth Modal component supporting tabbed switching between "Email Sign-In" and "Connect Web3 Wallet".
- [ ] Integrate MetaMask / XRPL wallet connection hooks in `apps/web/src/hooks/useWeb3Auth.ts`.
- [ ] Create global auth state store using Zustand (`useAuthStore`).
- [ ] Protect authenticated routes (`/dashboard`, `/checkout`, `/orders`).

## 🗄 API Schemas
```json
// POST /api/v1/auth/verify-signature payload
{
  "walletAddress": "0x123...",
  "signature": "0xabc...",
  "nonce": "nexusrail-auth-challenge-981247"
}
```

## ✅ Definition of Done (DoD)
1. Web3 wallet signs nonce and logs user into app smoothly.
2. JWT cookie issued and authenticated API routes respond with `200 OK`.
3. User profile reflects connected wallet address in top right navbar.
