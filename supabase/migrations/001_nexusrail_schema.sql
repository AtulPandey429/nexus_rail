-- NexusRail Master PostgreSQL Schema DDL
-- Compatible with Supabase Free Tier

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS & AUTH
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  password_hash text,
  wallet_address text unique,
  xrpl_address text unique,
  privy_did text unique,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 2. PRODUCTS & INVENTORY
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  title text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  category text not null,
  stock_quantity integer default 0 check (stock_quantity >= 0),
  active boolean default true,
  upvotes_count integer default 0 check (upvotes_count >= 0),
  created_at timestamptz default now()
);

-- Index for instant trending/active product queries
create index if not exists idx_products_active_sort on public.products (active, upvotes_count desc);

-- 3. ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  order_number text unique not null,
  total_cents integer not null check (total_cents >= 0),
  payment_rail text not null check (payment_rail in ('STRIPE', 'WALLET', 'XRPL', 'STELLAR')),
  payment_address text,
  payment_memo text,
  status text default 'PENDING' check (status in ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED')),
  ipfs_cid text,
  created_at timestamptz default now()
);

-- 4. DOUBLE-ENTRY WALLET TRANSACTIONS
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  currency text not null check (currency in ('USD', 'XRP', 'XLM')),
  amount_cents bigint not null check (amount_cents > 0),
  type text not null check (type in ('CREDIT', 'DEBIT')),
  reference_id text,
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz default now()
);

-- 5. VERIFIED PRODUCT REVIEWS & SHOWDOWNS
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  comment text not null,
  verified_purchase boolean default true,
  created_at timestamptz default now()
);

-- SEED MOCK PRODUCT DATA
insert into public.products (sku, title, description, price_cents, category, stock_quantity, active, upvotes_count)
values 
  ('PROD-XRP-KIT', 'XRPL Starter Validator Node Hardware', 'Turnkey XRPL validator node hardware kit with pre-loaded ledger sync module.', 49900, 'hardware', 25, true, 142),
  ('PROD-XLM-PASS', 'Stellar Soroban Smart Contract License', 'Lifetime developer key for automated Soroban smart contract deployment suite.', 19900, 'software', 100, true, 98),
  ('PROD-AGENT-PRO', 'NexusRail AI Agent Desk Pro Key', 'High-throughput Groq & Gemini 2.0 Flash agent desk license key with Redis proposal locks.', 2990, 'subscription', 500, true, 310)
on conflict (sku) do nothing;
