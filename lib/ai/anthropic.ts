import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SearchMode } from "@/lib/core/types";
import { ProviderError } from "@/lib/search/provider";
import type {
  AnswerEvent,
  AnswerProvider,
  AnswerRequest,
  QueryPlan,
  QueryPlanner,
} from "./provider";
import { buildSystemPrompt, PLANNER_SYSTEM_PROMPT } from "./prompts";

const MAX_OUTPUT_TOKENS: Record<string, number> = {
  concise: 1024,
  balanced: 2048,
  detailed: 4096,
};

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/**
 * Anthropic answer provider: streams Markdown tokens from the Messages API.
 * SDK reference: https://github.com/anthropics/anthropic-sdk-typescript
 */
export class AnthropicAnswerProvider implements AnswerProvider, QueryPlanner {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(private readonly options: AnthropicOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      timeout: options.timeoutMs ?? 120_000,
      maxRetries: 2,
    });
  }

  async *streamAnswer(input: AnswerRequest): AsyncIterable<AnswerEvent> {
    const system = buildSystemPrompt({
      mode: input.mode,
      answerLength: input.answerLength,
      sources: input.sources,
      spaceInstructions: input.spaceInstructions,
    });

    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: input.question },
    ];

    let stream;
    try {
      stream = this.client.messages.stream(
        {
          model: this.options.model,
          max_tokens: MAX_OUTPUT_TOKENS[input.answerLength] ?? 2048,
          system,
          messages,
        },
        { signal: input.signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "token", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      yield {
        type: "done",
        model: final.model,
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
      };
    } catch (err) {
      throw mapAnthropicError(err);
    }
  }

  async planQueries(
    question: string,
    mode: SearchMode,
    maxQueries: number,
    signal?: AbortSignal,
  ): Promise<QueryPlan> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.options.model,
          max_tokens: 512,
          system: PLANNER_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Question: ${question}\nMode: ${mode}\nMax queries: ${maxQueries}`,
            },
          ],
        },
        { signal },
      );
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return parsePlan(text, question, maxQueries);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Planning is best-effort: fall back to the raw question.
      return { queries: [question], subquestions: [] };
    }
  }
}

const planSchema = z.object({
  queries: z.array(z.string().min(1).max(400)).max(20),
  subquestions: z.array(z.string().min(1).max(500)).max(20).default([]),
});

export function parsePlan(
  text: string,
  fallbackQuery: string,
  maxQueries: number,
): QueryPlan {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = planSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (parsed.success && parsed.data.queries.length > 0) {
        return {
          queries: parsed.data.queries.slice(0, maxQueries),
          subquestions: parsed.data.subquestions,
        };
      }
    } catch {
      // fall through to fallback
    }
  }
  return { queries: [fallbackQuery], subquestions: [] };
}

function mapAnthropicError(err: unknown): Error {
  if (err instanceof DOMException && err.name === "AbortError") return err;
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    if (status === 401 || status === 403) {
      return new ProviderError("auth", "Anthropic rejected the API key", "anthropic");
    }
    if (status === 429) {
      return new ProviderError("rate_limited", "Anthropic rate limit hit", "anthropic");
    }
    if (status >= 500) {
      return new ProviderError("transient", "Anthropic server error", "anthropic");
    }
    return new ProviderError(
      "fatal",
      `Anthropic request failed (${status})`,
      "anthropic",
    );
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError("timeout", "Anthropic request timed out", "anthropic");
  }
  if (err instanceof Error) {
    return new ProviderError(
      "transient",
      `LLM provider error: ${err.message}`,
      "anthropic",
    );
  }
  return new ProviderError("fatal", "Unknown LLM provider error", "anthropic");
}
