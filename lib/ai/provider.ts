import type { AnswerLength, RankedSource, SearchMode } from "@/lib/core/types";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerRequest {
  question: string;
  mode: SearchMode;
  answerLength: AnswerLength;
  sources: RankedSource[];
  /** Capped, possibly summarized conversation history (oldest first). */
  history: ConversationTurn[];
  /** Custom workspace instructions, if the thread belongs to a space. */
  spaceInstructions?: string;
  signal?: AbortSignal;
}

export type AnswerEvent =
  | { type: "token"; text: string }
  | {
      type: "done";
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    };

export interface AnswerProvider {
  readonly name: string;
  streamAnswer(input: AnswerRequest): AsyncIterable<AnswerEvent>;
}

export interface QueryPlan {
  queries: string[];
  /** Research mode only: subquestions guiding the loop. */
  subquestions: string[];
}

/** Optional planning capability; falls back to heuristics when absent. */
export interface QueryPlanner {
  planQueries(
    question: string,
    mode: SearchMode,
    maxQueries: number,
    signal?: AbortSignal,
  ): Promise<QueryPlan>;
}
