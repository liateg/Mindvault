import Groq from "groq-sdk";

export interface LanguageModel {
  generate(prompt: string): Promise<string>;
}

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY environment variable is required");
}

const groq = new Groq({
  apiKey,
  timeout: 30_000,
});

export const model: LanguageModel = {
  async generate(prompt) {
    const completion = await groq.chat.completions.create({
      model: process.env.MODEL_NAME || "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0]?.message.content ?? "";
  },
};