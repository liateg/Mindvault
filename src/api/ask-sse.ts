import type { ContentStreamEvent } from "../llm/service.js";

export type AskCompleteEvent = {
  type: "complete";
  text: string;
};

export function formatSseEvent(
  event: ContentStreamEvent | AskCompleteEvent,
): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function writeAskStream(
  events: AsyncIterable<ContentStreamEvent>,
  write: (chunk: string) => unknown,
  signal?: AbortSignal,
): Promise<string> {
  let fullText = "";

  for await (const event of events) {
    if (event.type === "token") {
      fullText += event.text;
    }
    write(formatSseEvent(event));
  }

  signal?.throwIfAborted();
  write(formatSseEvent({ type: "complete", text: fullText }));
  return fullText;
}
