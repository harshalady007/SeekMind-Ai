# DeepFind — Search & Retrieval Pipeline

Every stage is a small module in `lib/retrieval/` (pure, synchronous, unit
tested) or `lib/orchestrator/` (async, bounded, cancellable).

## Stages

1. **Validate & normalize the query** — `normalizeQuery`
   (`lib/retrieval/normalize.ts`): strip control characters, collapse
   whitespace, clamp to 2,000 chars. Zod re-validates at the API boundary.

2. **Determine mode** — `lib/config/modes.ts` holds all tuning in one place per
   mode: query counts, results per query, source caps, scoring weights, recency
   half-life, per-source and total context budgets, iteration flag, max
   duration.

   | Mode     | Queries         | Candidates | Sources | Recency ½-life | Iterative |
   | -------- | --------------- | ---------- | ------- | -------------- | --------- |
   | Quick    | ≤3              | 6/query    | 4–8     | 180 d          | no        |
   | Research | ≤8 (env-capped) | 6/query    | 6–12    | 365 d          | yes       |
   | Academic | ≤4              | 8/query    | 4–10    | 4 y            | no        |
   | News     | ≤3              | 8/query    | 4–8     | 3 d            | no        |

3. **Query planning** — the answer provider doubles as `QueryPlanner`. Live:
   one small Anthropic completion returning strict JSON
   (`{queries, subquestions}`), validated and capped; any failure falls back to
   the raw question. Demo/mock: deterministic heuristics.

4. **Web search** — `SearchProvider.search` per focused query in parallel.
   Tavily: `POST /search` with `topic` (news vs general), `time_range` for news,
   `AbortSignal.timeout` + caller signal, typed `ProviderError`s
   (auth/rate/timeout/transient/fatal), retry with exponential backoff for
   retryable kinds only. A failed individual query is logged and skipped —
   partial evidence still produces an answer.

5. **Normalize metadata** — `normalizeResult`: clean titles/snippets/authors,
   clamp lengths, parse dates to ISO (rejecting absurd values), clamp provider
   scores to [0, 1].

6. **Canonicalize URLs** — `canonicalizeUrl`: https, lowercase host, `www.`
   stripped, fragments and tracking params removed (utm_*, gclid, fbclid, …),
   remaining params sorted, duplicate slashes collapsed, trailing slash
   dropped. Non-http(s) URLs are rejected outright.

7. **Dedupe** — exact canonical-URL duplicates plus near-duplicate titles
   (Jaccard ≥ 0.85 on token sets — collapses syndicated copies). Results are
   pre-sorted by provider score so the strongest copy survives.

8. **Filter** — blocklisted domains, non-http(s) schemes, and results with
   neither keyword overlap nor provider-score signal.

9. **Score** — weighted blend per mode:
   `semanticRelevance` (provider embedding score, keyword fallback) ·
   `keywordOverlap` (query-token coverage) · `sourceQuality` (domain heuristics:
   .gov/.edu/arxiv/doi/major outlets > generic) · `recency` (exponential decay
   with the mode's half-life; unknown dates score a neutral 0.3).

10. **Select** — take top-ranked within the mode's source cap **and** total
    context budget (per-source content clamped first). Selected sources get
    stable 1-based citation numbers in rank order, retrieval timestamps,
    favicon URLs, and academic metadata (DOI regex, preprint/academic domain
    flags, year).

11. **Generate** — `AnswerProvider.streamAnswer` receives only the selected
    evidence. The system prompt (see `lib/ai/prompts.ts`) restricts citations
    to the listed ids, forbids invented sources/quotes, requires
    insufficient-evidence honesty, mode-specific structure (research report
    sections, news dating discipline, preprint labeling), and treats `<source>`
    content as untrusted data (prompt-injection defense).

12. **Validate citations** — `validateCitations` compares every `[n]` against
    the stored set; on failure one repair pass strips unknown ids, the result is
    re-validated and persisted, and a `citation_validation` event tells the UI
    to show a visible warning. Answers with no repairable state keep the
    warning banner rather than silently rendering bad ids.

13. **Persist** — thread, user message, search run (queries, status, duration,
    usage, error code), sources (with citation numbers), assistant message
    (content, status, model, token usage).

14. **Stream** — typed `SearchStreamEvent`s over SSE:
    `status(planning|searching|reading_sources|evaluating_evidence|writing)`,
    `thread`, `sources`, `token`*, `citation_validation`, `usage`, `complete` |
    `error`.

## Research loop (bounded)

```
plan(question) → {queries, subquestions}
search initial queries (parallel)
for iteration < RESEARCH_MAX_ITERATIONS and queries < RESEARCH_MAX_QUERIES
    and now < deadline:
  gaps = subquestions whose keywords are <40% covered by collected evidence
  if none: break
  search the gap subquestions (bounded by remaining query budget)
dedupe + rank combined evidence → structured report
```

Guardrails: `RESEARCH_MAX_ITERATIONS`, `RESEARCH_MAX_QUERIES` (env),
`maxDurationMs` per mode, `AbortController` cancellation end-to-end, graceful
partial results when individual searches fail, and no unbounded recursion — the
loop is a simple counted `for`.

## Follow-ups

Fresh search every time (current information), plus up to 4 of the previous
answer's sources re-entered into ranking. History is capped and summarized
(`lib/orchestrator/history.ts`) — never an unbounded conversation replay.
