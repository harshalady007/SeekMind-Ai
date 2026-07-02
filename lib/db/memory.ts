import { randomUUID } from "node:crypto";
import type {
  Identity,
  MessageRecord,
  ProfileRecord,
  RankedSource,
  SearchRunRecord,
  SourceRecord,
  SpaceRecord,
  ThreadRecord,
} from "@/lib/core/types";
import type {
  CreateSearchRunInput,
  CreateThreadInput,
  DataStore,
  ThreadDetail,
  ThreadListFilters,
  ThreadListPage,
  UsageReport,
} from "./store";

/**
 * In-memory store used in demo mode and when Supabase is not configured.
 * Enforces the same ownership rules as the RLS policies so authorization
 * behaviour is identical across stores. Data does not survive restarts —
 * the demo badge and docs make this explicit.
 */
export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;

  private threads = new Map<string, ThreadRecord>();
  private messages = new Map<string, MessageRecord>();
  private searchRuns = new Map<string, SearchRunRecord>();
  private sources = new Map<string, SourceRecord>();
  private spaces = new Map<string, SpaceRecord>();
  private profiles = new Map<string, ProfileRecord>();

  private ownsThread(thread: ThreadRecord, identity: Identity | null): boolean {
    if (!identity) return false;
    if (identity.kind === "user") return thread.userId === identity.userId;
    return thread.anonymousSessionId === identity.sessionId;
  }

  async createThread(input: CreateThreadInput): Promise<ThreadRecord> {
    const now = new Date().toISOString();
    const thread: ThreadRecord = {
      id: randomUUID(),
      userId: input.identity.kind === "user" ? input.identity.userId : null,
      anonymousSessionId:
        input.identity.kind === "anonymous" ? input.identity.sessionId : null,
      spaceId: input.spaceId ?? null,
      title: input.title,
      searchMode: input.searchMode,
      answerLength: input.answerLength,
      isSaved: false,
      isPublic: false,
      shareToken: null,
      createdAt: now,
      updatedAt: now,
    };
    this.threads.set(thread.id, thread);
    return { ...thread };
  }

  async getThread(
    threadId: string,
    identity: Identity | null,
  ): Promise<ThreadRecord | null> {
    const thread = this.threads.get(threadId);
    if (!thread) return null;
    if (thread.isPublic || this.ownsThread(thread, identity)) return { ...thread };
    return null;
  }

  async getThreadByShareToken(token: string): Promise<ThreadDetail | null> {
    const thread = [...this.threads.values()].find(
      (t) => t.isPublic && t.shareToken === token,
    );
    if (!thread) return null;
    return this.buildDetail(thread);
  }

  async getThreadDetail(
    threadId: string,
    identity: Identity | null,
  ): Promise<ThreadDetail | null> {
    const thread = await this.getThread(threadId, identity);
    if (!thread) return null;
    return this.buildDetail(thread);
  }

  private async buildDetail(thread: ThreadRecord): Promise<ThreadDetail> {
    const messages = await this.listMessages(thread.id);
    const sourcesByMessageId: Record<string, SourceRecord[]> = {};
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      sourcesByMessageId[message.id] = await this.listSourcesForMessage(message.id);
    }
    return { thread: { ...thread }, messages, sourcesByMessageId };
  }

  async listThreads(
    identity: Identity,
    filters: ThreadListFilters,
  ): Promise<ThreadListPage> {
    const limit = Math.min(filters.limit ?? 20, 100);
    let items = [...this.threads.values()].filter((t) => this.ownsThread(t, identity));

    if (filters.mode) items = items.filter((t) => t.searchMode === filters.mode);
    if (filters.savedOnly) items = items.filter((t) => t.isSaved);
    if (filters.spaceId !== undefined) {
      items = items.filter((t) => t.spaceId === filters.spaceId);
    }
    if (filters.since) items = items.filter((t) => t.createdAt >= filters.since!);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter((t) => t.title.toLowerCase().includes(q));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    let startIndex = 0;
    if (filters.cursor) {
      const idx = items.findIndex((t) => t.id === filters.cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }
    const page = items.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < items.length ? (page[page.length - 1]?.id ?? null) : null;
    return { threads: page.map((t) => ({ ...t })), nextCursor };
  }

  async updateThread(
    threadId: string,
    identity: Identity,
    patch: Partial<
      Pick<ThreadRecord, "title" | "isSaved" | "isPublic" | "shareToken" | "spaceId">
    >,
  ): Promise<ThreadRecord | null> {
    const thread = this.threads.get(threadId);
    if (!thread || !this.ownsThread(thread, identity)) return null;
    Object.assign(thread, patch, { updatedAt: new Date().toISOString() });
    return { ...thread };
  }

  async deleteThread(threadId: string, identity: Identity): Promise<boolean> {
    const thread = this.threads.get(threadId);
    if (!thread || !this.ownsThread(thread, identity)) return false;
    this.threads.delete(threadId);
    for (const [id, m] of this.messages) {
      if (m.threadId === threadId) this.messages.delete(id);
    }
    for (const [id, r] of this.searchRuns) {
      if (r.threadId === threadId) {
        this.searchRuns.delete(id);
        for (const [sid, s] of this.sources) {
          if (s.searchRunId === id) this.sources.delete(sid);
        }
      }
    }
    return true;
  }

  async countSearchesToday(identity: Identity): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return [...this.searchRuns.values()].filter((run) => {
      if (!run.createdAt.startsWith(today)) return false;
      const thread = this.threads.get(run.threadId);
      return thread ? this.ownsThread(thread, identity) : false;
    }).length;
  }

  async countAnonymousSearches(sessionId: string): Promise<number> {
    return [...this.searchRuns.values()].filter((run) => {
      const thread = this.threads.get(run.threadId);
      return thread?.anonymousSessionId === sessionId;
    }).length;
  }

  async createMessage(input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    status: MessageRecord["status"];
    model?: string | null;
  }): Promise<MessageRecord> {
    const message: MessageRecord = {
      id: randomUUID(),
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      status: input.status,
      model: input.model ?? null,
      tokenUsage: null,
      createdAt: new Date().toISOString(),
    };
    this.messages.set(message.id, message);
    const thread = this.threads.get(input.threadId);
    if (thread) thread.updatedAt = message.createdAt;
    return { ...message };
  }

  async updateMessage(
    messageId: string,
    patch: Partial<Pick<MessageRecord, "content" | "status" | "model" | "tokenUsage">>,
  ): Promise<MessageRecord | null> {
    const message = this.messages.get(messageId);
    if (!message) return null;
    Object.assign(message, patch);
    return { ...message };
  }

  async listMessages(threadId: string): Promise<MessageRecord[]> {
    return [...this.messages.values()]
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ ...m }));
  }

  async createSearchRun(input: CreateSearchRunInput): Promise<SearchRunRecord> {
    const run: SearchRunRecord = {
      id: randomUUID(),
      threadId: input.threadId,
      messageId: input.messageId,
      provider: input.provider,
      mode: input.mode,
      queries: [...input.queries],
      status: "running",
      durationMs: null,
      usageMetadata: null,
      errorCode: null,
      createdAt: new Date().toISOString(),
    };
    this.searchRuns.set(run.id, run);
    return { ...run };
  }

  async updateSearchRun(
    runId: string,
    patch: Partial<
      Pick<
        SearchRunRecord,
        "status" | "durationMs" | "usageMetadata" | "errorCode" | "queries" | "messageId"
      >
    >,
  ): Promise<SearchRunRecord | null> {
    const run = this.searchRuns.get(runId);
    if (!run) return null;
    Object.assign(run, patch);
    return { ...run };
  }

  async saveSources(runId: string, sources: RankedSource[]): Promise<SourceRecord[]> {
    const saved: SourceRecord[] = [];
    for (const source of sources) {
      const record: SourceRecord = { ...source, id: randomUUID(), searchRunId: runId };
      this.sources.set(record.id, record);
      saved.push({ ...record });
    }
    return saved;
  }

  async listSourcesForMessage(messageId: string): Promise<SourceRecord[]> {
    const runs = [...this.searchRuns.values()].filter((r) => r.messageId === messageId);
    const out: SourceRecord[] = [];
    for (const run of runs) {
      for (const s of this.sources.values()) {
        if (s.searchRunId === run.id) out.push({ ...s });
      }
    }
    return out.sort((a, b) => a.citationNumber - b.citationNumber);
  }

  async createSpace(
    ownerId: string,
    input: { name: string; description: string; customInstructions: string },
  ): Promise<SpaceRecord> {
    const now = new Date().toISOString();
    const space: SpaceRecord = {
      id: randomUUID(),
      ownerId,
      name: input.name,
      description: input.description,
      customInstructions: input.customInstructions,
      createdAt: now,
      updatedAt: now,
    };
    this.spaces.set(space.id, space);
    return { ...space };
  }

  private ownsSpace(space: SpaceRecord, identity: Identity): boolean {
    const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
    return space.ownerId === ownerId;
  }

  async getSpace(spaceId: string, identity: Identity): Promise<SpaceRecord | null> {
    const space = this.spaces.get(spaceId);
    if (!space || !this.ownsSpace(space, identity)) return null;
    return { ...space };
  }

  async listSpaces(identity: Identity): Promise<SpaceRecord[]> {
    return [...this.spaces.values()]
      .filter((s) => this.ownsSpace(s, identity))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((s) => ({ ...s }));
  }

  async updateSpace(
    spaceId: string,
    identity: Identity,
    patch: Partial<Pick<SpaceRecord, "name" | "description" | "customInstructions">>,
  ): Promise<SpaceRecord | null> {
    const space = this.spaces.get(spaceId);
    if (!space || !this.ownsSpace(space, identity)) return null;
    Object.assign(space, patch, { updatedAt: new Date().toISOString() });
    return { ...space };
  }

  async deleteSpace(spaceId: string, identity: Identity): Promise<boolean> {
    const space = this.spaces.get(spaceId);
    if (!space || !this.ownsSpace(space, identity)) return false;
    this.spaces.delete(spaceId);
    for (const thread of this.threads.values()) {
      if (thread.spaceId === spaceId) thread.spaceId = null;
    }
    return true;
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  async upsertProfile(
    userId: string,
    patch: Partial<
      Pick<
        ProfileRecord,
        "displayName" | "avatarUrl" | "defaultMode" | "defaultAnswerLength"
      >
    >,
  ): Promise<ProfileRecord> {
    const now = new Date().toISOString();
    const existing = this.profiles.get(userId) ?? {
      id: userId,
      displayName: null,
      avatarUrl: null,
      defaultMode: "quick" as const,
      defaultAnswerLength: "balanced" as const,
      createdAt: now,
      updatedAt: now,
    };
    Object.assign(existing, patch, { updatedAt: now });
    this.profiles.set(userId, existing);
    return { ...existing };
  }

  async deleteUserData(userId: string): Promise<void> {
    this.profiles.delete(userId);
    const identity: Identity = { kind: "user", userId, email: null };
    for (const thread of [...this.threads.values()]) {
      if (thread.userId === userId) await this.deleteThread(thread.id, identity);
    }
    for (const space of [...this.spaces.values()]) {
      if (space.ownerId === userId) this.spaces.delete(space.id);
    }
  }

  async getUsageReport(identity: Identity, dailyLimit: number): Promise<UsageReport> {
    const searchesToday = await this.countSearchesToday(identity);
    const ownedThreads = [...this.threads.values()].filter((t) =>
      this.ownsThread(t, identity),
    );
    let inputTokens = 0;
    let outputTokens = 0;
    for (const message of this.messages.values()) {
      if (!ownedThreads.some((t) => t.id === message.threadId)) continue;
      if (message.tokenUsage) {
        inputTokens += message.tokenUsage.inputTokens;
        outputTokens += message.tokenUsage.outputTokens;
      }
    }
    return {
      searchesToday,
      dailyLimit,
      totalThreads: ownedThreads.length,
      tokenUsage: { inputTokens, outputTokens },
    };
  }
}
