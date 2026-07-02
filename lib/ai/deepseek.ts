import type { SearchMode } from "@/lib/core/types";
import { ProviderError } from "@/lib/search/provider";
import type {
  AnswerEvent,
  AnswerProvider,
  AnswerRequest,
  QueryPlan,
  QueryPlanner,
} from "./provider";
import { buildSystemPrompt } from "./prompts";
import { parsePlan, PLANNER_JSON_INSTRUCTIONS } from "./planner";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

const MAX_OUTPUT_TOKENS: Record<string, number> = {
  concise: 1024,
  balanced: 2048,
  detailed: 4096,
};

export interface DeepSeekOptions {
  apiKey: string;
  /** e.g. "deepseek-chat" (V3) or "deepseek-reasoner" (R1). */
  model: string;
  timeoutMs?: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * DeepSeek answer provider. DeepSeek exposes an OpenAI-compatible
 * chat-completions API with SSE streaming; this implementation uses plain
 * fetch so no extra SDK is required.
 * API reference: https://api-docs.deepseek.com/
 */
export class DeepSeekAnswerProvider implements AnswerProvider, QueryPlanner {
  readonly name = "deepseek";

  constructor(private readonly options: DeepSeekOptions) {}

  private async request(
    body: Record<string, unknown>,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 120_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: combined,
      });
    } catch (err) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ProviderError("timeout", "DeepSeek request timed out", this.name);
      }
      throw new ProviderError("transient", "Network error reaching DeepSeek", this.name);
    }
    if (!response.ok) {
      throw this.mapHttpError(response.status);
    }
    return response;
  }

  private mapHttpError(status: number): ProviderError {
    if (status === 401 || status === 403) {
      return new ProviderError("auth", "DeepSeek rejected the API key", this.name);
    }
    if (status === 429) {
      return new ProviderError("rate_limited", "DeepSeek rate limit hit", this.name);
    }
    if (status >= 500) {
      return new ProviderError(
        "transient",
        `DeepSeek server error (${status})`,
        this.name,
      );
    }
    return new ProviderError("fatal", `DeepSeek request failed (${status})`, this.name);
  }

  async *streamAnswer(input: AnswerRequest): AsyncIterable<AnswerEvent> {
    const system = buildSystemPrompt({
      mode: input.mode,
      answerLength: input.answerLength,
      sources: input.sources,
      spaceInstructions: input.spaceInstructions,
    });
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...input.history.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: input.question },
    ];

    const response = await this.request(
      {
        model: this.options.model,
        messages,
        max_tokens: MAX_OUTPUT_TOKENS[input.answerLength] ?? 2048,
        stream: true,
        stream_options: { include_usage: true },
      },
      input.signal,
    );

    if (!response.body) {
      throw new ProviderError("transient", "DeepSeek returned no stream body", this.name);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let model = this.options.model;
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            let chunk: {
              model?: string;
              choices?: Array<{ delta?: { content?: string | null } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
            };
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue; // tolerate malformed keep-alive frames
            }
            if (chunk.model) model = chunk.model;
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) yield { type: "token", text };
            if (chunk.usage) {
              usage = {
                inputTokens: chunk.usage.prompt_tokens ?? 0,
                outputTokens: chunk.usage.completion_tokens ?? 0,
              };
            }
          }
        }
      }
    } catch (err) {
      if (
        input.signal?.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        throw new DOMException("Aborted", "AbortError");
      }
      throw new ProviderError(
        "transient",
        "DeepSeek stream failed mid-answer",
        this.name,
      );
    }

    yield { type: "done", model, usage };
  }

  async planQueries(
    question: string,
    mode: SearchMode,
    maxQueries: number,
    signal?: AbortSignal,
  ): Promise<QueryPlan> {
    try {
      const response = await this.request(
        {
          model: this.options.model,
          messages: [
            { role: "system", content: PLANNER_JSON_INSTRUCTIONS },
            {
              role: "user",
              content: `Question: ${question}\nMode: ${mode}\nMax queries: ${maxQueries}`,
            },
          ],
          max_tokens: 512,
          stream: false,
        },
        signal,
      );
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return parsePlan(text, question, maxQueries);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Planning is best-effort: fall back to the raw question.
      return { queries: [question], subquestions: [] };
    }
  }
}
