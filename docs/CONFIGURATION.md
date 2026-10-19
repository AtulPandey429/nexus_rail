# ⚙️ NexusRail — Configuration & Environment Variables Reference

All runtime configuration for **NexusRail** is managed strictly via environment variables. In the backend, variables are parsed and validated at boot using a runtime **Zod schema** (`apps/api/src/config/env.ts`).

---

## 1. Master Configuration Schema

| Variable Name | Scope | Required | Default Value | Description |
|:---|:---|:---:|:---|:---|
| `PORT` | Backend | Optional | `4000` | Port for the Express REST API server to listen on. |
| `NODE_ENV` | Global | Required | `development` | Runtime mode: `development`, `production`, or `test`. Controls error sanitization and CORS strictness. |
| `MONGODB_URI` | Backend | **Required** | `""` | MongoDB Atlas connection string URI (`mongodb+srv://...`). |
| `JWT_SECRET` | Backend | **Required** | `nexusrail_development_jwt_secret_ephemeral_key_32chars` | 32+ character HMAC key used to sign and verify user session JWTs. Must be changed in production. |
| `CORS_ORIGIN` | Backend | Required | `http://localhost:3000` | Primary frontend origin permitted to make cross-origin requests. In production, `*.vercel.app` origins are automatically permitted. |
| `APP_URL` | Backend | Required | `http://localhost:3000` | Canonical frontend application URL used for redirect targets and Stripe success/cancel URLs. |
| `API_SERVER_URL` | Frontend | Required | `https://nexus-rail.onrender.com` | Upstream backend URL target for the Next.js edge reverse proxy (`/api/v1/*`). |
| `NEXT_PUBLIC_API_URL` | Frontend | Optional | `http://localhost:4000` | Public fallback URL for client-side API requests. |
| `GROQ_API_KEY` | Backend | Optional | `undefined` | API key from Groq Cloud Console for LLM inference in the AI Commerce Desk. |
| `GROQ_MODEL` | Backend | Optional | `llama-3.3-70b-versatile` | Default model candidate for the AI Router. |
| `HORIZON_URL` | Backend | Optional | `https://horizon-testnet.stellar.org` | Stellar Horizon node endpoint for account loading and transaction verification. |
| `STELLAR_MERCHANT_PUBLIC_KEY` | Backend | Optional | `GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR` | Merchant G-address vault where customer XLM payments are routed. |
| `XRPL_WSS` | Backend | Optional | `wss://s.altnet.rippletest.net:51233` | XRPL WebSocket RPC endpoint. |
| `XRPL_MERCHANT_ADDRESS` | Backend | Optional | `rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW` | Merchant classic r-address vault where customer XRP payments are routed. |
| `STRIPE_SECRET_KEY` | Backend | Optional | `undefined` | Stripe secret key (`sk_test_...` or `sk_live_...`) for creating card checkout sessions. |
| `STRIPE_WEBHOOK_SECRET` | Backend | Optional | `undefined` | Stripe webhook signature secret (`whsec_...`) used to verify incoming events. |
| `PINATA_JWT` | Backend | Optional | `undefined` | Pinata Cloud JWT for IPFS receipt pinning via the Pinata REST API. |
| `COINGECKO_API_KEY` | Backend | Optional | `undefined` | Optional demo or pro API key for CoinGecko (`x-cg-demo-api-key`). Public API is used if empty. |
| `RENDER_EXTERNAL_URL` | Backend | Optional | `undefined` | Set automatically by Render. When present, the Keep-Alive worker pings `/api/v1/health` every 10 minutes to prevent dyno sleep. |
| `SUPABASE_URL` | Backend | Optional | `undefined` | Supabase Postgres URL for secondary `/api/v1/guide` messages table. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Optional | `undefined` | Supabase Service Role Key for secondary `/api/v1/guide` messages table. |

---

## 2. Deployment Profiles

### A. Local Development Profile (`.env`)
```env
PORT=4000
NODE_ENV=development
JWT_SECRET=nexusrail_local_development_jwt_secret_32chars_long
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexusrail?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000
API_SERVER_URL=http://localhost:4000

# Web3 Public Testnets
HORIZON_URL=https://horizon-testnet.stellar.org
XRPL_WSS=wss://s.altnet.rippletest.net:51233
```

### B. Render Production Profile (Backend API)
- **Environment:** Node
- **Build Command:** `npm run build:shared && npm run build:api`
- **Start Command:** `npm run start --workspace=apps/api`
- **Environment Variables:**
  - `NODE_ENV=production`
  - `PORT=10000` (Render default or automatic)
  - `MONGODB_URI=<Atlas Connection String>`
  - `JWT_SECRET=<High-Entropy Cryptographic Secret>`
  - `CORS_ORIGIN=https://nexus-rail-one.vercel.app`
  - `APP_URL=https://nexus-rail-one.vercel.app`
  - `GROQ_API_KEY=<Groq Cloud Key>`
  - `STRIPE_SECRET_KEY=<Stripe Secret Key>`
  - `STRIPE_WEBHOOK_SECRET=<Stripe Webhook Secret>`
  - `PINATA_JWT=<Pinata JWT>`

### C. Vercel Production Profile (Frontend Web Client)
- **Framework Preset:** Next.js
- **Root Directory:** `apps/web` (or monorepo root with `build:web`)
- **Build Command:** `next build`
- **Environment Variables:**
  - `API_SERVER_URL=https://nexus-rail.onrender.com`
  - `NEXT_PUBLIC_API_URL=https://nexus-rail.onrender.com`
