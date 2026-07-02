import { getAnswerProvider } from "@/lib/ai";
import type { ConversationTurn } from "@/lib/ai/provider";
import { getEnv } from "@/lib/config/env";
import { getModeConfig } from "@/lib/config/modes";
import type {
  Identity,
  SearchResult,
  SearchStreamEvent,
  SourceRecord,
  ThreadRecord,
  UsageSummary,
} from "@/lib/core/types";
import { toPublicSource } from "@/lib/core/types";
import { stripInvalidCitations, validateCitations } from "@/lib/citations/validate";
import { getStore } from "@/lib/db";
import { normalizeQuery, tokenize } from "@/lib/retrieval/normalize";
import { processResults } from "@/lib/retrieval/pipeline";
import { getSearchProvider } from "@/lib/search";
import { ProviderError } from "@/lib/search/provider";
import type { StartSearchInput } from "@/lib/validation/schemas";
import { buildHistory } from "./history";
import { logger } from "@/lib/logging/logger";

export interface RunSearchOptions {
  identity: Identity;
  input: StartSearchInput;
  signal: AbortSignal;
}

/** Carry forward at most this many prior sources into a follow-up search. */
const CARRY_FORWARD_SOURCES = 4;

/**
 * The full search orchestration as an async generator of stream events.
 * Every stage is bounded: query counts and iterations by mode config and
 * env guardrails, total duration by the mode's maxDurationMs, external
 * calls by provider timeouts, and everything by the caller's AbortSignal.
 */
