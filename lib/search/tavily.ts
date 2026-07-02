import type { NewsTimeRange, SearchResult } from "@/lib/core/types";
import { z } from "zod";
import {
  ProviderError,
  withRetry,
  type SearchProvider,
  type SearchRequest,
} from "./provider";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

const tavilyResultSchema = z.object({
  url: z.string(),
  title: z.string().default(""),
  content: z.string().default(""),
  score: z.number().optional(),
  published_date: z.string().nullish(),
  raw_content: z.string().nullish(),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).default([]),
});

const TIME_RANGE_MAP: Record<NewsTimeRange, string | undefined> = {
  day: "day",
  week: "week",
  month: "month",
  any: undefined,
};

export interface TavilyOptions {
  apiKey: string;
  timeoutMs: number;
}

/**
 * Tavily web-search provider (POST https://api.tavily.com/search).
 * API reference: https://docs.tavily.com/documentation/api-reference/endpoint/search
 */
export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";

  constructor(private readonly options: TavilyOptions) {}

  async search(input: SearchRequest): Promise<SearchResult[]> {
    return withRetry(() => this.searchOnce(input), { signal: input.signal });
  }

  private async searchOnce(input: SearchRequest): Promise<SearchResult[]> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          query: input.query,
          topic: input.mode === "news" ? "news" : "general",
          search_depth: "advanced",
          max_results: input.maxResults,
          include_raw_content: false,
          ...(input.mode === "news" && input.timeRange
            ? { time_range: TIME_RANGE_MAP[input.timeRange] }
            : {}),
        }),
        signal,
      });
    } catch (err) {
      if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ProviderError("timeout", "Tavily search timed out", this.name);
      }
      throw new ProviderError("transient", "Network error reaching Tavily", this.name);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError("auth", "Tavily rejected the API key", this.name);
      }
      if (response.status === 429) {
        throw new ProviderError("rate_limited", "Tavily rate limit hit", this.name);
      }
      if (response.status >= 500) {
        throw new ProviderError(
          "transient",
          `Tavily server error (${response.status})`,
          this.name,
        );
      }
      throw new ProviderError(
        "fatal",
        `Tavily request failed (${response.status})`,
        this.name,
      );
    }

    const parsed = tavilyResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ProviderError("fatal", "Unexpected Tavily response shape", this.name);
    }

    return parsed.data.results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content.slice(0, 1_000),
      content: r.raw_content ?? r.content,
      providerScore: r.score,
      publishedAt: r.published_date ?? null,
      author: null,
    }));
  }
}
