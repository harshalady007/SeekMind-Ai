import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnswerMarkdown } from "@/components/answer/answer-markdown";
import { SourceList } from "@/components/sources/source-list";
import { Badge } from "@/components/ui/badge";
import { MODE_CONFIGS } from "@/lib/config/modes";
import { toPublicSource } from "@/lib/core/types";
import { getStore } from "@/lib/db";
import { isPlausibleShareToken } from "@/lib/security/tokens";

export const metadata: Metadata = { title: "Shared thread" };
export const dynamic = "force-dynamic";

/**
 * Public read-only view of a shared thread, reachable only through its
 * unguessable share token.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isPlausibleShareToken(token)) notFound();

  const store = await getStore();
  const detail = await store.getThreadByShareToken(token);
  if (!detail) notFound();

  const { thread, messages, sourcesByMessageId } = detail;

  // Pair user questions with assistant answers.
  const turns: Array<{
    key: string;
    question: string;
    answer: string;
    sources: ReturnType<typeof toPublicSource>[];
  }> = [];
  let currentQuestion: string | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      currentQuestion = message.content;
    } else if (message.status === "complete") {
      turns.push({
        key: message.id,
        question: currentQuestion ?? thread.title,
        answer: message.content,
        sources: (sourcesByMessageId[message.id] ?? []).map(toPublicSource),
      });
      currentQuestion = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Shared thread — read only</Badge>
        <Badge tone="amber">{MODE_CONFIGS[thread.searchMode].label} mode</Badge>
      </div>

      {turns.length === 0 ? (
        <p className="text-sm text-graphite-300">This thread has no completed answers.</p>
      ) : (
        turns.map((turn) => (
          <section
            key={turn.key}
            aria-label={`Question: ${turn.question}`}
            className="mb-8 border-b border-graphite-800 pb-8 last:border-0"
          >
            <h1 className="font-display text-2xl leading-snug text-cream-50">
              {turn.question}
            </h1>
            <div className="mt-4 space-y-4">
              {turn.sources.length > 0 && (
                <SourceList sources={turn.sources} mode={thread.searchMode} />
              )}
              <AnswerMarkdown content={turn.answer} sources={turn.sources} />
            </div>
          </section>
        ))
      )}

      <p className="mt-4 text-xs text-graphite-400">
        Shared from DeepFind. Answers are generated from the cited sources retrieved at
        the time of the search.
      </p>
    </div>
  );
}
