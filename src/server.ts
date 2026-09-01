import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireSession } from "./auth-middleware.js";
import { askRoutes } from "./api/ask-route.js";
import { collaborationRoutes } from "./api/collaboration-routes.js";
import { apiErrorHandler, projectRoutes } from "./api/project-routes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../web/dist",
);
const indexHtml = path.join(webDist, "index.html");

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/api/me", requireSession, (_request, response) => {
  response.json(response.locals.session);
});

app.use("/api", projectRoutes);
app.use("/api", collaborationRoutes);
app.use(askRoutes);

if (fs.existsSync(indexHtml)) {
  app.use(express.static(webDist, { index: false }));
  app.use((request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();
      return;
    }
    if (request.path.startsWith("/api") || request.path.startsWith("/ask")) {
      next();
      return;
    }
    response.sendFile(indexHtml);
  });
}

app.use(apiErrorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`Mindvault API listening on port ${port}`);
});
