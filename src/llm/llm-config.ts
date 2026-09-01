import Groq from "groq-sdk";

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelResult extends ModelUsage {
  output: string;
}

export interface ModelStreamChunk {
  text?: string;
  usage?: ModelUsage;
}

export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export interface LanguageModel {
  name: string;
  pricing: ModelPricing;
  generate(prompt: string): Promise<ModelResult>;
  stream(
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<ModelStreamChunk>;
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
  name: modelName,
  pricing,
  async generate(prompt) {
    const completion = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    return {
      output: completion.choices[0]?.message.content ?? "",
      model: completion.model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };
  },
  async *stream(prompt, signal) {
    const request = {
      model: modelName,
      messages: [{ role: "user" as const, content: prompt }],
      stream: true as const,
      temperature: 0,
    };

    const groqStream = signal
      ? await groq.chat.completions.create(request, { signal })
      : await groq.chat.completions.create(request);

    for await (const chunk of groqStream) {
      const text = chunk.choices[0]?.delta.content;

      if (text) {
        yield { text };
      }

      const usage = chunk.x_groq?.usage;

      if (usage) {
        yield {
          usage: {
            model: chunk.model,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
        };
      }
    }
  },
};