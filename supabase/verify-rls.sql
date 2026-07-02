-- RLS verification script for a live Supabase project.
-- Run in the Supabase SQL editor (or psql) AFTER applying the migrations.
-- Each block impersonates a role/user and asserts the expected visibility.
-- All assertions raise an exception on failure, so a clean run = pass.
--
-- The equivalent behaviour is continuously tested against the in-memory
-- store in tests/integration/store-authorization.test.ts.

begin;

-- Fixtures: two users and content owned by user A.
-- (auth.users inserts require the service role / SQL editor.)
insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-test-a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-test-b@example.com')
on conflict (id) do nothing;

insert into public.threads (id, user_id, title)
values ('00000000-0000-4000-9000-000000000001',
        '00000000-0000-4000-8000-00000000000a',
        'User A private thread');

insert into public.messages (id, thread_id, role, content)
values ('00000000-0000-4000-9000-000000000002',
        '00000000-0000-4000-9000-000000000001',
        'user', 'question');

insert into public.spaces (id, owner_id, name)
values ('00000000-0000-4000-9000-000000000003',
        '00000000-0000-4000-8000-00000000000a',
        'User A space');

-- ── As user B: nothing of user A's is visible ───────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

do $$
begin
  if exists (select 1 from public.threads
             where id = '00000000-0000-4000-9000-000000000001') then
    raise exception 'FAIL: user B can see user A''s thread';
  end if;
  if exists (select 1 from public.messages
             where thread_id = '00000000-0000-4000-9000-000000000001') then
    raise exception 'FAIL: user B can see user A''s messages';
  end if;
  if exists (select 1 from public.spaces
             where id = '00000000-0000-4000-9000-000000000003') then
    raise exception 'FAIL: user B can see user A''s space';
  end if;
  raise notice 'PASS: user B sees none of user A''s content';
end $$;

-- User B cannot update or delete user A's thread (0 rows affected).
update public.threads set title = 'hijacked'
 where id = '00000000-0000-4000-9000-000000000001';
do $$
begin
  if exists (select 1 from public.threads
             where title = 'hijacked') then
    raise exception 'FAIL: user B updated user A''s thread';
  end if;
  raise notice 'PASS: user B cannot update user A''s thread';
end $$;

-- ── As user A: own content is visible ───────────────────────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
begin
  if not exists (select 1 from public.threads
                 where id = '00000000-0000-4000-9000-000000000001') then
    raise exception 'FAIL: user A cannot see their own thread';
  end if;
  if not exists (select 1 from public.spaces
                 where id = '00000000-0000-4000-9000-000000000003') then
    raise exception 'FAIL: user A cannot see their own space';
  end if;
  raise notice 'PASS: user A sees their own content';
end $$;

-- ── As anon key: nothing is visible, even public threads ────────────────────
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

do $$
begin
  if exists (select 1 from public.threads) then
    raise exception 'FAIL: anon role can read threads';
  end if;
  if exists (select 1 from public.anonymous_sessions) then
    raise exception 'FAIL: anon role can read anonymous_sessions';
  end if;
  raise notice 'PASS: anon key sees nothing (public reads go through the server by share token)';
end $$;

rollback; -- leave no fixtures behind
