import express from "express";
import { generateContent } from "./llm/service.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.post("/ask", async (request, response) => {
  const prompt = request.body?.prompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    response.status(400).json({ error: "A non-empty prompt is required" });
    return;
  }

  try {
    const output = await generateContent(prompt);
    response.json({ output });
  } catch (error) {
    console.error(error);

    const status =
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500;

    response.status(status).json({
      error:
        status === 504
          ? "The AI request timed out. Please try again."
          : "Failed to generate content",
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Mindvault API listening on port ${port}`);
});