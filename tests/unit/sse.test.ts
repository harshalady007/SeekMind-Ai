import { describe, expect, it } from "vitest";
import type { SearchStreamEvent } from "@/lib/core/types";
import { encodeSseEvent, SseParser } from "@/lib/streaming/events";

describe("SSE encode/parse roundtrip", () => {
  it("parses events split across arbitrary chunk boundaries", () => {
    const events: SearchStreamEvent[] = [
      { type: "status", stage: "searching", message: "Searching the web…" },
      { type: "token", text: "Hello " },
      { type: "token", text: "world [1]." },
      { type: "complete", threadId: "t1", messageId: "m1" },
    ];
    const wire = events.map(encodeSseEvent).join("");
    const parser = new SseParser();
    const received: SearchStreamEvent[] = [];
    // Feed 7 bytes at a time to force partial frames.
    for (let i = 0; i < wire.length; i += 7) {
      received.push(...parser.push(wire.slice(i, i + 7)));
    }
    expect(received).toEqual(events);
  });

  it("skips malformed frames without throwing", () => {
    const parser = new SseParser();
    const events = parser.push(
      'data: {not json}\n\ndata: {"type":"token","text":"x"}\n\n',
    );
    expect(events).toEqual([{ type: "token", text: "x" }]);
  });

  it("ignores comment/heartbeat frames", () => {
    const parser = new SseParser();
    expect(parser.push(": keepalive\n\n")).toEqual([]);
  });
});
