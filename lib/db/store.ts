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

export interface ThreadListFilters {
  query?: string;
  mode?: SearchMode;
  savedOnly?: boolean;
  spaceId?: string | null;
  /** ISO date lower bound. */
  since?: string;
  cursor?: string;
  limit?: number;
}

export interface ThreadListPage {
  threads: ThreadRecord[];
  nextCursor: string | null;
}

export interface CreateThreadInput {
  identity: Identity;
  title: string;
  searchMode: SearchMode;
  answerLength: AnswerLength;
  spaceId?: string | null;
}

export interface CreateSearchRunInput {
  threadId: string;
  messageId: string | null;
  provider: string;
  mode: SearchMode;
  queries: string[];
}

export interface ThreadDetail {
  thread: ThreadRecord;
  messages: MessageRecord[];
  /** Sources grouped by the assistant message they belong to. */
  sourcesByMessageId: Record<string, SourceRecord[]>;
}

export interface UsageReport {
  searchesToday: number;
  dailyLimit: number;
  totalThreads: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

/**
 * Persistence abstraction. Two implementations:
 * - MemoryStore: demo mode / Supabase not configured (non-durable).
 * - SupabaseStore: production persistence with RLS enforcement.
 */
export interface DataStore {
  readonly kind: "memory" | "supabase";

  // Threads
  createThread(input: CreateThreadInput): Promise<ThreadRecord>;
  getThread(threadId: string, identity: Identity | null): Promise<ThreadRecord | null>;
  getThreadByShareToken(token: string): Promise<ThreadDetail | null>;
  getThreadDetail(
    threadId: string,
    identity: Identity | null,
  ): Promise<ThreadDetail | null>;
  listThreads(identity: Identity, filters: ThreadListFilters): Promise<ThreadListPage>;
  updateThread(
    threadId: string,
    identity: Identity,
    patch: Partial<
      Pick<ThreadRecord, "title" | "isSaved" | "isPublic" | "shareToken" | "spaceId">
    >,
  ): Promise<ThreadRecord | null>;
  deleteThread(threadId: string, identity: Identity): Promise<boolean>;
  countSearchesToday(identity: Identity): Promise<number>;
  countAnonymousSearches(sessionId: string): Promise<number>;

  // Messages
  createMessage(input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    status: MessageStatus;
    model?: string | null;
  }): Promise<MessageRecord>;
  updateMessage(
    messageId: string,
    patch: Partial<Pick<MessageRecord, "content" | "status" | "model" | "tokenUsage">>,
  ): Promise<MessageRecord | null>;
  listMessages(threadId: string): Promise<MessageRecord[]>;

  // Search runs + sources
  createSearchRun(input: CreateSearchRunInput): Promise<SearchRunRecord>;
  updateSearchRun(
    runId: string,
    patch: Partial<
      Pick<
        SearchRunRecord,
        "status" | "durationMs" | "usageMetadata" | "errorCode" | "queries" | "messageId"
      >
    >,
  ): Promise<SearchRunRecord | null>;
  saveSources(runId: string, sources: RankedSource[]): Promise<SourceRecord[]>;
  listSourcesForMessage(messageId: string): Promise<SourceRecord[]>;

  // Spaces
  createSpace(
    ownerId: string,
    input: { name: string; description: string; customInstructions: string },
  ): Promise<SpaceRecord>;
  getSpace(spaceId: string, identity: Identity): Promise<SpaceRecord | null>;
  listSpaces(identity: Identity): Promise<SpaceRecord[]>;
  updateSpace(
    spaceId: string,
    identity: Identity,
    patch: Partial<Pick<SpaceRecord, "name" | "description" | "customInstructions">>,
  ): Promise<SpaceRecord | null>;
  deleteSpace(spaceId: string, identity: Identity): Promise<boolean>;

  // Profiles
  getProfile(userId: string): Promise<ProfileRecord | null>;
  upsertProfile(
    userId: string,
    patch: Partial<
      Pick<
        ProfileRecord,
        "displayName" | "avatarUrl" | "defaultMode" | "defaultAnswerLength"
      >
    >,
  ): Promise<ProfileRecord>;
  deleteUserData(userId: string): Promise<void>;

  // Usage
  getUsageReport(identity: Identity, dailyLimit: number): Promise<UsageReport>;
}
