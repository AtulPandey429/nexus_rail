-- Tables the API writes. Run this in the Supabase SQL editor after 001.
-- Same schema in development and production. Credentials change, not this file.

do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in ('PENDING', 'PAID', 'FULFILLING', 'FULFILLED', 'FAILED', 'CANCELLED', 'REFUNDED'));

alter table public.orders add column if not exists stripe_session_id text unique;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku text not null,
  qty integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sku text not null,
  qty integer not null check (qty > 0),
  unique (user_id, sku)
);

create table if not exists public.auth_nonces (
  wallet_address text primary key,
  nonce text not null,
  expires_at timestamptz not null
);

create table if not exists public.guide_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  suggested_skus text[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.showdowns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  item_a_sku text not null,
  item_b_sku text not null,
  votes_a integer not null default 0 check (votes_a >= 0),
  votes_b integer not null default 0 check (votes_b >= 0)
);

create table if not exists public.proposals (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  payload jsonb not null,
  status text not null check (status in ('PROPOSED', 'CONFIRMED', 'EXPIRED')),
  expires_at timestamptz not null
);

create or replace function public.apply_wallet_entry(
  p_user_id uuid,
  p_currency text,
  p_amount bigint,
  p_type text,
  p_reference text
) returns public.wallet_transactions
language plpgsql
as $$
declare
  current_balance bigint;
  next_balance bigint;
  row public.wallet_transactions;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_currency));

  select coalesce(sum(case when type = 'CREDIT' then amount_cents else -amount_cents end), 0)
    into current_balance
  from public.wallet_transactions
  where user_id = p_user_id and currency = p_currency;

  if p_type = 'DEBIT' and current_balance < p_amount then
    raise exception 'Insufficient % balance', p_currency;
  end if;

  next_balance := case when p_type = 'CREDIT' then current_balance + p_amount else current_balance - p_amount end;

  insert into public.wallet_transactions (user_id, currency, amount_cents, type, reference_id, balance_after)
  values (p_user_id, p_currency, p_amount, p_type, p_reference, next_balance)
  returning * into row;

  return row;
end;
$$;
