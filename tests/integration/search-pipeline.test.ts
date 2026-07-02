import { beforeEach, describe, expect, it } from "vitest";
import { validateCitations } from "@/lib/citations/validate";
import type { SearchStreamEvent } from "@/lib/core/types";
import { runSearch } from "@/lib/orchestrator/run-search";
import { anonA, getTestStore, setupDemoEnvironment, userA } from "./helpers";

async function collect(
  input: Parameters<typeof runSearch>[0],
): Promise<SearchStreamEvent[]> {
  const events: SearchStreamEvent[] = [];
  for await (const event of runSearch(input)) events.push(event);
  return events;
}

const baseInput = {
  searchId: "test-search-0001",
  query: "How close are solid state batteries to powering EVs?",
  mode: "quick" as const,
  answerLength: "balanced" as const,
  regenerate: false,
};

describe("quick search pipeline (mock providers)", () => {
  beforeEach(() => setupDemoEnvironment());

  it("streams the full event sequence and persists everything", async () => {
    const events = await collect({
      identity: userA,
      input: baseInput,
      signal: new AbortController().signal,
    });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("thread");
    expect(types).toContain("status");
    expect(types).toContain("sources");
    expect(types).toContain("token");
    expect(types).toContain("citation_validation");
    expect(types).toContain("usage");
    expect(types[types.length - 1]).toBe("complete");
    expect(types).not.toContain("error");

    const threadEvent = events.find((e) => e.type === "thread");
    const completeEvent = events.find((e) => e.type === "complete");
    const sourcesEvent = events.find((e) => e.type === "sources");
    if (
      threadEvent?.type !== "thread" ||
      completeEvent?.type !== "complete" ||
      sourcesEvent?.type !== "sources"
    ) {
      throw new Error("missing expected events");
    }
    expect(sourcesEvent.sources.length).toBeGreaterThanOrEqual(4);

    // Streamed answer equals persisted answer, and citations validate
    // against the persisted sources.
    const store = getTestStore();
    const detail = await store.getThreadDetail(threadEvent.threadId, userA);
    expect(detail).not.toBeNull();
    const assistant = detail!.messages.find((m) => m.role === "assistant");
    expect(assistant?.status).toBe("complete");
    const streamedAnswer = events
      .filter(
        (e): e is Extract<SearchStreamEvent, { type: "token" }> => e.type === "token",
      )
      .map((e) => e.text)
      .join("");
    expect(assistant?.content).toBe(streamedAnswer);

    const savedSources = detail!.sourcesByMessageId[assistant!.id] ?? [];
    expect(savedSources.length).toBe(sourcesEvent.sources.length);
    const validation = validateCitations(assistant!.content, savedSources);
    expect(validation.valid).toBe(true);
    expect(validation.citedIds.length).toBeGreaterThan(0);

    // Search run recorded as complete with usage metadata.
    const validationEvent = events.find((e) => e.type === "citation_validation");
    expect(validationEvent).toMatchObject({ valid: true });
  });

  it("supports follow-up questions that keep thread context", async () => {
    const first = await collect({
      identity: userA,
      input: baseInput,
      signal: new AbortController().signal,
    });
    const threadEvent = first.find((e) => e.type === "thread");
    if (threadEvent?.type !== "thread") throw new Error("no thread event");

    const followUp = await collect({
      identity: userA,
      input: {
        ...baseInput,
        searchId: "test-search-0002",
        query: "What are the main manufacturing obstacles?",
        threadId: threadEvent.threadId,
      },
      signal: new AbortController().signal,
    });
    expect(followUp.map((e) => e.type)).toContain("complete");

    const store = getTestStore();
    const detail = await store.getThreadDetail(threadEvent.threadId, userA);
    const userMessages = detail!.messages.filter((m) => m.role === "user");
    const assistantMessages = detail!.messages.filter((m) => m.role === "assistant");
    expect(userMessages.length).toBe(2);
    expect(assistantMessages.length).toBe(2);
    // The mock answer provider acknowledges prior context on follow-ups.
    expect(assistantMessages[1]?.content).toContain("Building on the earlier discussion");
  });

  it("regenerates the last answer without duplicating the user turn", async () => {
    const first = await collect({
      identity: userA,
      input: baseInput,
      signal: new AbortController().signal,
    });
    const threadEvent = first.find((e) => e.type === "thread");
    if (threadEvent?.type !== "thread") throw new Error("no thread event");

    await collect({
      identity: userA,
      input: {
        ...baseInput,
        searchId: "test-search-0003",
        threadId: threadEvent.threadId,
        regenerate: true,
      },
      signal: new AbortController().signal,
    });

    const store = getTestStore();
    const detail = await store.getThreadDetail(threadEvent.threadId, userA);
    expect(detail!.messages.filter((m) => m.role === "user").length).toBe(1);
    expect(detail!.messages.filter((m) => m.role === "assistant").length).toBe(2);
  });

  it("denies follow-ups on another identity's thread", async () => {
    const first = await collect({
      identity: userA,
      input: baseInput,
      signal: new AbortController().signal,
    });
    const threadEvent = first.find((e) => e.type === "thread");
    if (threadEvent?.type !== "thread") throw new Error("no thread event");

    const events = await collect({
      identity: anonA,
      input: {
        ...baseInput,
        searchId: "test-search-0004",
        query: "hijack attempt",
        threadId: threadEvent.threadId,
      },
      signal: new AbortController().signal,
    });
    expect(events).toEqual([
      { type: "error", code: "not_found", message: "Thread not found." },
    ]);
  });

  it("cancellation aborts the stream and records a cancelled run", async () => {
    const controller = new AbortController();
    const events: SearchStreamEvent[] = [];
    for await (const event of runSearch({
      identity: userA,
      input: baseInput,
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === "token") controller.abort();
    }
    const last = events[events.length - 1];
    expect(last).toEqual({
      type: "error",
      code: "cancelled",
      message: "Search cancelled.",
    });
    expect(events.map((e) => e.type)).not.toContain("complete");
  });
});

describe("research mode guardrails", () => {
  beforeEach(() =>
    setupDemoEnvironment({ RESEARCH_MAX_QUERIES: "4", RESEARCH_MAX_ITERATIONS: "2" }),
  );

  it("produces a structured report and stays within the query budget", async () => {
    const events = await collect({
      identity: userA,
      input: { ...baseInput, mode: "research" },
      signal: new AbortController().signal,
    });
    expect(events[events.length - 1]?.type).toBe("complete");

    const answer = events
      .filter(
        (e): e is Extract<SearchStreamEvent, { type: "token" }> => e.type === "token",
      )
      .map((e) => e.text)
      .join("");
    expect(answer).toContain("## Executive summary");
    expect(answer).toContain("## Findings");
    expect(answer).toContain("## Caveats");
    expect(answer).toContain("## Conclusion");

    const usageEvent = events.find((e) => e.type === "usage");
    if (usageEvent?.type !== "usage") throw new Error("no usage event");
    expect(usageEvent.data.searchQueries).toBeLessThanOrEqual(4);
    expect(usageEvent.data.searchQueries).toBeGreaterThanOrEqual(1);

    const stages = events
      .filter(
        (e): e is Extract<SearchStreamEvent, { type: "status" }> => e.type === "status",
      )
      .map((e) => e.stage);
    expect(stages).toContain("planning");
    expect(stages).toContain("searching");
    expect(stages).toContain("writing");
  });
});

describe("anonymous identity", () => {
  beforeEach(() => setupDemoEnvironment());

  it("persists threads under the anonymous session and counts searches", async () => {
    const events = await collect({
      identity: anonA,
      input: baseInput,
      signal: new AbortController().signal,
    });
    expect(events[events.length - 1]?.type).toBe("complete");
    const store = getTestStore();
    expect(await store.countAnonymousSearches(anonA.sessionId)).toBe(1);
    const { threads } = await store.listThreads(anonA, {});
    expect(threads.length).toBe(1);
  });
});
