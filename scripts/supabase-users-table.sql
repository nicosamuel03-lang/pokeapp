-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create the users table for premium status.
-- Table: users
-- Columns: id (text, PK, Clerk user ID), is_premium (boolean, default false), created_at (timestamptz, default now)

create table if not exists public.users (
  id text primary key,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  stripe_subscription_id text
);

alter table public.users
  add column if not exists stripe_subscription_id text;

-- RLS + Clerk : le front utilise la clé ANON (pas Supabase Auth → auth.uid() est NULL).
-- Exécuter aussi les migrations dans supabase/migrations/20250228190000_* et 20250228190100_*
-- ou coller ci-dessous dans SQL Editor.

alter table public.users enable row level security;

drop policy if exists "Users can read own data" on public.users;
create policy "Users can read own data"
  on public.users
  for select
  to anon
  using (true);

drop policy if exists "Allow anon insert users" on public.users;
drop policy if exists "Allow anon update users" on public.users;

create policy "Allow anon insert users"
  on public.users
  for insert
  to anon
  with check (true);

create policy "Allow anon update users"
  on public.users
  for update
  to anon
  using (true)
  with check (true);
