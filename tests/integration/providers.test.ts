import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAnswerProvider } from "@/lib/ai/mock";
import { parsePlan } from "@/lib/ai/planner";
import { DeepSeekAnswerProvider } from "@/lib/ai/deepseek";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import type { AnswerEvent, AnswerRequest } from "@/lib/ai/provider";
import type { RankedSource } from "@/lib/core/types";
import { buildHistory } from "@/lib/orchestrator/history";
import { ProviderError, withRetry } from "@/lib/search/provider";
import { MockSearchProvider } from "@/lib/search/mock";
import { TavilySearchProvider } from "@/lib/search/tavily";
import { setupDemoEnvironment } from "./helpers";

function makeSource(n: number): RankedSource {
  return {
    citationNumber: n,
    url: `https://example.com/${n}`,
    canonicalUrl: `https://example.com/${n}`,
    domain: "example.com",
    title: `Source ${n}`,
    snippet: `Snippet for source number ${n} with useful facts.`,
    content: `Content for source ${n}.`,
    author: null,
    publishedAt: "2026-06-01T00:00:00.000Z",
    retrievedAt: "2026-07-01T00:00:00.000Z",
    faviconUrl: null,
    relevanceScore: 0.8,
    qualityScore: 0.7,
    metadata: {},
  };
}

describe("MockSearchProvider", () => {
  beforeEach(() => setupDemoEnvironment());

  it("returns topic fixtures for matching queries and generic ones otherwise", async () => {
    const provider = new MockSearchProvider(0);
    const battery = await provider.search({
      query: "solid state battery timeline",
      mode: "quick",
      maxResults: 10,
    });
    expect(battery.some((r) => r.title.toLowerCase().includes("solid-state"))).toBe(true);

    const generic = await provider.search({
      query: "history of basket weaving guilds",
      mode: "quick",
      maxResults: 10,
    });
    expect(generic.length).toBeGreaterThanOrEqual(4);
  });

  it("is deterministic", async () => {
    const provider = new MockSearchProvider(0);
    const request = { query: "coral reefs", mode: "quick" as const, maxResults: 5 };
    expect(await provider.search(request)).toEqual(await provider.search(request));
  });
});

describe("MockAnswerProvider streaming", () => {
  it("streams tokens ending with a done event carrying usage", async () => {
    const provider = new MockAnswerProvider(0);
    const request: AnswerRequest = {
      question: "What do the sources say?",
      mode: "quick",
      answerLength: "balanced",
      sources: [makeSource(1), makeSource(2), makeSource(3)],
      history: [],
    };
    const events: AnswerEvent[] = [];
    for await (const event of provider.streamAnswer(request)) events.push(event);

    const done = events[events.length - 1];
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.usage.outputTokens).toBeGreaterThan(0);
    }
    const text = events
      .filter((e): e is Extract<AnswerEvent, { type: "token" }> => e.type === "token")
      .map((e) => e.text)
      .join("");
    expect(text).toContain("[1]");
    expect(events.filter((e) => e.type === "token").length).toBeGreaterThan(10);
  });

  it("aborts mid-stream on signal", async () => {
    const provider = new MockAnswerProvider(1);
    const controller = new AbortController();
    const request: AnswerRequest = {
      question: "q",
      mode: "quick",
      answerLength: "balanced",
      sources: [makeSource(1)],
      history: [],
      signal: controller.signal,
    };
    let count = 0;
    await expect(async () => {
      for await (const event of provider.streamAnswer(request)) {
        if (event.type === "token" && ++count === 3) controller.abort();
      }
    }).rejects.toThrow(/abort/i);
    expect(count).toBe(3);
  });

  it("states insufficient evidence when no sources are supplied", async () => {
    const provider = new MockAnswerProvider(0);
    const events: AnswerEvent[] = [];
    for await (const event of provider.streamAnswer({
      question: "q",
      mode: "quick",
      answerLength: "balanced",
      sources: [],
      history: [],
    })) {
      events.push(event);
    }
    const text = events
      .filter((e): e is Extract<AnswerEvent, { type: "token" }> => e.type === "token")
      .map((e) => e.text)
      .join("");
    expect(text.toLowerCase()).toContain("enough evidence");
    expect(text).not.toMatch(/\[\d+\]/);
  });
});

