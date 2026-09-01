import { Router } from "express";
import { requireSession } from "../auth-middleware.js";
import { requireProjectAccess, roles } from "./authorization.js";
import { normalizeInviteEmail } from "./collaboration-policy.js";
import * as service from "./collaboration-service.js";
import {
  ApiError,
  asyncRoute,
  enumValue,
  rejectUnknownKeys,
  requireObject,
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

function rejectActionBody(value: unknown): void {
  if (value === undefined) return;
  rejectUnknownKeys(requireObject(value), []);
}

router.get(
  "/projects/:projectId/invitations",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    response.json(await service.listProjectInvitations(projectId));
  }),
);

router.post(
  "/projects/:projectId/invitations",
  asyncRoute(async (request, response) => {
    const projectId = uuidParam(request.params.projectId, "projectId");
    const userId = sessionUserId(response.locals);
    const access = await requireProjectAccess(projectId, userId, "maintain");
    const body = requireObject(request.body);
    rejectUnknownKeys(body, ["email", "role"]);
    const created = await service.createInvitation(
      projectId,
      userId,
      access.role,
      normalizeInviteEmail(body.email),
      enumValue(body.role, roles, "role"),
    );
    response.status(201).json(created);
  }),
);

router.post(
  "/projects/:projectId/invitations/:invitationId/revoke",
  asyncRoute(async (request, response) => {
    rejectActionBody(request.body);
    const projectId = uuidParam(request.params.projectId, "projectId");
    const access = await requireProjectAccess(
      projectId,
      sessionUserId(response.locals),
      "maintain",
    );
    response.json(
      await service.revokeInvitation(
        projectId,
        uuidParam(request.params.invitationId, "invitationId"),
        access.role,
      ),
    );
  }),
);

router.post(
  "/invitations/:invitationId/accept",
  asyncRoute(async (request, response) => {
    rejectActionBody(request.body);
    response.json(
      await service.acceptInvitation(
        uuidParam(request.params.invitationId, "invitationId"),
        sessionUserId(response.locals),
      ),
    );
  }),
);

router.post(
  "/invitations/:invitationId/decline",
  asyncRoute(async (request, response) => {
    rejectActionBody(request.body);
    response.json(
      await service.declineInvitation(
        uuidParam(request.params.invitationId, "invitationId"),
        sessionUserId(response.locals),
      ),
    );
  }),
);

router.get(
  "/notifications",
  asyncRoute(async (_request, response) => {
    response.json(
      await service.listNotifications(sessionUserId(response.locals)),
    );
  }),
);

router.get(
  "/notifications/unread-count",
  asyncRoute(async (_request, response) => {
    response.json(
      await service.countUnreadNotifications(sessionUserId(response.locals)),
    );
  }),
);

router.patch(
  "/notifications/:notificationId/read",
  asyncRoute(async (request, response) => {
    rejectActionBody(request.body);
    response.json(
      await service.markNotificationRead(
        uuidParam(request.params.notificationId, "notificationId"),
        sessionUserId(response.locals),
      ),
    );
  }),
);

export const collaborationRoutes = router;
