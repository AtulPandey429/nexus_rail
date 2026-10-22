# 🚀 NexusRail — Sprint Roadmap & Day-by-Day Implementation Guide

This directory contains the complete, day-by-day engineering sprint plan to transform **RailHub** into **NexusRail** — the flagship multi-rail commerce platform with an AI agent desk and social commerce features.

---

## 📅 Sprint Overview

The implementation is broken down into **5 Phases (35 Days total)**. Each day specifies exact **Frontend**, **Backend**, **Database/API**, and **Definition of Done (DoD)** requirements.

| Phase | Duration | Core Focus | Link |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Days 01–07 | Foundation, Supabase DB, Auth, Wallet Ledger & Stripe | [`phase-1-foundation-fintech/`](./phase-1-foundation-fintech/) |
| **Phase 2** | Days 08–14 | Multi-Rail Web3 Crypto Payments (XRPL + Stellar Horizon) | [`phase-2-multirail-crypto/`](./phase-2-multirail-crypto/) |
| **Phase 3** | Days 15–21 | Sub-300ms AI Agent Desk (Gemini Flash / Groq LLM + Redis Locks) | [`phase-3-ai-agent-desk/`](./phase-3-ai-agent-desk/) |
| **Phase 4** | Days 22–28 | Social Commerce Hub (Mento Reviews, Showdowns) & Deployment | [`phase-4-social-commerce-deploy/`](./phase-4-social-commerce-deploy/) |
| **Phase 5** | Days 29–35 | Extensible Extension Plugins (Hyperliquid, fal.ai, Privy, B2B Keys) | [`phase-5-extension-plugins/`](./phase-5-extension-plugins/) |

---

## 🛠 Tech Stack Quick Reference

* **Frontend**: Next.js 16 App Router (React Server Components, Tailwind CSS, Shadcn UI, Framer Motion, Zustand)
* **Backend API**: Fastify / Express Node.js API with Socket.io WebSockets
* **Database**: Supabase PostgreSQL + Upstash Redis (Caching & Proposal Locks) + MongoDB Atlas M0
* **AI Engine**: Gemini 2.0 Flash / Groq LLM API with Function Tool Calling
* **Payments & Web3**: Stripe Checkout, XRPL JavaScript SDK (`xrpl`), Stellar SDK (`@stellar/stellar-sdk`), IPFS (Pinata)
* **Deployment**: Vercel (Frontend) + Render (Backend API) — $0.00 Free Tier Constraint

---

## 🎯 How to Use This Plan

1. Pick the active day file (e.g., `sprints/phase-1-foundation-fintech/day-01-monorepo-setup.md`).
2. Execute the **Backend** tasks first, verifying endpoints with `curl` or Postman.
3. Build the **Frontend** components using Next.js 16 App Router.
4. Run the **Verification Criteria** at the end of each day before moving to the next.
