import { Router } from "express";
import { requireSession } from "../auth-middleware.js";
import { streamContent } from "../llm/service.js";
import {
  parseAskBody,
  prepareProjectAskPrompt,
} from "./ask-service.js";
import { requireProjectAccess } from "./authorization.js";
import { listApprovedDecisionsForContext } from "./project-service.js";
import {
  ApiError,
  asyncRoute,
} from "./validation.js";
import { writeAskStream } from "./ask-sse.js";

type ResponseStatus = "OK" | "ERROR" | "TIMEOUT" | "ABORTED";

const maxTimeout = 30_000;
const router = Router();

function sessionUserId(locals: Record<string, unknown>): string {
  const session = locals.session as { user?: { id?: unknown } } | undefined;
  const id = session?.user?.id;
  if (typeof id !== "string" || !id) {
    throw new ApiError(401, "Authentication required");
  }
  return id;
}

router.post(
  "/ask",
  requireSession,
  asyncRoute(async (request, response) => {
    const { projectId, prompt } = parseAskBody(request.body);
    const contextualPrompt = await prepareProjectAskPrompt(
      projectId,
      sessionUserId(response.locals),
      prompt,
      {
        requireAccess: requireProjectAccess,
        listApprovedDecisions: listApprovedDecisionsForContext,
      },
    );

    let responseStatus: ResponseStatus = "ERROR";
    const abortController = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, maxTimeout);
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
      await writeAskStream(
        streamContent(contextualPrompt.text, abortController.signal),
        (chunk) => response.write(chunk),
        abortController.signal,
      );

      responseStatus = "OK";
      response.write("event: done\ndata: {}\n\n");
      response.end();
    } catch (error) {
      console.error(error);
      if (timedOut) {
        responseStatus = "TIMEOUT";
      }
      if (
        (!timedOut && abortController.signal.aborted) ||
        response.writableEnded
      ) {
        if (abortController.signal.aborted) {
          responseStatus = "ABORTED";
        }
        return;
      }

      const message =
        responseStatus === "TIMEOUT"
          ? "The AI request timed out. Please try again."
          : "Failed to generate content";
      response.write(
        `event: error\ndata: ${JSON.stringify({
          message,
          responseStatus,
        })}\n\n`,
      );
      response.end();
    } finally {
      clearTimeout(timeout);
      console.log("responseStatus", responseStatus);
    }
  }),
);

export const askRoutes = router;
