# DeepFind — Security Review

Threats considered, mitigations implemented, and honest limitations.

## Prompt injection from retrieved webpages

- Source content is fenced in `<source>` tags and the system prompt explicitly
  instructs the model to treat everything inside as untrusted data, never as
  instructions (`lib/ai/prompts.ts`).
- The model may cite only the enumerated ids; server-side citation validation
  strips anything else, so injected "cite [99]"-style content cannot fabricate
  source references.
- The server never fetches URLs suggested by the LLM — only URLs returned by
  the configured search provider enter the pipeline (SSRF section below).
- Limitation: prompt injection cannot be fully prevented at the prompt layer;
  the enforcement that matters (citations, no tool access, no URL fetching) is
  in code.

## XSS in generated Markdown

- `react-markdown` renders to React elements and does **not** render raw HTML
  (no `rehype-raw`), so HTML in model output or source snippets is inert text.
- All link/image URLs pass `sanitizeMarkdownUrl` — only absolute http(s) URLs
  survive; `javascript:`, `data:`, `vbscript:`, protocol-relative and relative
  tricks are neutralized (`lib/security/url.ts`, unit tested).
- External links render with `target="_blank" rel="noopener noreferrer"`.
- Global security headers: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, restrictive `Referrer-Policy` and
  `Permissions-Policy` (next.config.ts).

## Server-side request forgery

- The server performs outbound requests only to fixed provider endpoints
  (`api.tavily.com`, Anthropic API, Supabase project URL).
- Retrieved source URLs are _data_ — validated http(s), stored, and rendered as
  outbound anchors for the user's browser. The server never fetches them, and
  never fetches anything the LLM asks for.
- Favicon URLs are constructed server-side from the parsed domain against a
  single known favicon service.

## Secrets

- `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are read
  only in server modules; none are `NEXT_PUBLIC_`. The browser client uses only
  the anon key.
- The structured logger's contract (`lib/logging/logger.ts`) is ids and enums —
  never headers, cookies, keys, or raw user content. Provider error mapping is
  verified (unit test) not to echo API keys.

## Authorization / unauthorized database access

- RLS enabled on every table (`supabase/migrations/0002_rls.sql`): owners only
  for profiles/threads/messages/runs/sources; spaces honor owner + membership;
  `anonymous_sessions` has no anon/user policies at all (service-role only).
- The service-role client exists only server-side, and every store query adds
  explicit ownership filters mirroring RLS (needed because anonymous-session
  ownership can't be expressed via `auth.uid()`).
- Public threads are readable **only** via `/share/[token]` — the thread id
  itself never grants access to non-owners (enforced in the API route and
  covered by e2e tests).
- Authorization scenarios are continuously tested against the memory store
  (`tests/integration/store-authorization.test.ts`) and by e2e tests; a live
  SQL verification script is provided (`supabase/verify-rls.sql`).
- Deleting a user deletes their threads (cascading to messages/runs/sources),
  spaces and profile (`DELETE /api/profile`).

## Share tokens

- 24 random bytes via `crypto.randomBytes` → 32-char base64url ≈ 192 bits of
  entropy; shape-validated before any lookup; unsharing nulls the token so old
  links die; tokens are never exposed to non-owners through the thread API.

## Open redirects

- `next` parameters on login/callback accept only same-origin relative paths
  (`startsWith("/") && !startsWith("//")`); everything else falls back to `/`.

## Oversized input / abuse / repeated expensive requests

- Zod caps every input: query 2,000 chars, follow-ups 2,000, titles 200,
  instructions 4,000, list limits ≤ 50, etc.
- Per-IP sliding-window limits (general + search-specific), per-user daily
  limit, anonymous lifetime allowance, per-identity concurrency gate, provider
  timeouts, retry only for transient/rate-limit errors with a small
  exponential-backoff cap.
- **Limitations (documented, by design):** limiters are in-memory and
  per-instance — they reset on deploy and do not coordinate across serverless
  instances. `x-forwarded-for` is spoofable unless a trusted proxy sets it.
  Anonymous allowances reset with cleared cookies. These are cost speed bumps,
  not bot defense; a shared store (Redis/Upstash) and a CAPTCHA/turnstile at
  the limit screens are the hardening path.

## Malicious file names / uploads

- The application accepts no file uploads in its current scope; Supabase
  Storage is unused. If added, names must be regenerated server-side (uuid) and
  content-type validated.

## Cookies & sessions

- `df_anon` and `df_demo_user` are httpOnly, SameSite=Lax, Secure in
  production. Supabase session cookies are managed by `@supabase/ssr` and
  refreshed in middleware. Demo sign-in is disabled whenever real auth is
  configured.
