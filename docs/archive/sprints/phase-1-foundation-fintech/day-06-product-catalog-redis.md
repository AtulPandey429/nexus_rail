# 📅 Day 06: Redis Catalog Caching & Upstash Integration

## 🎯 Day Objective
Implement high-performance Upstash Redis product catalog caching to achieve sub-10ms response times for active product queries.

---

## 🛠 Backend Tasks
- [ ] Connect `@upstash/redis` in `apps/api/src/config/redis.ts`.
- [ ] Implement `GET /api/v1/products` route with Cache-Aside pattern (Redis `GET` -> SQL Fallback -> Redis `SETEX 300`).
- [ ] Add cache invalidation trigger on product CRUD operations (`redis.del('products:active')`).

## 🎨 Frontend Tasks
- [ ] Build Product Grid component with skeleton loader states.
- [ ] Implement Product Detail Modal with image gallery and payment rail selection dock.
- [ ] Configure Next.js ISR route revalidation (`export const revalidate = 60`).

## ✅ Definition of Done (DoD)
1. Subsequent product list calls hit Redis cache in < 10ms.
2. Updating product catalog invalidates cache immediately.
