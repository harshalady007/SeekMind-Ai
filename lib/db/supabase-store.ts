import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/auth/supabase-server";
import type {
  AnswerLength,
  Identity,
  MessageRecord,
  MessageStatus,
  ProfileRecord,
  RankedSource,
  SearchMode,
  SearchRunRecord,
  SourceRecord,
  SpaceRecord,
  ThreadRecord,
} from "@/lib/core/types";
import type { Database } from "./types";
import type {
  CreateSearchRunInput,
  CreateThreadInput,
  DataStore,
  ThreadDetail,
  ThreadListFilters,
  ThreadListPage,
  UsageReport,
} from "./store";

type Client = SupabaseClient<Database>;
type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type RunRow = Database["public"]["Tables"]["search_runs"]["Row"];
type SourceRow = Database["public"]["Tables"]["sources"]["Row"];
type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Supabase-backed store. Runs on the server with the service role and
 * enforces ownership explicitly on every query (the same rules the RLS
 * policies encode), because anonymous-session ownership cannot be expressed
 * through auth.uid(). RLS remains enabled as defense-in-depth for any
 * client-side access with the anon key.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;

  constructor(private readonly client: Client) {}

  private threadToRecord(row: ThreadRow): ThreadRecord {
    return {
      id: row.id,
      userId: row.user_id,
      anonymousSessionId: row.anonymous_session_id,
      spaceId: row.space_id,
      title: row.title,
      searchMode: row.search_mode as SearchMode,
      answerLength: row.answer_length as AnswerLength,
      isSaved: row.is_saved,
      isPublic: row.is_public,
      shareToken: row.share_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private messageToRecord(row: MessageRow): MessageRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      role: row.role as MessageRecord["role"],
      content: row.content,
      status: row.status as MessageStatus,
      model: row.model,
      tokenUsage: (row.token_usage as MessageRecord["tokenUsage"]) ?? null,
      createdAt: row.created_at,
    };
  }

  private runToRecord(row: RunRow): SearchRunRecord {
    return {
      id: row.id,
      threadId: row.thread_id,
      messageId: row.message_id,
      provider: row.provider,
      mode: row.mode as SearchMode,
      queries: (row.queries as string[]) ?? [],
      status: row.status as SearchRunRecord["status"],
      durationMs: row.duration_ms,
      usageMetadata: (row.usage_metadata as SearchRunRecord["usageMetadata"]) ?? null,
      errorCode: row.error_code,
      createdAt: row.created_at,
    };
  }

  private sourceToRecord(row: SourceRow): SourceRecord {
    return {
      id: row.id,
      searchRunId: row.search_run_id,
      citationNumber: row.citation_number,
      url: row.url,
      canonicalUrl: row.canonical_url,
      domain: row.domain,
      title: row.title,
      snippet: row.snippet,
      content: row.content,
      author: row.author,
      publishedAt: row.published_at,
      retrievedAt: row.retrieved_at,
      faviconUrl: row.favicon_url,
      relevanceScore: row.relevance_score,
      qualityScore: row.quality_score,
      metadata: (row.metadata as SourceRecord["metadata"]) ?? {},
    };
  }

  private spaceToRecord(row: SpaceRow): SpaceRecord {
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      description: row.description,
      customInstructions: row.custom_instructions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private profileToRecord(row: ProfileRow): ProfileRecord {
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      defaultMode: row.default_mode as SearchMode,
      defaultAnswerLength: row.default_answer_length as AnswerLength,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async ensureAnonymousSession(sessionId: string): Promise<void> {
    await this.client
      .from("anonymous_sessions")
      .upsert({ id: sessionId }, { onConflict: "id", ignoreDuplicates: true });
  }

  private matchesIdentity(thread: ThreadRow, identity: Identity | null): boolean {
    if (!identity) return false;
    if (identity.kind === "user") return thread.user_id === identity.userId;
    return thread.anonymous_session_id === identity.sessionId;
  }

  async createThread(input: CreateThreadInput): Promise<ThreadRecord> {
    if (input.identity.kind === "anonymous") {
      await this.ensureAnonymousSession(input.identity.sessionId);
    }
    const { data, error } = await this.client
      .from("threads")
      .insert({
        user_id: input.identity.kind === "user" ? input.identity.userId : null,
        anonymous_session_id:
          input.identity.kind === "anonymous" ? input.identity.sessionId : null,
        space_id: input.spaceId ?? null,
        title: input.title,
        search_mode: input.searchMode,
        answer_length: input.answerLength,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`createThread failed: ${error?.message}`);
    return this.threadToRecord(data);
  }

  async getThread(
    threadId: string,
    identity: Identity | null,
  ): Promise<ThreadRecord | null> {
    const { data } = await this.client
      .from("threads")
      .select()
      .eq("id", threadId)
      .maybeSingle();
    if (!data) return null;
    if (data.is_public || this.matchesIdentity(data, identity)) {
      return this.threadToRecord(data);
    }
    return null;
  }

  async getThreadByShareToken(token: string): Promise<ThreadDetail | null> {
    const { data } = await this.client
      .from("threads")
      .select()
      .eq("share_token", token)
      .eq("is_public", true)
      .maybeSingle();
    if (!data) return null;
    return this.buildDetail(this.threadToRecord(data));
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
    const assistantIds = messages.filter((m) => m.role === "assistant").map((m) => m.id);
    if (assistantIds.length > 0) {
      const { data: runs } = await this.client
        .from("search_runs")
        .select()
        .in("message_id", assistantIds);
      const runsByMessage = new Map<string, string[]>();
      for (const run of runs ?? []) {
        if (!run.message_id) continue;
        const list = runsByMessage.get(run.message_id) ?? [];
        list.push(run.id);
        runsByMessage.set(run.message_id, list);
      }
      const allRunIds = [...runsByMessage.values()].flat();
      if (allRunIds.length > 0) {
        const { data: sources } = await this.client
          .from("sources")
          .select()
          .in("search_run_id", allRunIds)
          .order("citation_number");
        for (const [messageId, runIds] of runsByMessage) {
          sourcesByMessageId[messageId] = (sources ?? [])
            .filter((s) => runIds.includes(s.search_run_id))
            .map((s) => this.sourceToRecord(s));
        }
      }
    }
    return { thread, messages, sourcesByMessageId };
  }

  async listThreads(
    identity: Identity,
    filters: ThreadListFilters,
  ): Promise<ThreadListPage> {
    const limit = Math.min(filters.limit ?? 20, 100);
    let query = this.client.from("threads").select();
    query =
      identity.kind === "user"
        ? query.eq("user_id", identity.userId)
        : query.eq("anonymous_session_id", identity.sessionId);
    if (filters.mode) query = query.eq("search_mode", filters.mode);
    if (filters.savedOnly) query = query.eq("is_saved", true);
    if (filters.spaceId !== undefined) {
      query =
        filters.spaceId === null
          ? query.is("space_id", null)
          : query.eq("space_id", filters.spaceId);
    }
    if (filters.since) query = query.gte("created_at", filters.since);
    if (filters.query) query = query.ilike("title", `%${escapeLike(filters.query)}%`);

    // Cursor: updated_at of the last item on the previous page.
    if (filters.cursor) {
      const { data: cursorRow } = await this.client
        .from("threads")
        .select("updated_at")
        .eq("id", filters.cursor)
        .maybeSingle();
      if (cursorRow) query = query.lt("updated_at", cursorRow.updated_at);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(limit + 1);
    if (error) throw new Error(`listThreads failed: ${error.message}`);
    const rows = data ?? [];
    const page = rows.slice(0, limit);
    return {
      threads: page.map((row) => this.threadToRecord(row)),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async updateThread(
    threadId: string,
    identity: Identity,
    patch: Partial<
      Pick<ThreadRecord, "title" | "isSaved" | "isPublic" | "shareToken" | "spaceId">
    >,
  ): Promise<ThreadRecord | null> {
    const update: Database["public"]["Tables"]["threads"]["Update"] = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.isSaved !== undefined) update.is_saved = patch.isSaved;
    if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
    if (patch.shareToken !== undefined) update.share_token = patch.shareToken;
    if (patch.spaceId !== undefined) update.space_id = patch.spaceId;

    let query = this.client.from("threads").update(update).eq("id", threadId);
    query =
      identity.kind === "user"
        ? query.eq("user_id", identity.userId)
        : query.eq("anonymous_session_id", identity.sessionId);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw new Error(`updateThread failed: ${error.message}`);
    return data ? this.threadToRecord(data) : null;
  }

  async deleteThread(threadId: string, identity: Identity): Promise<boolean> {
    let query = this.client.from("threads").delete().eq("id", threadId);
    query =
      identity.kind === "user"
        ? query.eq("user_id", identity.userId)
        : query.eq("anonymous_session_id", identity.sessionId);
    const { data, error } = await query.select("id");
    if (error) throw new Error(`deleteThread failed: ${error.message}`);
    return (data ?? []).length > 0;
  }

  async countSearchesToday(identity: Identity): Promise<number> {
    const startOfDay = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
    const threadIds = await this.ownedThreadIds(identity);
    if (threadIds.length === 0) return 0;
    const { count } = await this.client
      .from("search_runs")
      .select("id", { count: "exact", head: true })
      .in("thread_id", threadIds)
      .gte("created_at", startOfDay);
    return count ?? 0;
  }

  async countAnonymousSearches(sessionId: string): Promise<number> {
    const { data } = await this.client
      .from("anonymous_sessions")
      .select("search_count")
      .eq("id", sessionId)
      .maybeSingle();
    return data?.search_count ?? 0;
  }

  private async ownedThreadIds(identity: Identity): Promise<string[]> {
    let query = this.client.from("threads").select("id");
    query =
      identity.kind === "user"
        ? query.eq("user_id", identity.userId)
        : query.eq("anonymous_session_id", identity.sessionId);
    const { data } = await query;
    return (data ?? []).map((r) => r.id);
  }

  async createMessage(input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    model?: string | null;
  }): Promise<MessageRecord> {
    const { data, error } = await this.client
      .from("messages")
      .insert({
        thread_id: input.threadId,
        role: input.role,
        content: input.content,
        status: input.status,
        model: input.model ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`createMessage failed: ${error?.message}`);
    // Touch the thread so history sorts by activity.
    await this.client
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.threadId);
    return this.messageToRecord(data);
  }

  async updateMessage(
    messageId: string,
    patch: Partial<Pick<MessageRecord, "content" | "status" | "model" | "tokenUsage">>,
  ): Promise<MessageRecord | null> {
    const update: Database["public"]["Tables"]["messages"]["Update"] = {};
    if (patch.content !== undefined) update.content = patch.content;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.model !== undefined) update.model = patch.model;
    if (patch.tokenUsage !== undefined) update.token_usage = patch.tokenUsage;
    const { data, error } = await this.client
      .from("messages")
      .update(update)
      .eq("id", messageId)
      .select()
      .maybeSingle();
    if (error) throw new Error(`updateMessage failed: ${error.message}`);
    return data ? this.messageToRecord(data) : null;
  }

  async listMessages(threadId: string): Promise<MessageRecord[]> {
    const { data, error } = await this.client
      .from("messages")
      .select()
      .eq("thread_id", threadId)
      .order("created_at");
    if (error) throw new Error(`listMessages failed: ${error.message}`);
    return (data ?? []).map((row) => this.messageToRecord(row));
  }

  async createSearchRun(input: CreateSearchRunInput): Promise<SearchRunRecord> {
    const { data, error } = await this.client
      .from("search_runs")
      .insert({
        thread_id: input.threadId,
        message_id: input.messageId,
        provider: input.provider,
        mode: input.mode,
        queries: input.queries,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`createSearchRun failed: ${error?.message}`);

    // Maintain the anonymous session's lifetime counter.
    const { data: thread } = await this.client
      .from("threads")
      .select("anonymous_session_id")
      .eq("id", input.threadId)
      .maybeSingle();
    if (thread?.anonymous_session_id) {
      const current = await this.countAnonymousSearches(thread.anonymous_session_id);
      await this.client
        .from("anonymous_sessions")
        .update({
          search_count: current + 1,
          last_search_at: new Date().toISOString(),
        })
        .eq("id", thread.anonymous_session_id);
    }
    return this.runToRecord(data);
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
    const update: Database["public"]["Tables"]["search_runs"]["Update"] = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.durationMs !== undefined) update.duration_ms = patch.durationMs;
    if (patch.usageMetadata !== undefined) {
      update.usage_metadata =
        patch.usageMetadata as Database["public"]["Tables"]["search_runs"]["Update"]["usage_metadata"];
    }
    if (patch.errorCode !== undefined) update.error_code = patch.errorCode;
    if (patch.queries !== undefined) update.queries = patch.queries;
    if (patch.messageId !== undefined) update.message_id = patch.messageId;
    const { data, error } = await this.client
      .from("search_runs")
      .update(update)
      .eq("id", runId)
      .select()
      .maybeSingle();
    if (error) throw new Error(`updateSearchRun failed: ${error.message}`);
    return data ? this.runToRecord(data) : null;
  }

  async saveSources(runId: string, sources: RankedSource[]): Promise<SourceRecord[]> {
    if (sources.length === 0) return [];
    const { data, error } = await this.client
      .from("sources")
      .insert(
        sources.map((s) => ({
          search_run_id: runId,
          citation_number: s.citationNumber,
          url: s.url,
          canonical_url: s.canonicalUrl,
          domain: s.domain,
          title: s.title,
          snippet: s.snippet,
          content: s.content,
          author: s.author,
          published_at: s.publishedAt,
          retrieved_at: s.retrievedAt,
          favicon_url: s.faviconUrl,
          relevance_score: s.relevanceScore,
          quality_score: s.qualityScore,
          metadata:
            s.metadata as Database["public"]["Tables"]["sources"]["Insert"]["metadata"],
        })),
      )
      .select();
    if (error) throw new Error(`saveSources failed: ${error.message}`);
    return (data ?? []).map((row) => this.sourceToRecord(row));
  }

  async listSourcesForMessage(messageId: string): Promise<SourceRecord[]> {
    const { data: runs } = await this.client
      .from("search_runs")
      .select("id")
      .eq("message_id", messageId);
    const runIds = (runs ?? []).map((r) => r.id);
    if (runIds.length === 0) return [];
    const { data } = await this.client
      .from("sources")
      .select()
      .in("search_run_id", runIds)
      .order("citation_number");
    return (data ?? []).map((row) => this.sourceToRecord(row));
  }

  async createSpace(
    ownerId: string,
    input: { name: string; description: string; customInstructions: string },
  ): Promise<SpaceRecord> {
    const { data, error } = await this.client
      .from("spaces")
      .insert({
        owner_id: ownerId,
        name: input.name,
        description: input.description,
        custom_instructions: input.customInstructions,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`createSpace failed: ${error?.message}`);
    await this.client
      .from("space_members")
      .upsert({ space_id: data.id, user_id: ownerId, role: "owner" });
    return this.spaceToRecord(data);
  }

  async getSpace(spaceId: string, identity: Identity): Promise<SpaceRecord | null> {
    const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
    const { data } = await this.client
      .from("spaces")
      .select()
      .eq("id", spaceId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    return data ? this.spaceToRecord(data) : null;
  }

  async listSpaces(identity: Identity): Promise<SpaceRecord[]> {
    const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
    const { data } = await this.client
      .from("spaces")
      .select()
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    return (data ?? []).map((row) => this.spaceToRecord(row));
  }

  async updateSpace(
    spaceId: string,
    identity: Identity,
    patch: Partial<Pick<SpaceRecord, "name" | "description" | "customInstructions">>,
  ): Promise<SpaceRecord | null> {
    const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
    const update: Database["public"]["Tables"]["spaces"]["Update"] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.customInstructions !== undefined) {
      update.custom_instructions = patch.customInstructions;
    }
    const { data, error } = await this.client
      .from("spaces")
      .update(update)
      .eq("id", spaceId)
      .eq("owner_id", ownerId)
      .select()
      .maybeSingle();
    if (error) throw new Error(`updateSpace failed: ${error.message}`);
    return data ? this.spaceToRecord(data) : null;
  }

  async deleteSpace(spaceId: string, identity: Identity): Promise<boolean> {
    const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
    const { data, error } = await this.client
      .from("spaces")
      .delete()
      .eq("id", spaceId)
      .eq("owner_id", ownerId)
      .select("id");
    if (error) throw new Error(`deleteSpace failed: ${error.message}`);
    return (data ?? []).length > 0;
  }

  async getProfile(userId: string): Promise<ProfileRecord | null> {
    const { data } = await this.client
      .from("profiles")
      .select()
      .eq("id", userId)
      .maybeSingle();
    return data ? this.profileToRecord(data) : null;
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
    const insert: Database["public"]["Tables"]["profiles"]["Insert"] = { id: userId };
    if (patch.displayName !== undefined) insert.display_name = patch.displayName;
    if (patch.avatarUrl !== undefined) insert.avatar_url = patch.avatarUrl;
    if (patch.defaultMode !== undefined) insert.default_mode = patch.defaultMode;
    if (patch.defaultAnswerLength !== undefined) {
      insert.default_answer_length = patch.defaultAnswerLength;
    }
    const { data, error } = await this.client
      .from("profiles")
      .upsert(insert, { onConflict: "id" })
      .select()
      .single();
    if (error || !data) throw new Error(`upsertProfile failed: ${error?.message}`);
    return this.profileToRecord(data);
  }

  async deleteUserData(userId: string): Promise<void> {
    // Cascades take care of messages/runs/sources via thread FK.
    await this.client.from("threads").delete().eq("user_id", userId);
    await this.client.from("spaces").delete().eq("owner_id", userId);
    await this.client.from("profiles").delete().eq("id", userId);
  }

  async getUsageReport(identity: Identity, dailyLimit: number): Promise<UsageReport> {
    const searchesToday = await this.countSearchesToday(identity);
    const threadIds = await this.ownedThreadIds(identity);
    let inputTokens = 0;
    let outputTokens = 0;
    if (threadIds.length > 0) {
      const { data } = await this.client
        .from("messages")
        .select("token_usage")
        .in("thread_id", threadIds)
        .not("token_usage", "is", null);
      for (const row of data ?? []) {
        const usage = row.token_usage as {
          inputTokens?: number;
          outputTokens?: number;
        } | null;
        inputTokens += usage?.inputTokens ?? 0;
        outputTokens += usage?.outputTokens ?? 0;
      }
    }
    return {
      searchesToday,
      dailyLimit,
      totalThreads: threadIds.length,
      tokenUsage: { inputTokens, outputTokens },
    };
  }
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

let cached: SupabaseStore | null = null;

export function getSupabaseStore(): SupabaseStore {
  if (!cached) {
    cached = new SupabaseStore(createSupabaseServiceClient<Database>());
  }
  return cached;
}
