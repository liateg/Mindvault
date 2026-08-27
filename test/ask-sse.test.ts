import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSseEvent,
  writeAskStream,
} from "../src/api/ask-sse.js";
import type { ContentStreamEvent } from "../src/llm/service.js";

const metrics: Extract<ContentStreamEvent, { type: "metrics" }> = {
  type: "metrics",
  metrics: {
    model: "test-model",
    input_tokens: 2,
    output_tokens: 3,
    total_tokens: 5,
    latency_ms: 10,
    input_cost: 0.1,
    output_cost: 0.2,
    total_cost: 0.3,
    tokens_per_second: 300,
  },
};

async function* stream(
  events: ContentStreamEvent[],
): AsyncGenerator<ContentStreamEvent> {
  yield* events;
}

test("preserves chunk order and emits the assembled text last", async () => {
  const output: string[] = [];
  const events: ContentStreamEvent[] = [
    { type: "token", text: "Hello" },
    metrics,
    { type: "token", text: ", world" },
    { type: "token", text: "!" },
  ];

  const fullText = await writeAskStream(stream(events), (chunk) => {
    output.push(chunk);
  });

  assert.equal(fullText, "Hello, world!");
  assert.deepEqual(output, [
    ...events.map(formatSseEvent),
    formatSseEvent({ type: "complete", text: "Hello, world!" }),
  ]);
});

test("emits complete with empty text for an empty stream", async () => {
  const output: string[] = [];

  const fullText = await writeAskStream(stream([]), (chunk) => {
    output.push(chunk);
  });

  assert.equal(fullText, "");
  assert.deepEqual(output, [
    'event: complete\ndata: {"type":"complete","text":""}\n\n',
  ]);
});

test("does not emit complete when stream consumption fails", async () => {
  const output: string[] = [];
  const failure = new Error("stream failed");

  async function* failingStream(): AsyncGenerator<ContentStreamEvent> {
    yield { type: "token", text: "partial" };
    throw failure;
  }

  await assert.rejects(
    writeAskStream(failingStream(), (chunk) => {
      output.push(chunk);
    }),
    failure,
  );
  assert.deepEqual(output, [
    'event: token\ndata: {"type":"token","text":"partial"}\n\n',
  ]);
});

test("does not emit complete when an aborted stream ends cleanly", async () => {
  const output: string[] = [];
  const abortController = new AbortController();

  async function* abortedStream(): AsyncGenerator<ContentStreamEvent> {
    yield { type: "token", text: "partial" };
    abortController.abort();
  }

  await assert.rejects(
    writeAskStream(
      abortedStream(),
      (chunk) => {
        output.push(chunk);
      },
      abortController.signal,
    ),
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
  assert.deepEqual(output, [
    'event: token\ndata: {"type":"token","text":"partial"}\n\n',
  ]);
});
