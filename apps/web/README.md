# 🌐 NexusRail Web Client (`@nexusrail/web`)

[![Next.js](https://img.shields.io/badge/Next.js-15.2.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://nexus-rail-one.vercel.app)

The official web frontend for **NexusRail** — an ultra-responsive, dual-theme e-commerce and Web3 settlement interface built with the Next.js 15 App Router, React 19, and Tailwind CSS.

---

## 🚀 Live Demo
- **Production URL**: [https://nexus-rail-one.vercel.app](https://nexus-rail-one.vercel.app)
- **Deployment Platform**: Vercel
- **Backend API Reverse Proxy**: `/api/v1/*` automatically forwarded to `https://nexus-rail.onrender.com`

---

## ✨ Features & Architecture

### 1. 🎨 Adaptive Design System & Themes
- **Dark & Light Mode**: Built-in [ThemeProvider.tsx](file:///d:/live/nexus-rail/apps/web/src/components/ThemeProvider.tsx) with persistent `localStorage` storage and smooth CSS transition tokens.
- **Portfolio-Grade Animations**:
  - `animate-float`: Subtle levitation for hero badges and interactive cards.
  - `animate-pulse-slow`: Gentle glow effects for status indicators.
  - `animate-fade-in-up`: Smooth reveal transitions on page navigation.
  - `animate-gradient-x`: Dynamic flowing gradient text for headlines.
- **Fully Responsive**: Mobile-first architecture featuring a slide-out hamburger navigation drawer in [SiteHeader.tsx](file:///d:/live/nexus-rail/apps/web/src/components/SiteHeader.tsx), fluid grids, and adaptive touch targets.

### 2. ⚡ High-Efficiency Branding Assets
- Replaced heavyweight image files with ultra-compressed, vector-grade **WebP** assets:
  - `logo-icon.webp` (1.6 KB, 64x64) — embedded inside search bars and headers.
  - `logo-128.webp` (3.9 KB, 128x128)
  - `logo-256.webp` (9.3 KB, 256x256)
  - `logo-512.webp` (21.5 KB, 512x512)
  - `favicon.ico` & `favicon.png` (2.3 KB, 32x32)
- Reusable [NexusLogo.tsx](file:///d:/live/nexus-rail/apps/web/src/components/NexusLogo.tsx) component supporting `sm`, `md`, `lg`, `xl`, and `search` sizing presets with zero layout shifts.

### 3. 💳 Multi-Rail Checkout Experience
- **Stellar Horizon**: Direct settlement using the `@stellar/freighter-api` browser extension.
- **XRPL Altnet**: Direct settlement via `@gemwallet/api` and Xaman QR links.
- **Stripe Modal**: Embedded credit/debit card checkout modal for traditional fiat consumers.
- **Dynamic Conversion Rates**: Live coin pricing ticker fetching real-time XLM, XRP, and USD rates.

### 4. 🤖 Autonomous AI Agent Desk
- Floating conversational panel in [AgentDeskPanel.tsx](file:///d:/live/nexus-rail/apps/web/src/components/AgentDeskPanel.tsx).
- Sub-300ms inference for product discovery, checkout creation, and automated basket management.
- Real-time cart synchronization and proposal acceptance flows.

### 5. 🛡️ Reverse Proxy Architecture
- Implemented in [route.ts](file:///d:/live/nexus-rail/apps/web/src/app/api/v1/%5B...path%5D/route.ts).
- All client requests to `/api/v1/*` are captured by Next.js edge route handlers and securely dispatched to the upstream Render backend.
- Prevents cross-origin CORS leakage and browser origin mismatches in production.

---

## 📁 App Router Page Directory

```
apps/web/src/app/
├── layout.tsx            # Global root layout (Header, Footer, ThemeProvider, Toast)
├── page.tsx              # Landing page (Hero, metrics, feature cards, live rates)
├── globals.css           # Tailwind base styles, theme variables, and custom keyframes
│
├── store/
│   └── page.tsx          # Store catalog with live search (with logo badge) & category filters
├── activity/
│   └── page.tsx          # Real-time ledger activity & transaction explorer
├── cart/
│   └── page.tsx          # Shopping cart management
├── checkout/
│   └── page.tsx          # Multi-rail payment gateway (Stellar, XRPL, Stripe)
├── receipt/
│   └── page.tsx          # On-chain payment receipt and IPFS confirmation
├── swap/
│   └── page.tsx          # Instant token swap simulation
│
├── rwa/
│   ├── page.tsx          # Real-World Asset Gold vault overview
│   ├── buy/page.tsx      # Physical gold tokenization purchase
│   └── perps/page.tsx    # Leveraged perpetual contracts
│
├── login/
│   └── page.tsx          # User login (Email/password + Google OAuth)
├── register/
│   └── page.tsx          # New user registration
│
├── admin/
│   ├── page.tsx          # Merchant analytics dashboard & transaction health
│   └── orders/page.tsx   # Order management & ledger verification
│
└── api/v1/[...path]/
    └── route.ts          # Upstream reverse proxy forwarding to Render API
```

---

## 🛠 Core Components Reference

| Component | File | Purpose |
| :--- | :--- | :--- |
| `NexusLogo` | `src/components/NexusLogo.tsx` | Optimized WebP logo with responsive sizes and search bar presets. |
| `ThemeProvider` | `src/components/ThemeProvider.tsx` | Context provider managing dark/light modes with persistence. |
| `SiteHeader` | `src/components/SiteHeader.tsx` | Top navigation with mobile drawer, theme toggle, and cart badge. |
| `SiteFooter` | `src/components/SiteFooter.tsx` | Multi-column footer with status indicator and ecosystem links. |
| `AgentDeskPanel` | `src/components/AgentDeskPanel.tsx` | Interactive floating AI commerce agent widget. |
| `MultiRailCheckoutSelector` | `src/components/MultiRailCheckoutSelector.tsx` | Rail selector toggle for XLM, XRP, and Stripe. |
| `StripeCheckoutModal` | `src/components/StripeCheckoutModal.tsx` | Modal wrapper for Stripe card checkout. |
| `WalletConnectModal` | `src/components/WalletConnectModal.tsx` | Web3 wallet selector (Freighter, GemWallet, Xaman). |
| `RwaGoldVaultCard` | `src/components/RwaGoldVaultCard.tsx` | Gold vault metrics, minting, and proof-of-reserve tracker. |
| `ProductShowdownCard` | `src/components/ProductShowdownCard.tsx` | Community comparison and showdown voting interface. |

---

## 💻 Local Development

### 1. Install Dependencies
From the monorepo root:
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file inside `apps/web/`:
```env
# URL of your local or remote backend API
API_SERVER_URL=http://localhost:4000

# Public API URL for client-side fetches
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Run Development Server
```bash
# From monorepo root:
npm run dev:web

# Or from apps/web:
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 📦 Tech Stack & Packages
- **Framework**: Next.js 15.2.3 (React 19)
- **Styling**: Tailwind CSS 3.4.17 + PostCSS
- **Icons**: Lucide React (`lucide-react`)
- **Web3 SDKs**:
  - `@stellar/freighter-api` (Stellar browser wallet)
  - `@gemwallet/api` (XRPL browser wallet)
- **Shared Package**: `@nexusrail/shared`
