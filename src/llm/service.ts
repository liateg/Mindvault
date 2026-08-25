import {
  model,
  type ModelUsage,
} from "./llm-config.js";

interface LlmMetrics {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  tokens_per_second: number;
}

export type ContentStreamEvent =
  | { type: "token"; text: string }
  | { type: "metrics"; metrics: LlmMetrics };

function calculateMetrics(
  usage: ModelUsage,
  latencyMs: number,
): LlmMetrics {
  const inputCost =
    (usage.inputTokens / 1_000_000) * model.pricing.inputPerMillionTokens;
  const outputCost =
    (usage.outputTokens / 1_000_000) * model.pricing.outputPerMillionTokens;
  const totalCost = inputCost + outputCost;
  const tokensPerSecond =
    latencyMs > 0 ? usage.outputTokens / (latencyMs / 1_000) : 0;

  return {
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    latency_ms: Number(latencyMs.toFixed(2)),
    input_cost: Number(inputCost.toFixed(8)),
    output_cost: Number(outputCost.toFixed(8)),
    total_cost: Number(totalCost.toFixed(8)),
    tokens_per_second: Number(tokensPerSecond.toFixed(2)),
  };
}

function logMetrics(metrics: LlmMetrics): void {
  console.log(JSON.stringify({ event: "llm_request", ...metrics }));
}

export async function generateContent(prompt: string): Promise<string> {
  console.log("Generating content...");

  const startedAt = performance.now();
  const result = await model.generate(prompt);
  const latencyMs = performance.now() - startedAt;

  logMetrics(calculateMetrics(result, latencyMs));

  return result.output;
}

export async function* streamContent(
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<ContentStreamEvent> {
  console.log("Streaming content...");

  const startedAt = performance.now();
  let usage: ModelUsage | undefined;

  for await (const chunk of model.stream(prompt, signal)) {
    if (chunk.text) {
      yield { type: "token", text: chunk.text };
    }

    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  const latencyMs = performance.now() - startedAt;
  const metrics = calculateMetrics(
    usage ?? {
      model: model.name,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    latencyMs,
  );

  logMetrics(metrics);
  yield { type: "metrics", metrics };
}