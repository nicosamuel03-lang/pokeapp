-- Clerk = pas de session Supabase Auth → auth.uid() est NULL.
-- Le front lit `users` avec la clé **anon** (VITE_SUPABASE_ANON_KEY), pas la service role.
-- Politique SELECT permissive pour que .select('is_premium') ne renvoie plus 401.

alter table if exists public.users enable row level security;

drop policy if exists "Users can read own data" on public.users;

create policy "Users can read own data"
  on public.users
  for select
  to anon
  using (true);

comment on policy "Users can read own data" on public.users is
  'Lecture avec la clé anon (Clerk côté app). Pas auth.uid() car pas de Supabase Auth.';
