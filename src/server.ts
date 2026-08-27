import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { requireSession } from "./auth-middleware.js";
import { askRoutes } from "./api/ask-route.js";
import { apiErrorHandler, projectRoutes } from "./api/project-routes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/api/me", requireSession, (_request, response) => {
  response.json(response.locals.session);
});

app.use("/api", projectRoutes);
app.use(askRoutes);

app.use(apiErrorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`Mindvault API listening on port ${port}`);
});