# DeepFind — Deployment

DeepFind is a standard Next.js 15 app — Vercel-compatible out of the box, and
deployable to any Node 20+ host.

## Vercel

1. Import the repository into Vercel (framework preset: Next.js — detected
   automatically).
2. Set environment variables (Project → Settings → Environment Variables).
   Copy the list from `.env.example`; the minimum for live mode:

   ```
   NEXT_PUBLIC_APP_URL=https://<your-domain>
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # server-only, never NEXT_PUBLIC
   DEEPSEEK_API_KEY=...
   DEEPSEEK_MODEL=deepseek-chat
   TAVILY_API_KEY=...
   SEARCH_PROVIDER=tavily
   DEMO_MODE=false
   ```

3. Streaming: `/api/search` declares `maxDuration = 300`. On Vercel this
   requires a plan that allows long function durations (Hobby caps lower);
   research mode benefits from the full window. SSE works on Vercel functions
   without extra configuration.
4. Apply the Supabase migrations (see below) **before** the first deploy that
   points at the database.
5. In Supabase Auth → URL configuration, set the site URL to your domain and
   add `https://<your-domain>/auth/callback` to the redirect allowlist. If
   using Google login, configure the OAuth credentials in Supabase Auth →
   Providers → Google.

### Demo deployment (no keys)

The checked-in `vercel.json` pins `DEMO_MODE=true` and the mock search
provider so a fresh deployment works with zero secrets. **For live mode,
delete (or edit) `vercel.json`** and set the real keys as project
environment variables — values in `vercel.json` would otherwise override
the dashboard. Set only `DEMO_MODE=true` (and `NEXT_PUBLIC_APP_URL`). The full product runs on
fixtures with an always-visible “Demo data” badge and in-memory persistence.
Note that serverless instances each hold their own memory store — demo threads
may not survive across instances; for a stable demo, deploy a single Node
instance (see below).

## Self-hosted Node

```bash
npm ci
npm run build
NODE_ENV=production node_modules/.bin/next start -p 3000
```

Put a reverse proxy in front (Caddy/nginx). For SSE make sure proxy buffering
is off for `/api/search` (the route already sends `X-Accel-Buffering: no`, and
`Cache-Control: no-cache, no-transform`).

## Database migrations

With the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations in order
```

Without the CLI: paste `supabase/migrations/0001_init.sql` then
`0002_rls.sql` into the SQL editor and run them in order. Optionally run
`supabase/verify-rls.sql` to assert the authorization behaviour.

Migrations are idempotent-per-database (they create objects once); re-running
against an already-migrated database will error harmlessly on duplicates.

## Environment validation

The app validates all environment variables on first access
(`lib/config/env.ts`). Misconfiguration produces a `ConfigError` listing every
problem — visible at `/api/health` (HTTP 500 with `status: "config_error"`)
and in server logs — instead of an obscure crash mid-request.

## Health & observability

- `GET /api/health` → `{ status, demoMode, searchProvider, persistence, time }`
  — safe for uptime checks and load balancers.
- Server logs are single-line JSON (`lib/logging/logger.ts`): search lifecycle
  events, provider failures with error kinds, no secrets or user content.

## Scaling notes

- Rate limiting and the cancellation registry are in-memory per instance. For
  multi-instance deployments, back `lib/rate-limit/limiter.ts` with a shared
  store (the interfaces are deliberately small) before relying on the limits.
- The memory store is for demo/dev only; production persistence is Supabase.
