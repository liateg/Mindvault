import { model } from "./llm-config.js";

export async function generateContent(prompt: string): Promise<string> {
  console.log("Generating content...");

  const startedAt = performance.now();
  const result = await model.generate(prompt);
  const latencyMs = performance.now() - startedAt;

  const inputCost =
    (result.inputTokens / 1_000_000) * model.pricing.inputPerMillionTokens;
  const outputCost =
    (result.outputTokens / 1_000_000) * model.pricing.outputPerMillionTokens;
  const totalCost = inputCost + outputCost;
  const tokensPerSecond =
    latencyMs > 0 ? result.outputTokens / (latencyMs / 1_000) : 0;

  console.log(
    JSON.stringify({
      event: "llm_request",
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      total_tokens: result.totalTokens,
      latency_ms: Number(latencyMs.toFixed(2)),
      input_cost: Number(inputCost.toFixed(8)),
      output_cost: Number(outputCost.toFixed(8)),
      total_cost: Number(totalCost.toFixed(8)),
      tokens_per_second: Number(tokensPerSecond.toFixed(2)),
    }),
  );

  return result.output;
}