"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Square } from "lucide-react";
import { AnswerMarkdown } from "@/components/answer/answer-markdown";
import { SourceList } from "@/components/sources/source-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchComposer } from "@/components/search/composer";
import { api, type ThreadDetailResponse } from "@/lib/client/api";
import { MODE_CONFIGS } from "@/lib/config/modes";
import type {
  AnswerLength,
  NewsTimeRange,
  PublicSource,
  SearchMode,
} from "@/lib/core/types";
import { useSearchStream, type StartOptions } from "@/lib/streaming/use-search-stream";
import { ActivityPanel } from "./activity-panel";
import { ThreadToolbar } from "./thread-toolbar";

interface TurnView {
  key: string;
  question: string;
  answer: string;
  status: "streaming" | "complete" | "error" | "cancelled";
  sources: PublicSource[];
}

export interface ThreadViewProps {
  /** Existing thread id, or undefined when starting from ?q=. */
  threadId?: string;
  initial?: {
    query: string;
    mode: SearchMode;
    answerLength: AnswerLength;
    timeRange?: NewsTimeRange;
    spaceId?: string;
  };
}

export function ThreadView({ threadId: initialThreadId, initial }: ThreadViewProps) {
  const router = useRouter();
  const [threadId, setThreadId] = React.useState<string | null>(initialThreadId ?? null);
  const [detail, setDetail] = React.useState<ThreadDetailResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(initialThreadId));
  const [activeQuestion, setActiveQuestion] = React.useState<string | null>(null);
  const startedRef = React.useRef(false);

  const {
    state: stream,
    start,
    cancel,
  } = useSearchStream({
    onThread: (id) => {
      setThreadId((prev) => {
        if (!prev) {
          window.history.replaceState(null, "", `/thread/${id}`);
        }
        return id;
      });
    },
  });

  const refetch = React.useCallback(async (id: string) => {
    try {
      const data = await api.getThread(id);
      setDetail(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load thread.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load an existing thread.
  React.useEffect(() => {
    if (initialThreadId) void refetch(initialThreadId);
  }, [initialThreadId, refetch]);

  // Kick off the initial search exactly once (?q= flow).
  React.useEffect(() => {
    if (initial && !startedRef.current) {
      startedRef.current = true;
      setActiveQuestion(initial.query);
      void start({
        query: initial.query,
        mode: initial.mode,
        answerLength: initial.answerLength,
        timeRange: initial.timeRange,
        spaceId: initial.spaceId,
      });
    }
  }, [initial, start]);

  // When a stream completes, reload the canonical thread (repaired
  // citations, persisted ids) and clear the live turn.
  React.useEffect(() => {
    if (stream.phase === "complete" && stream.threadId) {
      void refetch(stream.threadId).then(() => setActiveQuestion(null));
    }
  }, [stream.phase, stream.threadId, refetch]);

  const mode: SearchMode = detail?.thread.searchMode ?? initial?.mode ?? "quick";
  const answerLength: AnswerLength =
    detail?.thread.answerLength ?? initial?.answerLength ?? "balanced";
  const isOwner = detail?.isOwner ?? true;
  const running = stream.phase === "running";

  // Build turns from persisted messages.
  const persistedTurns: TurnView[] = React.useMemo(() => {
    if (!detail) return [];
    const turns: TurnView[] = [];
    let currentQuestion: string | null = null;
    for (const message of detail.messages) {
      if (message.role === "user") {
        currentQuestion = message.content;
      } else {
        turns.push({
          key: message.id,
          question: currentQuestion ?? detail.thread.title,
          answer: message.content,
          status: message.status === "streaming" ? "error" : message.status,
          sources: detail.sourcesByMessageId[message.id] ?? [],
        });
        currentQuestion = null;
      }
    }
    // A trailing user message without an assistant reply (e.g. crash) —
    // surface it so the user can regenerate.
    if (currentQuestion && !activeQuestion) {
      turns.push({
        key: `pending-${turns.length}`,
        question: currentQuestion,
        answer: "",
        status: "error",
        sources: [],
      });
    }
    return turns;
  }, [detail, activeQuestion]);

  const submit = React.useCallback(
    (options: StartOptions) => {
      setActiveQuestion(options.regenerate ? "(regenerating)" : options.query);
      void start(options);
    },
    [start],
  );

  const followUp = (input: {
    query: string;
    mode: SearchMode;
    timeRange?: NewsTimeRange;
  }) => {
    if (!threadId) return;
    submit({
      query: input.query,
      mode,
      answerLength,
      timeRange: input.timeRange,
      threadId,
    });
  };

  const regenerate = () => {
    if (!threadId) return;
    const lastQuestion =
      persistedTurns[persistedTurns.length - 1]?.question ?? detail?.thread.title ?? "";
    setActiveQuestion(lastQuestion);
    void start({
      query: lastQuestion,
      mode,
      answerLength,
      threadId,
      regenerate: true,
    });
  };

  if (loading) {
    return (
      <div
        className="mx-auto max-w-3xl space-y-4 py-8"
        aria-busy="true"
        aria-label="Loading thread"
      >
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError && !detail && !activeQuestion) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
        <h1 className="mt-3 font-display text-xl text-cream-50">Thread unavailable</h1>
        <p className="mt-2 text-sm text-graphite-300">{loadError}</p>
        <Button variant="primary" className="mt-6" onClick={() => router.push("/")}>
          Start a new search
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      {detail && isOwner && threadId && (
        <ThreadToolbar
          thread={detail.thread}
          onChanged={() => void refetch(threadId)}
          onDeleted={() => router.push("/")}
          onRegenerate={regenerate}
          busy={running}
        />
      )}

      {persistedTurns.map((turn) => (
        <Turn
          key={turn.key}
          turn={turn}
          mode={mode}
          onRegenerate={regenerate}
          canAct={isOwner}
        />
      ))}

      {/* Keep the last run's activity log visible after completion. */}
      {!activeQuestion && stream.activity.length > 0 && (
        <ActivityPanel activity={stream.activity} running={false} />
      )}

      {activeQuestion && (
        <section aria-label="Current search">
          <h1 className="font-display text-2xl leading-snug text-cream-50">
            {activeQuestion === "(regenerating)"
              ? "Regenerating answer…"
              : activeQuestion}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="amber">{MODE_CONFIGS[mode].label} mode</Badge>
            {running && (
              <Button
                variant="outline"
                size="sm"
                onClick={cancel}
                data-testid="cancel-search"
              >
                <Square className="h-3 w-3" aria-hidden="true" />
                Stop
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <ActivityPanel activity={stream.activity} running={running} />

            {stream.sources.length > 0 && (
              <SourceList sources={stream.sources} mode={mode} />
            )}

            {stream.citationWarning && (
              <p
                role="alert"
                data-testid="citation-warning"
                className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
              >
                {stream.citationWarning.repaired
                  ? `Citations ${stream.citationWarning.invalidIds.map((i) => `[${i}]`).join(" ")} did not match any retrieved source and were removed from the saved answer.`
                  : `Warning: this answer cited ${stream.citationWarning.invalidIds.map((i) => `[${i}]`).join(" ")}, which do not match retrieved sources. Treat those claims with caution.`}
              </p>
            )}

            {(stream.answer || running) &&
              (stream.answer ? (
                <AnswerMarkdown
                  content={stream.answer}
                  sources={stream.sources}
                  streaming={running}
                />
              ) : (
                <div className="space-y-2" aria-hidden="true">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ))}

            {stream.phase === "cancelled" && (
              <p className="text-sm text-graphite-300">
                Search stopped.{" "}
                <button
                  type="button"
                  className="text-amber-soft underline"
                  onClick={() =>
                    threadId && void refetch(threadId).then(() => setActiveQuestion(null))
                  }
                >
                  Show saved progress
                </button>
              </p>
            )}

            {stream.error && (
              <div
                role="alert"
                className="rounded-card border border-danger/40 bg-danger/10 p-4 text-sm"
                data-testid="search-error"
              >
                <p className="font-medium text-danger">{stream.error.message}</p>
                {stream.error.code === "anonymous_limit_reached" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    onClick={() => router.push("/auth/login?next=/")}
                  >
                    Sign in to continue
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      submit({
                        query:
                          activeQuestion === "(regenerating)"
                            ? (persistedTurns[persistedTurns.length - 1]?.question ?? "")
                            : activeQuestion,
                        mode,
                        answerLength,
                        threadId: threadId ?? undefined,
                        regenerate: activeQuestion === "(regenerating)",
                      })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {isOwner && threadId && !running && (
        <div className="sticky bottom-4">
          <SearchComposer
            variant="followup"
            onSubmit={followUp}
            busy={running}
            initialMode={mode}
          />
        </div>
      )}
    </div>
  );
}

function Turn({
  turn,
  mode,
  onRegenerate,
  canAct,
}: {
  turn: TurnView;
  mode: SearchMode;
  onRegenerate: () => void;
  canAct: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const copyAnswer = async () => {
    await navigator.clipboard.writeText(turn.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section
      aria-label={`Question: ${turn.question}`}
      className="border-b border-graphite-800 pb-6 last:border-0"
    >
      <h2 className="font-display text-2xl leading-snug text-cream-50">
        {turn.question}
      </h2>
      <div className="mt-4 space-y-4">
        {turn.sources.length > 0 && <SourceList sources={turn.sources} mode={mode} />}
        {turn.answer ? (
          <AnswerMarkdown content={turn.answer} sources={turn.sources} />
        ) : (
          <p className="text-sm text-graphite-300">
            No answer was generated for this question.
          </p>
        )}
        {turn.status === "cancelled" && (
          <Badge tone="neutral">Answer stopped before completion</Badge>
        )}
        {turn.status === "error" && canAct && (
          <div className="flex items-center gap-3">
            <Badge tone="danger">Answer incomplete</Badge>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Regenerate
            </Button>
          </div>
        )}
        {turn.answer && (
          <button
            type="button"
            onClick={copyAnswer}
            data-testid="copy-answer"
            className="text-xs text-graphite-400 hover:text-amber-soft"
          >
            {copied ? "Copied to clipboard" : "Copy answer"}
          </button>
        )}
      </div>
    </section>
  );
}
