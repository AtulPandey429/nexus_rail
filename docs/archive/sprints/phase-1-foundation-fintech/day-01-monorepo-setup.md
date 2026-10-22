# 📅 Day 01: Monorepo Architecture & Workspace Setup

## 🎯 Day Objective
Initialize the `nexusrail` monorepo structure with pnpm workspaces, shared TypeScript packages, and environment configuration templates.

---

## 🛠 Backend Tasks
- [ ] Initialize `pnpm` workspace with `pnpm-workspace.yaml`.
- [ ] Scaffold `apps/api` using Node.js, Fastify/Express, and TypeScript (`tsconfig.json`).
- [ ] Set up environment configuration module in `apps/api/src/config/env.ts` using `zod`.
- [ ] Create basic health check route: `GET /api/v1/health` returning `{ status: "ok", timestamp: ISOString }`.

## 🎨 Frontend Tasks
- [ ] Configure `apps/web` using Next.js 16 App Router with React 19.
- [ ] Set up `packages/shared` workspace package for shared Zod schemas and TypeScript interfaces.
- [ ] Configure `tailwind.config.ts` with brand design tokens (`nexus-dark`, `rail-emerald`, `cyber-purple`).
- [ ] Build basic app shell layout with Navbar, Sidebar container, and Footer.

## 🗄 API & Database Specs
```typescript
// packages/shared/src/types/health.ts
export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
}
```

## ✅ Definition of Done (DoD)
1. `pnpm install` links `packages/shared` across both `apps/web` and `apps/api`.
2. `GET /api/v1/health` returns `200 OK`.
3. Next.js 16 dev server starts cleanly on `http://localhost:3000`.
