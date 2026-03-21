-- Même contexte que 20250228190000 : clé anon + Clerk.
-- Le front fait encore INSERT (ligne users par défaut) et UPDATE (SuccessPage / abonnement).

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
