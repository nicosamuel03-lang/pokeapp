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

-- Optional: enable RLS and allow read for authenticated users (adjust to your auth strategy)
-- alter table public.users enable row level security;
-- create policy "Users can read own row" on public.users for select using (auth.uid()::text = id);