describe("system prompt construction", () => {
  it("lists only supplied source ids and fences untrusted content", () => {
    const prompt = buildSystemPrompt({
      mode: "quick",
      answerLength: "concise",
      sources: [makeSource(1), makeSource(2)],
    });
    expect(prompt).toContain("ids: 1, 2");
    expect(prompt).toContain("<source id: 1");
    expect(prompt).toContain("untrusted content");
    expect(prompt).toContain("Never cite an id that is not listed");
  });

  it("includes workspace instructions when provided", () => {
    const prompt = buildSystemPrompt({
      mode: "quick",
      answerLength: "balanced",
      sources: [makeSource(1)],
      spaceInstructions: "Always mention sample sizes.",
    });
    expect(prompt).toContain("Workspace instructions");
    expect(prompt).toContain("Always mention sample sizes.");
  });
});

describe("parsePlan (LLM planner output)", () => {
  it("parses valid JSON plans and caps query count", () => {
    const plan = parsePlan(
      'Here you go: {"queries":["a","b","c","d"],"subquestions":["s1"]}',
      "fallback",
      2,
    );
    expect(plan.queries).toEqual(["a", "b"]);
    expect(plan.subquestions).toEqual(["s1"]);
  });

  it("falls back to the raw question on malformed output", () => {
    expect(parsePlan("no json here", "fallback question", 3).queries).toEqual([
      "fallback question",
    ]);
    expect(parsePlan('{"queries": []}', "fallback", 3).queries).toEqual(["fallback"]);
  });
});

describe("withRetry", () => {
  it("retries transient errors with backoff and eventually succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new ProviderError("transient", "flaky", "test");
        return "ok";
      },
      { retries: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry fatal or auth errors", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new ProviderError("auth", "bad key", "test");
        },
        { retries: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("bad key");
    expect(attempts).toBe(1);
  });

  it("gives up after the retry cap", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new ProviderError("rate_limited", "429", "test");
        },
        { retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("429");
    expect(attempts).toBe(3);
  });
});

describe("TavilySearchProvider error mapping (stubbed fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const provider = new TavilySearchProvider({ apiKey: "test-key", timeoutMs: 5_000 });
  const request = { query: "q", mode: "quick" as const, maxResults: 5 };

  it("maps 401 to a non-retryable auth error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await expect(provider.search(request)).rejects.toMatchObject({
      kind: "auth",
      retryable: false,
    });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });

  it("retries 5xx then surfaces a transient error", async () => {
    const mockFetch = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", mockFetch);
    await expect(provider.search(request)).rejects.toMatchObject({ kind: "transient" });
    expect(mockFetch.mock.calls.length).toBe(3); // initial + 2 retries
  });

  it("parses a successful response into normalized results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [
                {
                  url: "https://example.com/a",
                  title: "A",
                  content: "body text",
                  score: 0.9,
                  published_date: "2026-06-01",
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const results = await provider.search(request);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      url: "https://example.com/a",
      providerScore: 0.9,
    });
  });

  it("never leaks the API key in errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 400 })),
    );
    try {
      await provider.search(request);
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain("test-key");
    }
  });
});

describe("timeout behaviour", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps request timeouts to a retryable timeout error", async () => {
    const provider = new TavilySearchProvider({ apiKey: "k", timeoutMs: 20 });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("The operation timed out", "TimeoutError")),
            );
          }),
      ),
    );
    await expect(
      provider.search({ query: "q", mode: "quick", maxResults: 3 }),
    ).rejects.toMatchObject({ kind: "timeout", retryable: true });
  }, 10_000);
});

