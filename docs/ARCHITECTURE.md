# DeepFind — Architecture

## Overview

DeepFind is a Next.js 15 App Router application with a thin, typed server core.
The design goal is that the citation-critical path — search → rank → select →
generate → validate → persist → stream — is made of small, pure, individually
tested modules rather than one large handler.

```text
Request (POST /api/search, SSE)
  └─ route handler            app/api/search/route.ts
       ├─ env validation      lib/config/env.ts        (fail-fast, cached)
       ├─ identity            lib/auth/session.ts      (Supabase user | demo user | anon cookie)
       ├─ usage controls      lib/rate-limit/*         (IP window, daily, concurrency)
       └─ orchestrator        lib/orchestrator/run-search.ts (async generator)
            ├─ planning       AnswerProvider.planQueries (LLM json / heuristic fallback)
            ├─ searching      SearchProvider.search      (tavily | mock, timeout+retry)
            ├─ research loop  bounded by env + mode config, gap heuristic
            ├─ pipeline       lib/retrieval/pipeline.ts  (pure)
            ├─ generation     AnswerProvider.streamAnswer (anthropic | mock)
            ├─ citations      lib/citations/*            (validate + one repair pass)
            └─ persistence    lib/db/* (DataStore: supabase | memory)
```

## Key decisions

### 1. Provider interfaces with first-class mocks

`SearchProvider` and `AnswerProvider` (+ optional `QueryPlanner`) are tiny
interfaces selected once from validated env config. The mock implementations
are _product surfaces_ (demo mode), not test shims — they synthesize answers
from the actual fixture sources with real citation ids, so demo mode exercises
the same validation, persistence and streaming code as live mode. A
`BraveSearchProvider` would be one new file plus one case in
`lib/search/index.ts`.

### 2. `DataStore` abstraction instead of direct DB calls

One interface, two implementations:

- `MemoryStore` — demo mode / Supabase unconfigured. Enforces the same
  ownership rules the RLS policies encode, so authorization tests run
  everywhere.
- `SupabaseStore` — server-only service-role client with explicit ownership
  filters on every query (anonymous-session ownership cannot be expressed via
  `auth.uid()`), while RLS stays enabled as defense-in-depth for any anon-key
  access.

### 3. Orchestrator as an async generator

`runSearch()` yields typed `SearchStreamEvent`s. The route handler is just a
translator from the generator to SSE frames. Benefits: trivially unit/
integration testable without HTTP, cancellation flows naturally through one
`AbortSignal`, and the event protocol is a single shared type used by server
and client.

### 4. Citation integrity as data flow, not prompting alone

The prompt constrains the model, but enforcement is code:
`extractCitedIds` → `validateCitations` → (if invalid) `stripInvalidCitations`
→ re-validate → persist repaired text → emit `citation_validation` event.
The client renders chips only for ids present in the delivered source set, so
an invalid id can never become a clickable chip even if it slipped through.

### 5. Streaming protocol

SSE over a POST fetch (readable stream) rather than `EventSource`, because the
request carries a JSON body and auth cookies. The client parser
(`lib/streaming/events.ts`) is incremental and tolerant of chunk boundaries and
malformed frames. Terminal states: `complete`, `error`; a stream that ends
without one is surfaced to the user as a disconnect with retry.

### 6. Identity model

- Supabase user (when configured) via `@supabase/ssr` cookies.
- Anonymous session: `df_anon` httpOnly cookie minted by middleware, used for
  the free-search allowance and thread ownership.
- Demo user: `df_demo_user` cookie, only honored when real auth is unavailable
  (demo mode or Supabase unconfigured), clearly labelled in the UI.

### 7. Follow-up context strategy

`lib/orchestrator/history.ts`: always keep the thread's original question, keep
the last 6 completed messages verbatim (truncated per message), compress the
middle into a deterministic one-line-per-turn summary, and merge consecutive
roles to satisfy the Messages API. Up to 4 of the previous answer's sources are
carried into the new retrieval pass and re-ranked alongside fresh results.

## Data model

See `supabase/migrations/0001_init.sql`. Highlights:

- `threads.user_id` / `threads.anonymous_session_id` — exactly one owner kind
  must be present (check constraint). `space_id` is `on delete set null` so
  deleting a workspace never deletes research.
- `sources` are immutable rows keyed to a `search_run`, with a unique
  `(search_run_id, citation_number)` so citations stay stable forever.
- `space_members` exists (role: owner/editor/viewer) for future collaboration;
  the UI currently uses only the owner row, and RLS already honors membership
  for space reads.
- `updated_at` triggers + a signup trigger creating `profiles` rows.

## Directory map

```text
app/                    routes (server components + route handlers)
components/             answer/ citations-adjacent UI, layout, library,
                        search, settings, sources, spaces, thread, ui
lib/
  ai/                   providers (anthropic, mock), prompts, planner types
  api/                  response helpers, error codes → HTTP status
  auth/                 identity resolution, supabase clients
  citations/            extract, validate/repair, linkify, bibtex
  client/               typed fetch wrappers for the browser
  config/               env validation, per-mode retrieval config
  core/                 shared domain types + stream protocol
  db/                   DataStore, memory store, supabase store, DB types
  logging/              structured JSON logger
  orchestrator/         run-search generator, history, cancel registry
  rate-limit/           sliding window, daily, concurrency
  retrieval/            normalize, canonicalize, dedupe, score, select, pipeline
  search/               providers (tavily, mock), fixtures
  security/             share tokens, URL safety
  streaming/            SSE encode/parse, client hook
  validation/           zod schemas for every API input
supabase/migrations/    0001 schema, 0002 RLS (+ verify-rls.sql)
tests/                  unit / integration / e2e (+ axe audit)
```
