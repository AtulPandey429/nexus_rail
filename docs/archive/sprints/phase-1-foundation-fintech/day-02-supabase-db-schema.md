# 📅 Day 02: Supabase PostgreSQL DDL & Database Migrations

## 🎯 Day Objective
Apply composite indexes and database tables for `users`, `products`, `orders`, `wallet_transactions`, and `product_reviews` in Supabase PostgreSQL.

---

## 🛠 Backend Tasks
- [ ] Create SQL migration file `supabase/migrations/001_nexusrail_schema.sql`.
- [ ] Implement `users` table with email, password hash, wallet addresses (`xrpl_address`, `privy_did`).
- [ ] Implement `products` table with SKU, price in cents, stock quantity, and active status.
- [ ] Implement `orders` table with payment rail enum (`STRIPE`, `WALLET`, `XRPL`, `STELLAR`), status, and IPFS CID.
- [ ] Implement `wallet_transactions` table with ledger type (`CREDIT`, `DEBIT`) and balance checkpoints.
- [ ] Add composite performance index `idx_products_active_sort` on `(active, upvotes_count DESC)`.

## 🎨 Frontend Tasks
- [ ] Setup Supabase JS client singleton in `apps/web/src/lib/supabase/client.ts`.
- [ ] Set up server-side Supabase client in `apps/web/src/lib/supabase/server.ts` bypassing dynamic cookies for static ISR.
- [ ] Generate TypeScript database types using `supabase gen types typescript`.

## 🗄 Database DDL Reference
```sql
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  title text not null,
  description text,
  price_cents integer not null,
  category text not null,
  stock_quantity integer default 0,
  active boolean default true,
  upvotes_count integer default 0
);
```

## ✅ Definition of Done (DoD)
1. All 5 tables created successfully in Supabase PostgreSQL database.
2. `supabase gen types` generates strong TypeScript definitions.
3. Indexes verified using `EXPLAIN ANALYZE` in Supabase SQL editor.
