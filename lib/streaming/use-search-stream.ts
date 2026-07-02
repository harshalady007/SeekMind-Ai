"use client";

import * as React from "react";
import type {
  AnswerLength,
  NewsTimeRange,
  PublicSource,
  SearchMode,
  SearchStage,
  UsageSummary,
} from "@/lib/core/types";
import { SseParser } from "./events";

export interface StreamState {
  phase: "idle" | "running" | "complete" | "error" | "cancelled";
  stage: SearchStage | null;
  /** Progress log for the research activity panel. */
  activity: Array<{ stage: SearchStage; message: string; at: number }>;
  threadId: string | null;
  messageId: string | null;
  title: string | null;
  sources: PublicSource[];
  answer: string;
  citationWarning: { invalidIds: number[]; repaired: boolean } | null;
  usage: UsageSummary | null;
  error: { code: string; message: string } | null;
}

const INITIAL: StreamState = {
  phase: "idle",
  stage: null,
  activity: [],
  threadId: null,
  messageId: null,
  title: null,
  sources: [],
  answer: "",
  citationWarning: null,
  usage: null,
  error: null,
};

export interface StartOptions {
  query: string;
  mode: SearchMode;
  answerLength: AnswerLength;
  timeRange?: NewsTimeRange;
  threadId?: string;
  regenerate?: boolean;
  spaceId?: string;
}

function randomSearchId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Client hook driving one streamed search: POSTs /api/search, parses SSE
 * frames incrementally, exposes typed state, and supports cancellation
 * (fetch abort + best-effort server-side cancel).
 */
export function useSearchStream(handlers?: {
  onThread?: (threadId: string) => void;
  onComplete?: (threadId: string, messageId: string) => void;
}) {
  const [state, setState] = React.useState<StreamState>(INITIAL);
  const abortRef = React.useRef<AbortController | null>(null);
  const searchIdRef = React.useRef<string | null>(null);
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  const cancel = React.useCallback(() => {
    const searchId = searchIdRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    if (searchId) {
      // Best-effort server-side abort (covers proxies that swallow aborts).
      void fetch("/api/search/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId }),
      }).catch(() => undefined);
    }
    setState((s) =>
      s.phase === "running" ? { ...s, phase: "cancelled", stage: null } : s,
    );
  }, []);

  const start = React.useCallback(async (options: StartOptions) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const searchId = randomSearchId();
    searchIdRef.current = searchId;

    setState({ ...INITIAL, phase: "running", stage: "planning" });

    let response: Response;
    try {
      response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, ...options }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        phase: "error",
        error: {
          code: "network",
          message: "Network error. Check your connection and retry.",
        },
      }));
      return;
    }

    if (!response.ok || !response.body) {
      let message = "The search could not be started.";
      let code = "internal_error";
      try {
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (body.error?.message) message = body.error.message;
        if (body.error?.code) code = body.error.code;
      } catch {
        // keep defaults
      }
      setState((s) => ({ ...s, phase: "error", error: { code, message } }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const events = parser.push(decoder.decode(value, { stream: true }));
        for (const event of events) {
          setState((prev) => {
            switch (event.type) {
              case "status":
                return {
                  ...prev,
                  stage: event.stage,
                  activity: [
                    ...prev.activity,
                    { stage: event.stage, message: event.message, at: Date.now() },
                  ],
                };
              case "thread":
                handlersRef.current?.onThread?.(event.threadId);
                return { ...prev, threadId: event.threadId, title: event.title };
              case "sources":
                return { ...prev, sources: event.sources };
              case "token":
                return { ...prev, answer: prev.answer + event.text };
              case "citation_validation":
                return event.valid
                  ? prev
                  : {
                      ...prev,
                      citationWarning: {
                        invalidIds: event.invalidIds,
                        repaired: event.repaired,
                      },
                    };
              case "usage":
                return { ...prev, usage: event.data };
              case "complete":
                handlersRef.current?.onComplete?.(event.threadId, event.messageId);
                return {
                  ...prev,
                  phase: "complete",
                  stage: "complete",
                  threadId: event.threadId,
                  messageId: event.messageId,
                };
              case "error":
                return {
                  ...prev,
                  phase: event.code === "cancelled" ? "cancelled" : "error",
                  stage: "error",
                  error:
                    event.code === "cancelled"
                      ? null
                      : { code: event.code, message: event.message },
                };
              default:
                return prev;
            }
          });
        }
      }
      // Stream ended without a terminal event (disconnect mid-answer).
      setState((prev) =>
        prev.phase === "running"
          ? {
              ...prev,
              phase: "error",
              error: {
                code: "disconnected",
                message:
                  "The connection dropped before the answer finished. The partial answer was kept — retry to regenerate.",
              },
            }
          : prev,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((prev) =>
        prev.phase === "running"
          ? {
              ...prev,
              phase: "error",
              error: { code: "stream_error", message: "The stream failed unexpectedly." },
            }
          : prev,
      );
    }
  }, []);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return { state, start, cancel, reset };
}
