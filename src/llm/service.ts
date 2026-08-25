import { model } from "./llm-config.js";

export async function generateContent(prompt: string): Promise<string> {
  console.log("Generating content...");

  const output = await model.generate(prompt);

  console.log(output);
  return output;
}