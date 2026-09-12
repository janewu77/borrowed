import type { SseEvent } from "./api-types";

type RawSseEvent = { event: string; data: string };
type SseEventName = SseEvent["event"];

function parseBlock(block: string): RawSseEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  return data.length ? { event, data: data.join("\n") } : null;
}

/** Converts a POST response body into typed SSE events. Unknown events are skipped. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const raw = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (!raw) continue;

        try {
          const parsed: unknown = JSON.parse(raw.data);
          const event = toSseEvent(raw.event, parsed);
          if (event) yield event;
        } catch {
          // A malformed event must not lose the rest of a conversation.
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

function toSseEvent(event: string, data: unknown): SseEvent | null {
  if (!isSseEventName(event) || typeof data !== "object" || data === null) return null;
  // The API's generated discriminated union is authoritative; unknown names are
  // intentionally ignored to keep a forward-compatible stream alive.
  return { event, data } as SseEvent;
}

function isSseEventName(event: string): event is SseEventName {
  return ["token", "question", "listing_draft", "results", "availability", "booking_claim", "error", "done"].includes(event);
}
