import type { SearchStreamEvent } from "@/lib/core/types";

/** Encode one event as an SSE frame. */
export function encodeSseEvent(event: SearchStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Incremental SSE frame parser for the client. Feed it raw chunks; it emits
 * complete events and buffers partial frames across chunk boundaries.
 */
export class SseParser {
  private buffer = "";

  push(chunk: string): SearchStreamEvent[] {
    this.buffer += chunk;
    const events: SearchStreamEvent[] = [];
    let separatorIndex: number;
    while ((separatorIndex = this.buffer.indexOf("\n\n")) !== -1) {
      const frame = this.buffer.slice(0, separatorIndex);
      this.buffer = this.buffer.slice(separatorIndex + 2);
      const dataLines = frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));
      if (dataLines.length === 0) continue;
      try {
        events.push(JSON.parse(dataLines.join("\n")) as SearchStreamEvent);
      } catch {
        // Skip malformed frames rather than crashing the stream consumer.
      }
    }
    return events;
  }
}