export async function* runSearch(
  options: RunSearchOptions,
): AsyncGenerator<SearchStreamEvent> {
  const { identity, input, signal } = options;
  const env = getEnv();
  const store = await getStore();
  const modeConfig = getModeConfig(input.mode);
  const startedAt = Date.now();
  const deadline = startedAt + modeConfig.maxDurationMs;

  const question = normalizeQuery(input.query);
  if (!question) {
    yield { type: "error", code: "bad_request", message: "Empty query." };
    return;
  }

  // ── Thread setup ──────────────────────────────────────────────────────
  let thread: ThreadRecord;
  let history: ConversationTurn[] = [];
  let previousSources: SourceRecord[] = [];
  let spaceInstructions: string | undefined;
  let effectiveQuestion = question;

  if (input.threadId) {
    const existing = await store.getThread(input.threadId, identity);
    if (!existing) {
      yield { type: "error", code: "not_found", message: "Thread not found." };
      return;
    }
    thread = existing;
    const messages = await store.listMessages(thread.id);
    if (input.regenerate) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser) {
        yield { type: "error", code: "bad_request", message: "Nothing to regenerate." };
        return;
      }
      effectiveQuestion = lastUser.content;
      // History excludes the turn being regenerated.
      history = buildHistory(
        messages.slice(
          0,
          messages.findIndex((m) => m.id === lastUser.id),
        ),
      );
    } else {
      history = buildHistory(messages);
    }
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      previousSources = (await store.listSourcesForMessage(lastAssistant.id)).slice(
        0,
        CARRY_FORWARD_SOURCES,
      );
    }
  } else {
    thread = await store.createThread({
      identity,
      title: question.slice(0, 120),
      searchMode: input.mode,
      answerLength: input.answerLength,
      spaceId: input.spaceId ?? null,
    });
  }

  if (thread.spaceId) {
    const space = await store.getSpace(thread.spaceId, identity);
    if (space?.customInstructions) spaceInstructions = space.customInstructions;
  }

  yield { type: "thread", threadId: thread.id, title: thread.title };

  if (!input.regenerate) {
    await store.createMessage({
      threadId: thread.id,
      role: "user",
      content: effectiveQuestion,
      status: "complete",
    });
  }

  const run = await store.createSearchRun({
    threadId: thread.id,
    messageId: null,
    provider: env.DEMO_MODE ? "mock" : env.SEARCH_PROVIDER,
    mode: input.mode,
    queries: [],
  });

  const usage: UsageSummary = {
    searchQueries: 0,
    sourcesConsidered: 0,
    sourcesSelected: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: 0,
  };

  const fail = async (
    code: string,
    _message: string,
    status: "error" | "cancelled" = "error",
  ) => {
    usage.durationMs = Date.now() - startedAt;
    await store.updateSearchRun(run.id, {
      status,
      durationMs: usage.durationMs,
      usageMetadata: usage,
      errorCode: String(code),
    });
  };

  try {
    // ── Planning ────────────────────────────────────────────────────────
    yield {
      type: "status",
      stage: "planning",
      message: "Breaking the question into focused searches…",
    };
    const planner = getAnswerProvider();
    const plan = await planner.planQueries(
      effectiveQuestion,
      input.mode,
      Math.min(modeConfig.maxQueries, env.RESEARCH_MAX_QUERIES),
      signal,
    );

    // ── Searching ───────────────────────────────────────────────────────
    const searchProvider = getSearchProvider();
    const executedQueries: string[] = [];
    const allResults: SearchResult[] = [];
    const queryBudget = Math.min(modeConfig.maxQueries, env.RESEARCH_MAX_QUERIES);

    const executeSearch = async (query: string): Promise<void> => {
      executedQueries.push(query);
      usage.searchQueries++;
      try {
        const results = await searchProvider.search({
          query,
          mode: input.mode,
          maxResults: modeConfig.resultsPerQuery,
          timeRange: input.timeRange,
          signal,
        });
        allResults.push(...results);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        // Partial failure tolerance: log, keep going with other queries.
        logger.warn("search_query_failed", {
          provider: searchProvider.name,
          kind: err instanceof ProviderError ? err.kind : "unknown",
        });
      }
    };

    const initialQueries = plan.queries.slice(0, queryBudget);
    yield {
      type: "status",
      stage: "searching",
      message:
        initialQueries.length === 1
          ? "Searching the web…"
          : `Running ${initialQueries.length} searches…`,
    };
    await Promise.all(initialQueries.map(executeSearch));

    // ── Research loop (bounded) ─────────────────────────────────────────
    if (modeConfig.iterative && plan.subquestions.length > 0) {
      for (
        let iteration = 1;
        iteration < env.RESEARCH_MAX_ITERATIONS &&
        executedQueries.length < queryBudget &&
        Date.now() < deadline;
        iteration++
      ) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        yield {
          type: "status",
          stage: "evaluating_evidence",
          message: `Reviewing evidence gaps (round ${iteration})…`,
        };
        const gaps = findEvidenceGaps(plan.subquestions, allResults);
        if (gaps.length === 0) break;
        const followUpQueries = gaps.slice(0, queryBudget - executedQueries.length);
        yield {
          type: "status",
          stage: "searching",
          message: `Searching ${followUpQueries.length} follow-up ${
            followUpQueries.length === 1 ? "angle" : "angles"
          }…`,
        };
        await Promise.all(followUpQueries.map(executeSearch));
      }
    }

    await store.updateSearchRun(run.id, { queries: executedQueries });

    if (allResults.length === 0 && previousSources.length === 0) {
      yield {
        type: "error",
        code: "no_results",
        message:
          "No usable sources were found for this question. Try rephrasing it or switching search modes.",
      };
      await fail("no_results", "no results");
      return;
    }

    // ── Ranking + selection ─────────────────────────────────────────────
    yield {
      type: "status",
      stage: "reading_sources",
      message: `Reading and ranking ${allResults.length} results…`,
    };
    const carryForward: SearchResult[] = previousSources.map((s) => ({
      url: s.url,
      title: s.title,
      snippet: s.snippet,
      content: s.content,
      providerScore: s.relevanceScore,
      publishedAt: s.publishedAt,
      author: s.author,
    }));
    const { sources, consideredCount } = processResults(
      effectiveQuestion,
      [...allResults, ...carryForward],
      input.mode,
    );
    usage.sourcesConsidered = consideredCount;
    usage.sourcesSelected = sources.length;

    const savedSources = await store.saveSources(run.id, sources);
    yield { type: "sources", sources: savedSources.map(toPublicSource) };

    // ── Answer generation ───────────────────────────────────────────────
    const assistantMessage = await store.createMessage({
      threadId: thread.id,
      role: "assistant",
      content: "",
      status: "streaming",
    });
    await store.updateSearchRun(run.id, { messageId: assistantMessage.id });

    yield { type: "status", stage: "writing", message: "Writing the answer…" };

    const answerProvider = getAnswerProvider();
    let answer = "";
    let model: string | null = null;

    try {
      for await (const event of answerProvider.streamAnswer({
        question: effectiveQuestion,
        mode: input.mode,
        answerLength: input.answerLength,
        sources,
        history,
        spaceInstructions,
        signal,
      })) {
        if (event.type === "token") {
          answer += event.text;
          yield { type: "token", text: event.text };
        } else {
          model = event.model;
          usage.inputTokens = event.usage.inputTokens;
          usage.outputTokens = event.usage.outputTokens;
        }
      }
    } catch (err) {
      // Persist whatever streamed before the failure, then rethrow.
      await store.updateMessage(assistantMessage.id, {
        content: answer,
        status: signal.aborted ? "cancelled" : "error",
      });
      throw err;
    }

    // ── Citation validation (+ one controlled repair) ───────────────────
    const validation = validateCitations(answer, sources);
    let repaired = false;
    if (!validation.valid) {
      const repairedAnswer = stripInvalidCitations(answer, sources);
      const revalidation = validateCitations(repairedAnswer, sources);
      if (revalidation.valid) {
        answer = repairedAnswer;
        repaired = true;
      }
      yield {
        type: "citation_validation",
        valid: false,
        invalidIds: validation.invalidIds,
        repaired,
      };
    } else {
      yield {
        type: "citation_validation",
        valid: true,
        invalidIds: [],
        repaired: false,
      };
    }

    usage.durationMs = Date.now() - startedAt;
    await store.updateMessage(assistantMessage.id, {
      content: answer,
      status: "complete",
      model,
      tokenUsage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    });
    await store.updateSearchRun(run.id, {
      status: "complete",
      durationMs: usage.durationMs,
      usageMetadata: usage,
    });

    yield { type: "usage", data: usage };
    yield { type: "complete", threadId: thread.id, messageId: assistantMessage.id };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      await fail("cancelled", "cancelled", "cancelled");
      yield { type: "error", code: "cancelled", message: "Search cancelled." };
      return;
    }
    const { code, message } = mapError(err);
    logger.error("search_run_failed", { code, threadId: thread.id });
    await fail(code, message);
    yield { type: "error", code, message };
  }
}

