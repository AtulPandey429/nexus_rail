# 📅 Day 24: Gamified Upvotes & Product Leaderboard

## 🎯 Day Objective
Implement real-time product upvoting and trending leaderboard views using Upstash Redis Sorted Sets (`ZADD` / `ZREVRANGE`).

---

## 🛠 Backend Tasks
- [ ] Implement `POST /api/v1/products/:id/upvote` pushing product score to Redis Sorted Set `leaderboard:trending`.
- [ ] Implement `GET /api/v1/products/leaderboard` returning top trending products.

## 🎨 Frontend Tasks
- [ ] Build Animated Upvote Button with optimist update counters.
- [ ] Build Top Trending Leaderboard Widget component.

## ✅ Definition of Done (DoD)
1. Product upvotes increment Redis Sorted Set scores in real-time.
2. Leaderboard updates dynamically based on vote count.
