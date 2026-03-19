-- Compteur monotone « Ventes utilisées » (free tier) : +1 par vente, jamais diminué à la suppression d’une ligne dans sales.
alter table if exists public.users
  add column if not exists total_sales_count integer not null default 0;

comment on column public.users.total_sales_count is 'Nombre cumulé de ventes enregistrées (+1 par INSERT sales). Ne pas décrémenter au DELETE sur sales.';
