import type { MessageRecord } from "@/lib/core/types";
import type { ConversationTurn } from "@/lib/ai/provider";

/** Cap on messages sent verbatim as follow-up context (recent turns). */
const MAX_RECENT_MESSAGES = 6;
/** Per-message character cap in follow-up context. */
const MAX_MESSAGE_CHARS = 2_500;
/** Character cap for the summarized older history. */
const MAX_SUMMARY_CHARS = 1_200;

/**
 * Build a bounded conversation history for follow-up questions:
 * - always keep the thread's original question,
 * - keep the most recent turns verbatim (truncated),
 * - compress everything in between into a deterministic summary turn.
 *
 * Only complete messages are included (streaming/error/cancelled are skipped).
 */
export function buildHistory(messages: MessageRecord[]): ConversationTurn[] {
  const usable = messages.filter(
    (m) => m.status === "complete" && m.content.trim().length > 0,
  );
  if (usable.length === 0) return [];

  const recent = usable.slice(-MAX_RECENT_MESSAGES);
  const older = usable.slice(0, -MAX_RECENT_MESSAGES);
  const turns: ConversationTurn[] = [];

  const firstUser = usable.find((m) => m.role === "user");
  const firstInRecent = firstUser && recent.some((m) => m.id === firstUser.id);
  if (firstUser && !firstInRecent) {
    turns.push({
      role: "user",
      content: `(original question) ${truncate(firstUser.content, MAX_MESSAGE_CHARS)}`,
    });
  }

  const olderToSummarize = older.filter((m) => m.id !== firstUser?.id);
  if (olderToSummarize.length > 0) {
    const summary = olderToSummarize
      .map((m) => `${m.role === "user" ? "Q" : "A"}: ${firstSentence(m.content)}`)
      .join("\n");
    turns.push({
      role: "assistant",
      content: `(summary of ${olderToSummarize.length} earlier turns)\n${truncate(summary, MAX_SUMMARY_CHARS)}`,
    });
  }

  for (const message of recent) {
    turns.push({
      role: message.role,
      content: truncate(message.content, MAX_MESSAGE_CHARS),
    });
  }

  // Anthropic requires alternating roles starting with "user"; merge
  // consecutive same-role turns defensively.
  const merged: ConversationTurn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n\n${turn.content}`;
    } else {
      merged.push({ ...turn });
    }
  }
  if (merged[0]?.role === "assistant") {
    merged.unshift({ role: "user", content: "(context from earlier conversation)" });
  }
  return merged;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^.{20,240}?[.!?](?=\s|$)/);
  return match ? match[0] : clean.slice(0, 200);
}