/**
 * Deterministic evidence-gap heuristic: a subquestion is a gap when the
 * collected results barely cover its keywords.
 */
export function findEvidenceGaps(
  subquestions: string[],
  results: SearchResult[],
): string[] {
  const corpusTokens = new Set(
    results.flatMap((r) => tokenize(`${r.title} ${r.snippet}`)),
  );
  return subquestions.filter((sq) => {
    const tokens = tokenize(sq).filter((t) => t.length > 3);
    if (tokens.length === 0) return false;
    const covered = tokens.filter((t) => corpusTokens.has(t)).length;
    return covered / tokens.length < 0.4;
  });
}

function mapError(err: unknown): {
  code: "provider_timeout" | "provider_error" | "rate_limited" | "internal_error";
  message: string;
} {
  if (err instanceof ProviderError) {
    if (err.kind === "timeout") {
      return {
        code: "provider_timeout",
        message: "An upstream provider timed out. Please try again.",
      };
    }
    if (err.kind === "rate_limited") {
      return {
        code: "rate_limited",
        message: "An upstream provider is rate limiting requests. Try again shortly.",
      };
    }
    return {
      code: "provider_error",
      message: "An upstream provider failed. Please try again.",
    };
  }
  return { code: "internal_error", message: "Something went wrong. Please try again." };
}
