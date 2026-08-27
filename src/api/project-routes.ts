import { Router, type ErrorRequestHandler } from "express";
import { requireSession } from "../auth-middleware.js";
import {
  requireProjectAccess,
  roles,
} from "./authorization.js";
import * as service from "./project-service.js";
import {
  ApiError,
  asyncRoute,
  enumValue,
  optionalText,
  presentOptionalText,
  rejectUnknownKeys,
  requireAtLeastOne,
  requiredText,
  requireObject,
  stringParam,
  uuidParam,
} from "./validation.js";

const router = Router();
router.use(requireSession);

function sessionUserId(locals: Record<string, unknown>): string {
  const session = locals.session as { user?: { id?: unknown } } | undefined;
  const id = session?.user?.id;
  if (typeof id !== "string" || !id) {
    throw new ApiError(401, "Authentication required");
  }
  return id;
}

router.get(
  "/projects",
  asyncRoute(async (_request, response) => {
    response.json(await service.listProjects(sessionUserId(response.locals)));
  }),
);

router.post(
  "/projects",
  asyncRoute(async (request, response) => {
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["title", "description"]);
    const description = optionalText(body, "description");
    const created = await service.createProject(
      sessionUserId(response.locals),
      {
        title: requiredText(body, "title"),
        ...(description !== undefined ? { description } : {}),
      },
    );
    response.status(201).json(created);
  }),
);

router.get(
  "/projects/:projectId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const access = await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "view",
    );
    response.json({ ...access.project, role: access.role });
  }),
);

router.patch(
  "/projects/:projectId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["title", "description"]);
    requireAtLeastOne(body, ["title", "description"]);
    response.json(
      await service.updateProject(projectId, {
        ...(body.title !== undefined
          ? { title: requiredText(body, "title") }
          : {}),
        ...(body.description !== undefined
          ? { description: presentOptionalText(body, "description") }
          : {}),
      }),
    );
  }),
);

router.delete(
  "/projects/:projectId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "admin",
    );
    await service.deleteProject(projectId);
    response.status(204).end();
  }),
);

router.get(
  "/projects/:projectId/members",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "view",
    );
    response.json(await service.listMembers(projectId));
  }),
);

router.get(
  "/projects/:projectId/members/:userId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "view",
    );
    response.json(
      await service.getMember(
        projectId,
        stringParam(request.params.userId, "userId"),
      ),
    );
  }),
);

router.post(
  "/projects/:projectId/members",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const access = await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["userId", "role"]);
    const member = await service.addMember(
      projectId,
      access.project.ownerUserId,
      access.role,
      requiredText(body, "userId"),
      enumValue(body.role, roles, "role"),
    );
    response.status(201).json(member);
  }),
);

router.patch(
  "/projects/:projectId/members/:userId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const access = await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["role"]);
    response.json(
      await service.updateMember(
        projectId,
        access.project.ownerUserId,
        access.role,
        stringParam(request.params.userId, "userId"),
        enumValue(body.role, roles, "role"),
      ),
    );
  }),
);

router.delete(
  "/projects/:projectId/members/:userId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const access = await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    await service.removeMember(
      projectId,
      access.project.ownerUserId,
      access.role,
      stringParam(request.params.userId, "userId"),
    );
    response.status(204).end();
  }),
);

router.get(
  "/projects/:projectId/decisions",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "view",
    );
    response.json(await service.listDecisions(projectId));
  }),
);

router.get(
  "/projects/:projectId/decisions/:decisionId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "view",
    );
    response.json(
      await service.getDecision(
        projectId,
        uuidParam(request.params.decisionId, "decisionId"),
      ),
    );
  }),
);

router.post(
  "/projects/:projectId/decisions",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const userId = sessionUserId(response.locals);
    await requireProjectAccess(projectId, userId, "write");
    const body = requireObject(request.body);
    rejectUnknownKeys(body, [
      "title",
      "proposalContent",
      "llmReasoningSummary",
    ]);
    const llmReasoningSummary = optionalText(body, "llmReasoningSummary");
    const created = await service.createDecision(projectId, userId, {
      title: requiredText(body, "title"),
      proposalContent: requiredText(body, "proposalContent"),
      ...(llmReasoningSummary !== undefined ? { llmReasoningSummary } : {}),
    });
    response.status(201).json(created);
  }),
);

router.patch(
  "/projects/:projectId/decisions/:decisionId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "write",
    );
    const body = requireObject(request.body);
    const keys = ["title", "proposalContent", "llmReasoningSummary"] as const;
    rejectUnknownKeys(body, keys);
    requireAtLeastOne(body, keys);
    response.json(
      await service.updateDecision(
        projectId,
        uuidParam(request.params.decisionId, "decisionId"),
        {
          ...(body.title !== undefined
            ? { title: requiredText(body, "title") }
            : {}),
          ...(body.proposalContent !== undefined
            ? { proposalContent: requiredText(body, "proposalContent") }
            : {}),
          ...(body.llmReasoningSummary !== undefined
            ? {
                llmReasoningSummary: presentOptionalText(
                  body,
                  "llmReasoningSummary",
                ),
              }
            : {}),
        },
      ),
    );
  }),
);

router.post(
  "/projects/:projectId/decisions/:decisionId/review",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const userId = sessionUserId(response.locals);
    await requireProjectAccess(projectId, userId, "review");
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["status"]);
    response.json(
      await service.reviewDecision(
        projectId,
        uuidParam(request.params.decisionId, "decisionId"),
        userId,
        enumValue(
          body.status,
          ["approved", "rejected", "superseded"] as const,
          "status",
        ),
      ),
    );
  }),
);

router.delete(
  "/projects/:projectId/decisions/:decisionId",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "write",
    );
    await service.deleteDecision(
      projectId,
      uuidParam(request.params.decisionId, "decisionId"),
    );
    response.status(204).end();
  }),
);

export const projectRoutes = router;

type DatabaseError = Error & { code?: string };

export const apiErrorHandler: ErrorRequestHandler = (
  error: DatabaseError,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  if (error.code === "23505") {
    response.status(409).json({ error: "Resource already exists" });
    return;
  }
  if (error.code === "23503") {
    response.status(409).json({ error: "Resource is still referenced" });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};
