# 🚀 NexusRail — Multi-Rail Commerce Platform & AI Agent Desk

NexusRail is an enterprise-grade, high-performance monorepo platform combining Multi-Rail Fintech (Stripe + XRPL + Stellar), sub-300ms AI tool execution, and Social Commerce.

---

## 📁 Repository Monorepo Structure

```text
nexus-rail/
├── apps/
│   ├── web/                 # Next.js 16 App Router (RSC, Tailwind, Static ISR)
│   └── api/                 # Express Node.js API, TypeScript, Socket.io
├── packages/
│   └── shared/              # Zod validation schemas & TypeScript types
├── docs/                    # Imported Master Blueprint & Architecture Guides
├── sprints/                 # Day-by-Day 35-Day Execution Plan
├── package.json             # Root Monorepo configuration
├── pnpm-workspace.yaml      # Workspace packages definition
└── .env.example             # Environment variable template
```

---

## ⚡ Quick Start

```bash
# Install dependencies across all workspace packages
npm install # or pnpm install

# Build shared packages
npm run build:shared

# Run API dev server (:4000)
npm run dev:api

# Run Web dev server (:3000)
npm run dev:web
```

---

## 🎯 Verification Criteria (Day 01 Monorepo Setup)

- `GET http://localhost:4000/api/v1/health` -> Returns `200 OK` with JSON payload `{ status: "ok", service: "nexusrail-api", ... }`
- `GET http://localhost:3000` -> Renders NexusRail App Router landing page
