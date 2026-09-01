import { ApiError } from "./api";

export type AskEvent =
  | { type: "token"; text: string }
  | { type: "complete"; text: string }
  | { type: "done" }
  | {
      type: "error";
      message: string;
      responseStatus?: "ERROR" | "TIMEOUT" | "ABORTED";
    };

export type AskRequest = {
  projectId: string;
  prompt: string;
};

type SseFrame = { event: string; data: string };

export function parseSseFrames(buffer: string): {
  frames: SseFrame[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const remainder = chunks.pop() ?? "";
  const frames = chunks.flatMap((chunk) => {
    let event = "message";
    const data: string[] = [];

    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }

    return data.length ? [{ event, data: data.join("\n") }] : [];
  });

  return { frames, remainder };
}

function toAskEvent(frame: SseFrame): AskEvent | null {
  if (frame.event === "done") return { type: "done" };

  const payload = JSON.parse(frame.data) as Record<string, unknown>;
  if (frame.event === "token" || frame.event === "complete") {
    return {
      type: frame.event,
      text: typeof payload.text === "string" ? payload.text : "",
    };
  }
  if (frame.event === "error") {
    return {
      type: "error",
      message:
        typeof payload.message === "string"
          ? payload.message
          : "The stream failed",
      responseStatus:
        payload.responseStatus === "ERROR" ||
        payload.responseStatus === "TIMEOUT" ||
        payload.responseStatus === "ABORTED"
          ? payload.responseStatus
          : undefined,
    };
  }
  return null;
}

export async function* streamAsk(
  request: AskRequest,
  signal?: AbortSignal,
): AsyncGenerator<AskEvent> {
  const response = await fetch("/ask", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, "Unable to start assistant stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;

      for (const frame of parsed.frames) {
        const event = toAskEvent(frame);
        if (event) yield event;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
