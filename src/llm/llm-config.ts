import Groq from "groq-sdk";

export interface ModelUsage {
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export interface LanguageModel {
  pricing: ModelPricing;
  generate(prompt: string): Promise<ModelUsage>;
}

const apiKey = process.env.GROQ_API_KEY;
const modelName = process.env.MODEL_NAME || "openai/gpt-oss-20b";

const pricingByModel: Record<string, ModelPricing> = {
  "openai/gpt-oss-20b": {
    inputPerMillionTokens: 0.075,
    outputPerMillionTokens: 0.3,
  },
  "openai/gpt-oss-120b": {
    inputPerMillionTokens: 0.15,
    outputPerMillionTokens: 0.6,
  },
};

if (!apiKey) {
  throw new Error("GROQ_API_KEY environment variable is required");
}

const pricing = pricingByModel[modelName];

if (!pricing) {
  throw new Error(`No pricing configured for model: ${modelName}`);
}

const groq = new Groq({
  apiKey,
  timeout: 30_000,
});

export const model: LanguageModel = {
  pricing,
  async generate(prompt) {
    const completion = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
    });

    return {
      output: completion.choices[0]?.message.content ?? "",
      model: completion.model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };
  },
};