# 📅 Day 26: Next.js Performance & Static ISR Audit

## 🎯 Day Objective
Optimize Next.js 16 build performance ensuring 100% static prerendering (`○ Static` ISR 60s) and image WebP compression.

---

## 🛠 Tasks
- [ ] Decouple dynamic `cookies()` from public landing page data fetching.
- [ ] Run Sharp image optimization script compressing webp images.
- [ ] Audit Lighthouse performance scores: target > 90 across Mobile and Desktop.

## ✅ Definition of Done (DoD)
1. Next.js `npm run build` outputs `○ (Static)` for public landing pages.
2. Lighthouse performance score > 90.
