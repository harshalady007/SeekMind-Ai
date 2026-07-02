# DeepFind — Implementation Plan

DeepFind is an AI answer engine: users ask a question, the server searches the live
web, an LLM writes a streamed answer grounded exclusively in the retrieved sources,
and every factual claim carries an inline citation chip that maps to a real source
card. Threads persist, support follow-ups, and can be organized into workspaces.

## Environment findings

- Fresh, empty git repository on branch `claude/deepfind-ai-engine-fizizf`.
- Node 22, npm 10. No Supabase project, Anthropic key, or Tavily key available in
  this environment — live-mode code paths are implemented and typed, but local
  verification (unit, integration, e2e) runs against **demo mode** and the mock
  providers, exactly as the spec's testing rules require.

## Stack (exact versions in `package.json`)

| Concern    | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19, strict TypeScript 5.9   |
| Styling    | Tailwind CSS 4, custom design tokens, Radix UI primitives  |
| Data       | Supabase Postgres + RLS; in-memory store when unconfigured |
| Auth       | Supabase (magic link + Google); demo sign-in in demo mode  |
| LLM        | @anthropic-ai/sdk (streaming Messages API)                 |
| Search     | Tavily REST API behind a `SearchProvider` interface        |
| Validation | Zod 4                                                      |
| Rendering  | react-markdown + remark-gfm (no raw HTML, sanitized links) |
| Streaming  | Server-Sent Events over a POST fetch stream                |
| Tests      | Vitest (unit + integration), Playwright (e2e)              |

No LangChain: the retrieval pipeline is small, custom, and transparent so citation
and ranking behaviour stays auditable.

## Architecture at a glance

```
Browser ── POST /api/search (SSE) ──► orchestrator
                                        ├─ mode config (quick/research/academic/news)
                                        ├─ query planner (LLM or heuristic)
                                        ├─ SearchProvider (tavily | mock)
                                        ├─ retrieval pipeline: normalize → canonicalize
                                        │    → dedupe → filter → score → select
                                        ├─ AnswerProvider (anthropic | mock) streams tokens
                                        ├─ citation validation (+ one repair pass)
                                        └─ DataStore (supabase | memory) persists
                                             thread / messages / search_run / sources
```

Key abstractions:

- `SearchProvider.search(SearchRequest): Promise<SearchResult[]>`
- `AnswerProvider.streamAnswer(AnswerRequest): AsyncIterable<AnswerEvent>`
- `DataStore` — one interface, two implementations (Supabase, in-memory). Demo mode
  and missing-Supabase configurations run on the memory store; everything else is
  identical, so the whole UI flow is testable without external services.
- Typed SSE protocol `SearchStreamEvent` shared between server and client.

## Milestones

1. **Foundation** — scaffold, strict TS, Tailwind tokens (graphite / warm off-white /
   electric amber, grid texture), ESLint/Prettier/Vitest/Playwright config, Zod-validated
   env with fail-fast startup, demo-mode flag and badge.
2. **Retrieval + citation engine** — provider interfaces and implementations
   (tavily, anthropic, mocks), pipeline modules, citation extract/validate/repair,
   streaming protocol, rate limiting, share tokens; unit tests for each module.
3. **Search experience** — landing page (composer, modes, suggestions), thread page
   (streamed markdown, citation chips ↔ source cards, activity panel, follow-ups,
   cancel/retry/copy/regenerate).
4. **Persistence + auth** — Supabase migrations with RLS, generated DB types,
   store implementations, magic-link/Google auth, anonymous sessions, library.
5. **Spaces + sharing + settings** — workspace CRUD with custom instructions that
   feed the system prompt, secure share tokens, settings/preferences.
6. **Research modes** — bounded research loop with progress events and guardrails,
   academic metadata + BibTeX, news recency weighting + time ranges.
7. **Hardening** — e2e journeys, a11y pass, security review, docs, full check run.

Every milestone ends with `npm run typecheck && npm run lint && npm run test`
(plus integration/e2e once they exist) and fixes before moving on.

## Risks / decisions

- **No live keys here** → mock providers are first-class and demo mode is a real,
  clearly-badged product surface, not a stubbed UI.
- **Rate limiting** is in-memory per server instance (documented limitation; a
  Redis/upstash adapter is the obvious next step for multi-instance deploys).
- **Citation integrity** is enforced server-side: unknown IDs trigger one repair
  attempt, then stripping + a visible warning event; never silently rendered.
- **SSRF**: the server only ever fetches provider endpoints; source URLs come from
  the search provider, are schema-validated (http/https), and are only used as
  outbound `<a target="_blank" rel="noopener noreferrer">` links.
