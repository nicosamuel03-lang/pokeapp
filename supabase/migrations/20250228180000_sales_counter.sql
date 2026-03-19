-- Compteur monotone par utilisateur (id Clerk) pour le quota free tier « Ventes utilisées ».
-- Indépendant de la table `users` ; jamais décrémenté quand une ligne est supprimée dans `sales`.

create table if not exists public.sales_counter (
  user_id text primary key,
  count integer not null default 0
);

comment on table public.sales_counter is 'Quota ventes free tier : +1 à chaque vente, pas de décrément au delete sur sales. user_id = Clerk user id.';

alter table public.sales_counter enable row level security;

-- RLS permissives (à resserrer en prod si besoin)
create policy "sales_counter_select_all"
  on public.sales_counter for select
  using (true);

create policy "sales_counter_insert_all"
  on public.sales_counter for insert
  with check (true);

create policy "sales_counter_update_all"
  on public.sales_counter for update
  using (true)
  with check (true);

create policy "sales_counter_delete_all"
  on public.sales_counter for delete
  using (true);
