-- Table des ventes par utilisateur (user_id = Clerk user id).
-- L'app filtre toujours par user_id. Politiques RLS permissives pour anon afin que l'app fonctionne
-- avec la clé anon ; en production, restreindre par JWT Clerk si disponible.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  product_id text not null,
  product_name text not null,
  image text,
  buy_price numeric not null,
  sale_price numeric not null,
  quantity integer not null,
  sale_date text not null,
  profit numeric not null,
  created_at timestamptz default now()
);

create index if not exists idx_sales_user_id on public.sales (user_id);
create index if not exists idx_sales_sale_date on public.sales (sale_date desc);

comment on table public.sales is 'Historique des ventes par utilisateur (Clerk user_id).';

alter table public.sales enable row level security;

create policy "Allow anon select sales"
  on public.sales for select to anon using (true);

create policy "Allow anon insert sales"
  on public.sales for insert to anon with check (true);

create policy "Allow anon update sales"
  on public.sales for update to anon using (true) with check (true);

create policy "Allow anon delete sales"
  on public.sales for delete to anon using (true);
