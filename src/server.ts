import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireSession } from "./auth-middleware.js";
import { streamContent } from "./llm/service.js";

type responseStatus='OK' | 'ERROR' | 'TIMEOUT' | 'ABORTED';
const max_timeout = 30_000;

const app = express();
const port = Number(process.env.PORT) || 3000;

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/api/me", requireSession, (_request, response) => {
  response.json(response.locals.session);
});

app.post("/ask", requireSession, async (request, response) => {
  let responseStatus: responseStatus = 'ERROR';
  const prompt = request.body?.prompt;

  if (typeof prompt !== "string" || !prompt.trim()) {
    response.status(400).json({ error: "A non-empty prompt is required" });
    return;
  }

  const abortController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, max_timeout);
  timeout.unref();

  request.on("aborted", () => abortController.abort());
  response.on("close", () => {
    if (!response.writableEnded) {
      abortController.abort();
    }
  });

  response.set({
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

  

 
  //  if (abortController.signal.aborted) {
  //   responseStatus = 'ABORTED';
  //  }
    responseStatus = 'OK';
    // console.log('responseStatus', responseStatus);
    response.write("event: done\ndata: {}\n\n");
    
    response.end();
  } catch (error) {
    console.error(error);
    if (timedOut) {
      responseStatus = 'TIMEOUT';
    
    }
    if (
      (!timedOut && abortController.signal.aborted) ||
      response.writableEnded
    ) {
      if (abortController.signal.aborted) {
        responseStatus = 'ABORTED';
      }
      return;
    }

    
    const message =
      responseStatus === 'TIMEOUT'
        ? "The AI request timed out. Please try again."
        : "Failed to generate content";


    response.write(
      `event: error\ndata: ${JSON.stringify({ message, responseStatus })}\n\n`,
    );
    
    response.end();
  } finally {
    clearTimeout(timeout);
    console.log('responseStatus', responseStatus);
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Mindvault API listening on port ${port}`);
});