describe("follow-up history strategy", () => {
  it("caps history, keeps the original question and summarizes older turns", () => {
    const messages = Array.from({ length: 14 }, (_, i) => ({
      id: `m${i}`,
      threadId: "t",
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content:
        i === 0
          ? "Original question about batteries?"
          : `Turn ${i} content. ${"x".repeat(50)}.`,
      status: "complete" as const,
      model: null,
      tokenUsage: null,
      createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
    }));
    const history = buildHistory(messages);

    // Bounded size: original + summary + recent 6, merged for alternation.
    expect(history.length).toBeLessThanOrEqual(8);
    expect(history[0]?.content).toContain("Original question about batteries?");
    expect(history.some((t) => t.content.includes("summary of"))).toBe(true);
    // Alternating roles, ending with the latest assistant turn.
    for (let i = 1; i < history.length; i++) {
      expect(history[i]?.role).not.toBe(history[i - 1]?.role);
    }
    expect(history[history.length - 1]?.content).toContain("Turn 13");
  });

  it("skips incomplete messages", () => {
    const history = buildHistory([
      {
        id: "m1",
        threadId: "t",
        role: "user",
        content: "q",
        status: "complete",
        model: null,
        tokenUsage: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m2",
        threadId: "t",
        role: "assistant",
        content: "partial",
        status: "error",
        model: null,
        tokenUsage: null,
        createdAt: "2026-01-01T00:01:00Z",
      },
    ]);
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe("user");
  });
});

describe("DeepSeekAnswerProvider (stubbed fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const makeProvider = () =>
    new DeepSeekAnswerProvider({ apiKey: "ds-test-key", model: "deepseek-chat" });

  const request: AnswerRequest = {
    question: "What do the sources say?",
    mode: "quick",
    answerLength: "balanced",
    sources: [makeSource(1), makeSource(2)],
    history: [
      { role: "user", content: "earlier" },
      { role: "assistant", content: "reply" },
    ],
  };

  function sseResponse(frames: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("streams tokens and reports usage from the final chunk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"model":"deepseek-chat","choices":[{"delta":{"content":"Hello "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"world [1]."}}]}\n\ndata: {"choices"',
          ':[{"delta":{}}],"usage":{"prompt_tokens":120,"completion_tokens":25}}\n\n',
          "data: [DONE]\n\n",
        ]),
      ),
    );
    const events: AnswerEvent[] = [];
    for await (const event of makeProvider().streamAnswer(request)) events.push(event);

    const text = events
      .filter((e): e is Extract<AnswerEvent, { type: "token" }> => e.type === "token")
      .map((e) => e.text)
      .join("");
    expect(text).toBe("Hello world [1].");
    const done = events[events.length - 1];
    expect(done).toMatchObject({
      type: "done",
      model: "deepseek-chat",
      usage: { inputTokens: 120, outputTokens: 25 },
    });

    // Request shape: system prompt first, question last, streaming with usage.
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("ids: 1, 2");
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "What do the sources say?",
    });
  });

  it("maps auth and rate-limit statuses to typed provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await expect(async () => {
      for await (const _ of makeProvider().streamAnswer(request)) void _;
    }).rejects.toMatchObject({ kind: "auth", retryable: false });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    await expect(async () => {
      for await (const _ of makeProvider().streamAnswer(request)) void _;
    }).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("plans queries via a non-streamed completion with JSON output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      '{"queries":["battery yield","battery cost"],"subquestions":[]}',
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const plan = await makeProvider().planQueries("battery question", "quick", 3);
    expect(plan.queries).toEqual(["battery yield", "battery cost"]);
  });

  it("falls back to the raw question when planning fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    const plan = await makeProvider().planQueries("fallback q", "quick", 3);
    expect(plan.queries).toEqual(["fallback q"]);
  });

  it("never leaks the API key in errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 400 })),
    );
    try {
      for await (const _ of makeProvider().streamAnswer(request)) void _;
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain("ds-test-key");
    }
  });
});
