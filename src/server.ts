import express from "express";
import { streamContent } from "./llm/service.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.post("/ask", async (request, response) => {
  const prompt = request.body?.prompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    response.status(400).json({ error: "A non-empty prompt is required" });
    return;
  }

  const abortController = new AbortController();

  request.on("aborted", () => abortController.abort());
  response.on("close", () => {
    if (!response.writableEnded) {
      abortController.abort();
    }
  });

  response.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();

  try {
    for await (const event of streamContent(
      prompt,
      abortController.signal,
    )) {
      response.write(
        `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      );
    }

    response.write("event: done\ndata: {}\n\n");
    response.end();
  } catch (error) {
    console.error(error);

    if (abortController.signal.aborted || response.writableEnded) {
      return;
    }

    const status =
      typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 500;

    const message =
      status === 504
        ? "The AI request timed out. Please try again."
        : "Failed to generate content";

    response.write(
      `event: error\ndata: ${JSON.stringify({ status, error: message })}\n\n`,
    );
    response.end();
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Mindvault API listening on port ${port}`);
});