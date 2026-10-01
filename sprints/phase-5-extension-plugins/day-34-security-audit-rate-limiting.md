# 📅 Day 34: Security Audit, Rate Limiting & OWASP Hardening

## 🎯 Day Objective
Perform security hardening with `@fastify/rate-limit`, Helmet HTTP headers, CORS domain lock, and SQL injection audits.

---

## 🛠 Backend Tasks
- [ ] Add `@fastify/rate-limit` configuring 100 requests per minute per IP.
- [ ] Audit all SQL queries ensuring parameterized statements or Supabase RPC protection.

## ✅ Definition of Done (DoD)
1. Security audit reports 0 high/critical vulnerabilities.
2. Rate limiter blocks brute force attempts with `429 Too Many Requests`.
