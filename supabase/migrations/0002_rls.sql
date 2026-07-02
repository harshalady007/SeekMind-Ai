-- Row Level Security policies.
--
-- Access model:
--  * Signed-in users reach their own rows through these policies (anon key).
--  * Anonymous-session rows and public share-token reads are served by the
--    server through the service role, ALWAYS paired with explicit ownership /
--    token checks in lib/db/supabase-store.ts. The service role never runs in
--    the browser.
--  * space_members exists for future collaboration; select is limited to the
--    member themselves and the space owner manages rows.

alter table public.profiles enable row level security;
alter table public.anonymous_sessions enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.search_runs enable row level security;
alter table public.sources enable row level security;

-- profiles: owner only
create policy profiles_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- anonymous_sessions: no anon/user policies — service-role only.

-- spaces: owner, or member via space_members
create policy spaces_select on public.spaces
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.space_members m
      where m.space_id = id and m.user_id = auth.uid()
    )
  );
create policy spaces_insert on public.spaces
  for insert with check (owner_id = auth.uid());
create policy spaces_update on public.spaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy spaces_delete on public.spaces
  for delete using (owner_id = auth.uid());

-- space_members: users see their own membership; owners manage membership
create policy space_members_select on public.space_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.spaces s
      where s.id = space_id and s.owner_id = auth.uid()
    )
  );
create policy space_members_write on public.space_members
  for all using (
    exists (
      select 1 from public.spaces s
      where s.id = space_id and s.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.spaces s
      where s.id = space_id and s.owner_id = auth.uid()
    )
  );

-- threads: owner only. Public sharing is served server-side by share token;
-- is_public alone does NOT open the row to other signed-in users.
create policy threads_select on public.threads
  for select using (user_id = auth.uid());
create policy threads_insert on public.threads
  for insert with check (user_id = auth.uid());
create policy threads_update on public.threads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy threads_delete on public.threads
  for delete using (user_id = auth.uid());

-- messages / search_runs / sources: access follows thread ownership
create policy messages_select on public.messages
  for select using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );
create policy messages_insert on public.messages
  for insert with check (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

create policy search_runs_select on public.search_runs
  for select using (
    exists (select 1 from public.threads t where t.id = thread_id and t.user_id = auth.uid())
  );

create policy sources_select on public.sources
  for select using (
    exists (
      select 1
      from public.search_runs r
      join public.threads t on t.id = r.thread_id
      where r.id = search_run_id and t.user_id = auth.uid()
    )
  );
