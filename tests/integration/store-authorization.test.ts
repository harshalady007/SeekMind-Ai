import { beforeEach, describe, expect, it } from "vitest";
import { generateShareToken } from "@/lib/security/tokens";
import {
  anonA,
  anonB,
  getTestStore,
  setupDemoEnvironment,
  userA,
  userB,
} from "./helpers";

describe("store authorization (mirrors RLS rules)", () => {
  beforeEach(() => setupDemoEnvironment());

  async function createThreadFor(identity: typeof userA | typeof anonA) {
    const store = getTestStore();
    return store.createThread({
      identity,
      title: "Private research",
      searchMode: "quick",
      answerLength: "balanced",
    });
  }

  it("users cannot read, update or delete another user's thread", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(userA);

    expect(await store.getThread(thread.id, userB)).toBeNull();
    expect(await store.getThreadDetail(thread.id, userB)).toBeNull();
    expect(await store.updateThread(thread.id, userB, { title: "stolen" })).toBeNull();
    expect(await store.deleteThread(thread.id, userB)).toBe(false);

    // Owner still has full access.
    expect(await store.getThread(thread.id, userA)).not.toBeNull();
    expect(
      (await store.updateThread(thread.id, userA, { title: "renamed" }))?.title,
    ).toBe("renamed");
  });

  it("anonymous sessions cannot access each other's content", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(anonA);
    expect(await store.getThread(thread.id, anonB)).toBeNull();
    expect(await store.deleteThread(thread.id, anonB)).toBe(false);
    expect((await store.listThreads(anonB, {})).threads).toHaveLength(0);
    expect(await store.getThread(thread.id, anonA)).not.toBeNull();
  });

  it("unauthenticated access is denied for private threads", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(userA);
    expect(await store.getThread(thread.id, null)).toBeNull();
  });

  it("public threads are readable only through a valid share token", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(userA);
    const token = generateShareToken();
    await store.updateThread(thread.id, userA, { isPublic: true, shareToken: token });

    // Share token grants read access.
    const shared = await store.getThreadByShareToken(token);
    expect(shared?.thread.id).toBe(thread.id);

    // A wrong token does not.
    expect(await store.getThreadByShareToken(generateShareToken())).toBeNull();

    // Unsharing invalidates the link.
    await store.updateThread(thread.id, userA, { isPublic: false, shareToken: null });
    expect(await store.getThreadByShareToken(token)).toBeNull();
  });

  it("spaces are private to their owner", async () => {
    const store = getTestStore();
    const space = await store.createSpace(userA.userId, {
      name: "Battery lab",
      description: "",
      customInstructions: "Prefer primary sources.",
    });
    expect(await store.getSpace(space.id, userB)).toBeNull();
    expect(await store.updateSpace(space.id, userB, { name: "hijack" })).toBeNull();
    expect(await store.deleteSpace(space.id, userB)).toBe(false);
    expect((await store.getSpace(space.id, userA))?.name).toBe("Battery lab");
  });

  it("deleting a user removes their threads, spaces and profile", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(userA);
    await store.createSpace(userA.userId, {
      name: "Space",
      description: "",
      customInstructions: "",
    });
    await store.upsertProfile(userA.userId, { displayName: "A" });

    await store.deleteUserData(userA.userId);

    expect(await store.getThread(thread.id, userA)).toBeNull();
    expect(await store.listSpaces(userA)).toHaveLength(0);
    expect(await store.getProfile(userA.userId)).toBeNull();
  });

  it("deleting a thread cascades to messages, runs and sources", async () => {
    const store = getTestStore();
    const thread = await createThreadFor(userA);
    const message = await store.createMessage({
      threadId: thread.id,
      role: "assistant",
      content: "answer [1]",
      status: "complete",
    });
    const run = await store.createSearchRun({
      threadId: thread.id,
      messageId: message.id,
      provider: "mock",
      mode: "quick",
      queries: ["q"],
    });
    await store.saveSources(run.id, [
      {
        citationNumber: 1,
        url: "https://example.com/a",
        canonicalUrl: "https://example.com/a",
        domain: "example.com",
        title: "T",
        snippet: "s",
        content: "c",
        author: null,
        publishedAt: null,
        retrievedAt: new Date().toISOString(),
        faviconUrl: null,
        relevanceScore: 0.5,
        qualityScore: 0.5,
        metadata: {},
      },
    ]);

    await store.deleteThread(thread.id, userA);
    expect(await store.listMessages(thread.id)).toHaveLength(0);
    expect(await store.listSourcesForMessage(message.id)).toHaveLength(0);
  });

  it("thread list filtering and cursor pagination work", async () => {
    const store = getTestStore();
    for (let i = 0; i < 5; i++) {
      const thread = await store.createThread({
        identity: userA,
        title: `Thread number ${i}`,
        searchMode: i % 2 === 0 ? "quick" : "news",
        answerLength: "balanced",
      });
      if (i === 0) await store.updateThread(thread.id, userA, { isSaved: true });
    }

    const page1 = await store.listThreads(userA, { limit: 2 });
    expect(page1.threads).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await store.listThreads(userA, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.threads).toHaveLength(2);
    const ids = new Set([...page1.threads, ...page2.threads].map((t) => t.id));
    expect(ids.size).toBe(4);

    const saved = await store.listThreads(userA, { savedOnly: true });
    expect(saved.threads).toHaveLength(1);
    const news = await store.listThreads(userA, { mode: "news" });
    expect(news.threads).toHaveLength(2);
    const searched = await store.listThreads(userA, { query: "number 3" });
    expect(searched.threads).toHaveLength(1);
  });
});
