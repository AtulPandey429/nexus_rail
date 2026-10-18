# NexusRail Web Client (`@nexusrail/web`)

[![Next.js](https://img.shields.io/badge/Next.js-15.2.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://nexus-rail-one.vercel.app)

The official web frontend for **NexusRail**, built with Next.js 15 App Router, React 19, and Tailwind CSS.

---

## Live Deployment
- **Web App**: [https://nexus-rail-one.vercel.app](https://nexus-rail-one.vercel.app)
- **Upstream API**: Proxied through `/api/v1/*` to `https://nexus-rail.onrender.com`

---

## Features

### 1. Adaptive Design & Themes
- **Theme Provider**: System-aware dark and light modes with local storage persistence and CSS variables.
- **Micro-Animations**: Tailwind transitions and portfolio animations (`float`, `pulse-slow`, `fade-in-up`, `gradient-x`).
- **Responsive Layout**: Mobile-optimized drawer navigation, sticky header with integrated search, and fluid grid layouts.

### 2. Multi-Rail Checkout
- **Stellar Horizon**: Direct wallet settlement using `@stellar/freighter-api`.
- **XRPL Altnet**: Direct settlement using `@gemwallet/api` and Xaman QR links.
- **Stripe**: Embedded card payment modal.
- **Real-Time Rates**: Dynamic exchange rate updates across supported assets.

### 3. AI Commerce Assistant
- Interactive floating panel (`AgentDeskPanel.tsx`) connected to backend tool execution.
- Natural language product queries, cart management, and checkout preparation.

### 4. API Reverse Proxy
- Next.js server route handlers (`src/app/api/v1/[...path]/route.ts`) securely proxy incoming API calls to the upstream backend (`API_SERVER_URL`), preventing browser CORS issues.

---

## Page Structure

```
apps/web/src/app/
├── layout.tsx            # Global layout (Header, Footer, ThemeProvider)
├── page.tsx              # Landing page
├── store/page.tsx        # Store catalog with search and category filters
├── activity/page.tsx     # On-chain ledger activity and explorer
├── cart/page.tsx         # Shopping cart
├── checkout/page.tsx     # Multi-rail payment gateway
├── receipt/page.tsx      # Payment receipt and transaction details
├── swap/page.tsx         # Asset swap interface
├── rwa/                  # Real-World Asset vault and perps
├── login/page.tsx        # User login
├── register/page.tsx     # User registration
├── admin/page.tsx        # Admin analytics dashboard
└── api/v1/[...path]/     # Upstream API proxy handler
```

---

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create `.env.local` inside `apps/web/`:
```env
API_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build
```bash
npm run build
```

---

## Dependencies
- **Framework**: Next.js 15.2.3, React 19
- **Styling**: Tailwind CSS 3.4.17
- **Icons**: Lucide React
- **Web3**: `@stellar/freighter-api`, `@gemwallet/api`
- **Shared Package**: `@nexusrail/shared`
