-- DeepFind initial schema
-- Run with: supabase db push   (or psql -f against your database)

create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_mode text not null default 'quick'
    check (default_mode in ('quick', 'research', 'academic', 'news')),
  default_answer_length text not null default 'balanced'
    check (default_answer_length in ('concise', 'balanced', 'detailed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── anonymous sessions ──────────────────────────────────────────────────────
create table public.anonymous_sessions (
  id text primary key check (id ~ '^anon_[A-Za-z0-9_-]{8,64}$'),
  fingerprint_hash text,
  search_count integer not null default 0,
  last_search_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── spaces (workspaces) ─────────────────────────────────────────────────────
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  custom_instructions text not null default '' check (char_length(custom_instructions) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spaces_owner_idx on public.spaces (owner_id, updated_at desc);

-- Designed for future collaboration; the initial UI only uses the owner row.
create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- ── threads ─────────────────────────────────────────────────────────────────
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  anonymous_session_id text references public.anonymous_sessions (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  search_mode text not null default 'quick'
    check (search_mode in ('quick', 'research', 'academic', 'news')),
  answer_length text not null default 'balanced'
    check (answer_length in ('concise', 'balanced', 'detailed')),
  is_saved boolean not null default false,
  is_public boolean not null default false,
  share_token text unique check (share_token ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint threads_owner_present check (
    user_id is not null or anonymous_session_id is not null
  )
);
create index threads_user_idx on public.threads (user_id, updated_at desc);
create index threads_anon_idx on public.threads (anonymous_session_id, updated_at desc);
create index threads_space_idx on public.threads (space_id);
create index threads_share_idx on public.threads (share_token) where is_public;

-- ── messages ────────────────────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  status text not null default 'complete'
    check (status in ('streaming', 'complete', 'error', 'cancelled')),
  model text,
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

-- ── search runs ─────────────────────────────────────────────────────────────
create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  provider text not null,
  mode text not null check (mode in ('quick', 'research', 'academic', 'news')),
  queries jsonb not null default '[]'::jsonb,
  status text not null default 'running'
    check (status in ('running', 'complete', 'error', 'cancelled')),
  duration_ms integer,
  usage_metadata jsonb,
  error_code text,
  created_at timestamptz not null default now()
);
create index search_runs_thread_idx on public.search_runs (thread_id, created_at);
create index search_runs_message_idx on public.search_runs (message_id);

-- ── sources ─────────────────────────────────────────────────────────────────
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid not null references public.search_runs (id) on delete cascade,
  citation_number integer not null check (citation_number >= 1),
  url text not null,
  canonical_url text not null,
  domain text not null,
  title text not null,
  snippet text not null default '',
  content text,
  author text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  favicon_url text,
  relevance_score real not null default 0,
  quality_score real not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (search_run_id, citation_number)
);
create index sources_run_idx on public.sources (search_run_id, citation_number);

-- ── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();
create trigger threads_updated_at before update on public.threads
  for each row execute function public.set_updated_at();

-- ── auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
