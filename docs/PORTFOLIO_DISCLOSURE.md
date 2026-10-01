# Professional Portfolio — What We Can Show vs Hide

> Source of truth for site copy, AI chat, resume, and cron sync boundaries.  
> Goal: recruiter-useful **and** employer/NDA-safe.

---

## 1. Industry baseline (research)

For private / client / org work under confidentiality:

| Tier | What it means |
| --- | --- |
| **Always OK** | Role, employer (if allowed), tenure, public skills, public links, personal open-source, high-level architecture patterns, anonymized case studies, *your* commit volume |
| **OK if anonymized** | Private products described as category names (“Multi-chain DeFi backend”), stack lists, patterns (Propose → Confirm → Act), mock/demo data |
| **Ask employer first** | Real product names, logos, live client URLs, screenshots of production UIs |
| **Never public** | Private source code, API keys / env / tokens, internal URLs, supplier credentials, real user/PII, revenue / GMV / TVL, vulns, salary / notice / phone / home address |

Common practice: recruiters care about **skills + problem + your impact**, not proprietary guts. When in doubt, anonymize or omit.

---

## 2. Policy for this portfolio

### A. SHOW (public site + AI + resume)

| Item | Example on this site |
| --- | --- |
| Identity | Atul Pandey · Full-Stack & Backend Developer · AppAvengers · since Apr 2024 · Remote · hireable |
| Contact (controlled) | Email, LinkedIn, GitHub, LeetCode — email via Contact form / Copy Email, not every AI reply |
| Skills | Full public skill list (TS/JS, Node, Express/Fastify, Mongo/Redis/Supabase, Web3, LLMs, Stripe, Docker, …) |
| Anonymized production work | Multi-Chain DeFi Platform, Social Media & Battles Platform, Gaming Commerce Engine, DeFi LLM Agent Protocol, Real-Time Game Engine, Web3 Utility & Receipt API |
| Safe patterns | Multi-rail payments, wallet ledger, Redis locks, propose→confirm→act, Socket.io feeds, bridge/AMM *as categories* |
| Personal / public projects | RailHub, UPI Demo, GoFood, HireHub, FleetLink, DApp Wallet (clearly **yours**) |
| Metrics you own | Your commit counts, public repo counts, stars |

### B. DO NOT SHOW

| Never | Why |
| --- | --- |
| Private org/repo paths in UI or chat (`SaaS-Repo/…`, `Blockchain-AI-Apps/…`) | Internal / confidential |
| Env vars, tokens, service-role keys, webhook secrets | Security |
| Private source, admin URLs, supplier API keys | NDA + security |
| Real user/order PII, business GMV/TVL/revenue | Confidential |
| Phone, home address, salary, notice period, IDs, family | Personal / irrelevant |
| AI as “edit this portfolio” coding tutor | Wrong product; off-brand |

### C. GRAY ZONE (prefer anonymized)

| Gray | Public wording |
| --- | --- |
| Internal codenames (LumosCore, Mento, GamersGold, Spectrum, Blend-In, Huskey, Sorobonhooks) | Use **anonymized titles** already in `fallback-data` on all public surfaces |
| Named suppliers (MooGold, G2A, …) | “Multi-supplier fulfillment adapters” only |
| Live company product URLs | Only with written permission |
| Deep proprietary flows | Pattern-level only (“cross-chain bridge”, not internal module maps) |

**Rule:** Site title = AI answer = resume bullet. No mismatch.

---

## 3. Current audit (as of this doc)

| Surface | Status |
| --- | --- |
| `fallback-data` production names | Good — already anonymized |
| `github-repos.ts` real repo paths | OK **server-only** for cron — must never appear in browser/AI |
| AI system prompt + chips | **Fix** — still says LumosCore / GamersGold / Spectrum |
| Spotlights | Mostly pattern-level — keep; strip any leftover supplier brands |
| Contact email on site | OK for professional portfolio |
| Secrets in chat | Already blocked — keep |

---

## 4. Implementation checklist

1. [x] Keep this file as policy source of truth  
2. [x] Rewrite AI knowledge + quick chips to **anonymized titles** only  
3. [x] Post-filter AI replies for private org/repo strings  
4. [x] Inject live public portfolio snapshot into AI (skills, projects, commits) for coverage without secrets  
5. [x] Audit About / hero / spotlights for same wording (About already anonymized)  
6. [x] Cron repo map stays server-only in `github-repos.ts` (not exposed to chat/UI)  
7. [ ] Optional later: password-protected deep case studies for serious recruiters  

---

## 5. Quick decision guide

```text
Is it my public personal project?          → SHOW
Is it employer work?
  Can I describe role + stack + impact
  without product brand / code / secrets? → SHOW (anonymized)
  Needs real name / screenshot / URL?     → ASK employer / OMIT
Is it a key, token, env, PII, revenue?    → NEVER
Am I unsure?                              → DON'T SHOW
```

---

## 6. Success criteria

- Recruiter understands stack, impact, and contact path in under 2 minutes  
- No private org paths, supplier brands, or secrets in UI / AI  
- Anonymized employer work vs personal projects clearly labeled  
- AI answers match the live portfolio cards
