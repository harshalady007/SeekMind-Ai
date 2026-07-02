import type { SearchMode } from "@/lib/core/types";
import type {
  AnswerEvent,
  AnswerProvider,
  AnswerRequest,
  QueryPlan,
  QueryPlanner,
} from "./provider";

/**
 * Deterministic mock answer provider for demo mode and tests.
 * Streams a Markdown answer synthesized from the actual supplied sources,
 * citing only their real ids — so citation validation exercises the same
 * code paths as live mode.
 */
export class MockAnswerProvider implements AnswerProvider, QueryPlanner {
  readonly name = "mock";

  constructor(private readonly tokenDelayMs: number = 8) {}

  async *streamAnswer(input: AnswerRequest): AsyncIterable<AnswerEvent> {
    const text = buildMockAnswer(input);
    // Stream in word-ish chunks to exercise real streaming behaviour.
    const chunks = text.match(/\S+\s*/g) ?? [text];
    let outputTokens = 0;
    for (const chunk of chunks) {
      if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (this.tokenDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.tokenDelayMs));
      }
      outputTokens++;
      yield { type: "token", text: chunk };
    }
    yield {
      type: "done",
      model: "deepfind-demo",
      usage: { inputTokens: Math.ceil(text.length / 4), outputTokens },
    };
  }

  async planQueries(
    question: string,
    mode: SearchMode,
    maxQueries: number,
  ): Promise<QueryPlan> {
    return heuristicPlan(question, mode, maxQueries);
  }
}

/** Keyword-based fallback planner used by demo mode (no LLM call). */
export function heuristicPlan(
  question: string,
  mode: SearchMode,
  maxQueries: number,
): QueryPlan {
  const base = question.trim();
  const queries = [base];
  if (mode === "research" && maxQueries > 1) {
    queries.push(`${base} evidence and data`, `${base} criticism limitations`);
  } else if (mode === "academic" && maxQueries > 1) {
    queries.push(`${base} peer reviewed study`);
  } else if (mode === "news" && maxQueries > 1) {
    queries.push(`${base} latest developments`);
  }
  const subquestions =
    mode === "research"
      ? [
          `What is the current state of: ${base}?`,
          `What evidence supports or contradicts the main claims?`,
          `What are the key limitations and open questions?`,
        ]
      : [];
  return { queries: queries.slice(0, Math.max(1, maxQueries)), subquestions };
}

function buildMockAnswer(input: AnswerRequest): string {
  const { sources, mode, question, answerLength, history } = input;
  if (sources.length === 0) {
    return "I wasn't able to gather enough evidence to answer this question reliably. No sources passed retrieval filtering, so rather than guessing, I'd suggest rephrasing the question or trying a different search mode.";
  }

  const cite = (i: number) => `[${sources[i % sources.length]!.citationNumber}]`;
  const s = (i: number) => sources[i % sources.length]!;
  const isFollowUp = history.length > 0;

  const intro = isFollowUp
    ? `Building on the earlier discussion, here is what the evidence says about "${question}".`
    : `Here is what the retrieved evidence indicates about "${question}".`;

  const point = (i: number) => `${sentenceFrom(s(i).snippet)} ${cite(i)}`;

  if (mode === "research") {
    const caveat = sources.some((x) => x.metadata.isPreprint)
      ? `Note that at least one cited work is a preprint that has not completed peer review ${cite(
          sources.findIndex((x) => x.metadata.isPreprint),
        )}, and the sources vary in methodology and scope.`
      : "The available sources vary in methodology and scope, and this report reflects only the retrieved evidence.";
    return [
      `## Executive summary`,
      `${intro} Across ${sources.length} sources, the evidence converges on a few main themes, with meaningful caveats. ${point(0)}`,
      ``,
      `## Findings`,
      `### Current state`,
      `${point(0)} ${point(1)}`,
      ``,
      `### Supporting evidence`,
      `${point(2 % sources.length)} Independent coverage points in a similar direction ${cite(3)}.`,
      ``,
      `## Caveats`,
      caveat,
      ``,
      `## Conclusion`,
      `Taken together, the retrieved evidence supports a measured view: the headline findings are real but come with documented limitations ${cite(0)}${cite(1)}.`,
    ].join("\n");
  }

  if (mode === "news") {
    const dated = sources
      .filter((x) => x.publishedAt)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    const newest = dated[0] ?? s(0);
    return [
      `${intro}`,
      ``,
      `The most recent reporting (published ${newest.publishedAt?.slice(0, 10) ?? "recently"}) indicates: ${sentenceFrom(newest.snippet)} [${newest.citationNumber}]`,
      ``,
      `Earlier coverage adds context: ${point(1)} ${point(2 % sources.length)}`,
      ``,
      `Note that publication dates reflect when articles were published, which may differ from when the underlying events occurred.`,
    ].join("\n");
  }

  const body = [
    intro,
    ``,
    `**Key finding.** ${point(0)}`,
    ``,
    `**Supporting evidence.** ${point(1)} ${point(2 % sources.length)}`,
  ];
  if (answerLength !== "concise" && sources.length > 3) {
    body.push(``, `**Additional context.** ${point(3)}`);
  }
  if (mode === "academic") {
    const preprint = sources.find((x) => x.metadata.isPreprint);
    if (preprint) {
      body.push(
        ``,
        `Note: one cited work is a preprint and has not completed peer review [${preprint.citationNumber}].`,
      );
    }
  }
  body.push(
    ``,
    `Overall, the retrieved sources give a consistent picture, though they differ in emphasis ${cite(0)}${cite(1)}.`,
  );
  return body.join("\n");
}

function sentenceFrom(snippet: string): string {
  const first = snippet.split(/(?<=[.!?])\s/)[0] ?? snippet;
  const trimmed = first.trim().replace(/[.:;,]$/, "");
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}
