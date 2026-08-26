import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

export async function requireSession(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    response.locals.session = session;
    next();
  } catch (error) {
    next(error);
  }
}
