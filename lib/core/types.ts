/**
 * Core domain types shared across the retrieval pipeline, providers,
 * persistence layer, API routes, and client.
 */

export type SearchMode = "quick" | "research" | "academic" | "news";
export type AnswerLength = "concise" | "balanced" | "detailed";
export type NewsTimeRange = "day" | "week" | "month" | "any";

export const SEARCH_MODES: readonly SearchMode[] = [
  "quick",
  "research",
  "academic",
  "news",
];
export const ANSWER_LENGTHS: readonly AnswerLength[] = [
  "concise",
  "balanced",
  "detailed",
];
export const NEWS_TIME_RANGES: readonly NewsTimeRange[] = ["day", "week", "month", "any"];

/** A raw result as returned by a search provider, before pipeline processing. */
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  /** Provider-reported relevance in [0, 1], if available. */
  providerScore?: number;
  publishedAt?: string | null;
  author?: string | null;
  /** Full or partial page content, when the provider returns it. */
  content?: string | null;
}

/** A processed, ranked source that made it through the retrieval pipeline. */
export interface RankedSource {
  citationNumber: number;
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  snippet: string;
  content: string | null;
  author: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  faviconUrl: string | null;
  relevanceScore: number;
  qualityScore: number;
  metadata: SourceMetadata;
}

export interface SourceMetadata {
  isPreprint?: boolean;
  isAcademic?: boolean;
  venue?: string | null;
  doi?: string | null;
  year?: number | null;
  /** Which query produced this result. */
  query?: string;
}

/** The client-safe shape of a source (what streams over the wire). */
export interface PublicSource {
  id: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  author: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  faviconUrl: string | null;
  metadata: SourceMetadata;
}

export function toPublicSource(s: RankedSource): PublicSource {
  return {
    id: s.citationNumber,
    url: s.url,
    domain: s.domain,
    title: s.title,
    snippet: s.snippet,
    author: s.author,
    publishedAt: s.publishedAt,
    retrievedAt: s.retrievedAt,
    faviconUrl: s.faviconUrl,
    metadata: s.metadata,
  };
}

export type SearchStage =
  | "planning"
  | "searching"
  | "reading_sources"
  | "evaluating_evidence"
  | "writing"
  | "complete"
  | "error";

export interface UsageSummary {
  searchQueries: number;
  sourcesConsidered: number;
  sourcesSelected: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export type SearchStreamEvent =
  | { type: "status"; stage: SearchStage; message: string }
  | { type: "thread"; threadId: string; title: string }
  | { type: "sources"; sources: PublicSource[] }
  | { type: "token"; text: string }
  | {
      type: "citation_validation";
      valid: boolean;
      invalidIds: number[];
      repaired: boolean;
    }
  | { type: "usage"; data: UsageSummary }
  | { type: "complete"; threadId: string; messageId: string }
  | { type: "error"; code: string; message: string };

/** Stable error codes returned by API endpoints and stream errors. */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "anonymous_limit_reached"
  | "daily_limit_reached"
  | "too_many_concurrent"
  | "provider_error"
  | "provider_timeout"
  | "no_results"
  | "cancelled"
  | "config_error"
  | "internal_error";

export interface ApiError {
  code: ErrorCode;
  message: string;
}

export type MessageRole = "user" | "assistant";
export type MessageStatus = "streaming" | "complete" | "error" | "cancelled";

export interface ThreadRecord {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  spaceId: string | null;
  title: string;
  searchMode: SearchMode;
  answerLength: AnswerLength;
  isSaved: boolean;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model: string | null;
  tokenUsage: { inputTokens: number; outputTokens: number } | null;
  createdAt: string;
}

export interface SearchRunRecord {
  id: string;
  threadId: string;
  messageId: string | null;
  provider: string;
  mode: SearchMode;
  queries: string[];
  status: "running" | "complete" | "error" | "cancelled";
  durationMs: number | null;
  usageMetadata: Partial<UsageSummary> | null;
  errorCode: string | null;
  createdAt: string;
}

export interface SourceRecord extends RankedSource {
  id: string;
  searchRunId: string;
}

export interface SpaceRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  customInstructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRecord {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  defaultMode: SearchMode;
  defaultAnswerLength: AnswerLength;
  createdAt: string;
  updatedAt: string;
}

/** Who is making a request: a signed-in user or an anonymous session. */
export type Identity =
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "anonymous"; sessionId: string };
