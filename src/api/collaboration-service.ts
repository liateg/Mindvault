import { and, desc, eq, gt, ilike, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/auth-schema.js";
import {
  notification,
  project,
  projectInvitation,
  projectMember,
  type ProjectInvitationNotificationPayload,
} from "../db/schema.js";
import type { ProjectRole } from "./authorization.js";
import {
  acceptInvitationTransaction,
  assertInvitationRoleAllowed,
  requireOwnedNotification,
} from "./collaboration-policy.js";
import { ApiError } from "./validation.js";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new ApiError(404, message);
  return row;
}

function invitationConflict(): ApiError {
  return new ApiError(409, "Invitation cannot be created");
}

export async function createInvitation(
  projectId: string,
  inviterUserId: string,
  actorRole: ProjectRole,
  email: string,
  requestedRole: ProjectRole,
  now = new Date(),
) {
  assertInvitationRoleAllowed(actorRole, requestedRole);

  return db.transaction(async (tx) => {
    const [invitee] = await tx
      .select({ id: user.id })
      .from(user)
      .where(ilike(user.email, email))
      .limit(1);
    if (!invitee || invitee.id === inviterUserId) throw invitationConflict();

    const [membership] = await tx
      .select({ userId: projectMember.userId })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.userId, invitee.id),
        ),
      )
      .limit(1);
    if (membership) throw invitationConflict();

    const [projectDetails] = await tx
      .select({
        title: project.title,
        inviterName: user.name,
      })
      .from(project)
      .innerJoin(user, eq(user.id, inviterUserId))
      .where(eq(project.id, projectId))
      .limit(1);
    if (!projectDetails) throw new ApiError(404, "Project not found");

    await tx
      .update(projectInvitation)
      .set({ status: "revoked", respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(projectInvitation.projectId, projectId),
          eq(projectInvitation.inviteeUserId, invitee.id),
          eq(projectInvitation.status, "pending"),
          lte(projectInvitation.expiresAt, now),
        ),
      );

    const rows = await tx
      .insert(projectInvitation)
      .values({
        projectId,
        inviterUserId,
        inviteeUserId: invitee.id,
        requestedRole,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
      })
      .onConflictDoNothing()
      .returning();
    const created = rows[0];
    if (!created) throw invitationConflict();

    const payload: ProjectInvitationNotificationPayload = {
      projectTitle: projectDetails.title,
      inviterName: projectDetails.inviterName,
      requestedRole,
    };
    await tx.insert(notification).values({
      recipientUserId: invitee.id,
      type: "project_invitation",
      invitationId: created.id,
      projectId,
      payload,
    });

    return created;
  });
}

export async function listProjectInvitations(projectId: string) {
  return db
    .select({
      id: projectInvitation.id,
      projectId: projectInvitation.projectId,
      inviterUserId: projectInvitation.inviterUserId,
      inviteeUserId: projectInvitation.inviteeUserId,
      inviteeName: user.name,
      inviteeEmail: user.email,
      requestedRole: projectInvitation.requestedRole,
      status: projectInvitation.status,
      expiresAt: projectInvitation.expiresAt,
      respondedAt: projectInvitation.respondedAt,
      createdAt: projectInvitation.createdAt,
      updatedAt: projectInvitation.updatedAt,
    })
    .from(projectInvitation)
    .innerJoin(user, eq(user.id, projectInvitation.inviteeUserId))
    .where(eq(projectInvitation.projectId, projectId))
    .orderBy(desc(projectInvitation.createdAt));
}

export async function acceptInvitation(
  invitationId: string,
  inviteeUserId: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    return acceptInvitationTransaction(
      {
        lockInvitation: async (id) => {
          const [found] = await tx
            .select()
            .from(projectInvitation)
            .where(eq(projectInvitation.id, id))
            .limit(1)
            .for("update");
          return found;
        },
        addMember: async (projectId, userId, role) => {
          const inserted = await tx
            .insert(projectMember)
            .values({ projectId, userId, role })
            .onConflictDoNothing()
            .returning({ userId: projectMember.userId });
          return Boolean(inserted[0]);
        },
        markAccepted: async (id, acceptedAt) => {
          const [accepted] = await tx
            .update(projectInvitation)
            .set({
              status: "accepted",
              respondedAt: acceptedAt,
              updatedAt: acceptedAt,
            })
            .where(
              and(
                eq(projectInvitation.id, id),
                eq(projectInvitation.status, "pending"),
              ),
            )
            .returning();
          return accepted;
        },
        markNotificationRead: async (id, userId, readAt) => {
          await tx
            .update(notification)
            .set({ readAt })
            .where(
              and(
                eq(notification.invitationId, id),
                eq(notification.recipientUserId, userId),
                isNull(notification.readAt),
              ),
            );
        },
      },
      invitationId,
      inviteeUserId,
      now,
    );
  });
}

export async function declineInvitation(
  invitationId: string,
  inviteeUserId: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [declined] = await tx
      .update(projectInvitation)
      .set({ status: "declined", respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(projectInvitation.id, invitationId),
          eq(projectInvitation.inviteeUserId, inviteeUserId),
          eq(projectInvitation.status, "pending"),
          gt(projectInvitation.expiresAt, now),
        ),
      )
      .returning();
    if (!declined) {
      const [owned] = await tx
        .select({ expiresAt: projectInvitation.expiresAt })
        .from(projectInvitation)
        .where(
          and(
            eq(projectInvitation.id, invitationId),
            eq(projectInvitation.inviteeUserId, inviteeUserId),
            eq(projectInvitation.status, "pending"),
          ),
        )
        .limit(1);
      if (owned && owned.expiresAt <= now) {
        throw new ApiError(410, "Invitation has expired");
      }
      throw new ApiError(404, "Invitation not found");
    }

    await tx
      .update(notification)
      .set({ readAt: now })
      .where(
        and(
          eq(notification.invitationId, invitationId),
          eq(notification.recipientUserId, inviteeUserId),
          isNull(notification.readAt),
        ),
      );
    return declined;
  });
}

export async function revokeInvitation(
  projectId: string,
  invitationId: string,
  actorRole: ProjectRole,
  now = new Date(),
) {
  const [existing] = await db
    .select({ requestedRole: projectInvitation.requestedRole })
    .from(projectInvitation)
    .where(
      and(
        eq(projectInvitation.id, invitationId),
        eq(projectInvitation.projectId, projectId),
        eq(projectInvitation.status, "pending"),
      ),
    )
    .limit(1);
  if (!existing) throw new ApiError(404, "Invitation not found");
  assertInvitationRoleAllowed(actorRole, existing.requestedRole);

  const [revoked] = await db
    .update(projectInvitation)
    .set({ status: "revoked", respondedAt: now, updatedAt: now })
    .where(
      and(
        eq(projectInvitation.id, invitationId),
        eq(projectInvitation.projectId, projectId),
        eq(projectInvitation.status, "pending"),
      ),
    )
    .returning();
  if (!revoked) throw new ApiError(409, "Invitation is no longer pending");
  return revoked;
}

export async function listNotifications(recipientUserId: string) {
  return db
    .select({
      id: notification.id,
      type: notification.type,
      invitationId: notification.invitationId,
      projectId: notification.projectId,
      payload: notification.payload,
      invitationStatus: projectInvitation.status,
      invitationExpiresAt: projectInvitation.expiresAt,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .leftJoin(
      projectInvitation,
      eq(projectInvitation.id, notification.invitationId),
    )
    .where(eq(notification.recipientUserId, recipientUserId))
    .orderBy(desc(notification.createdAt))
    .limit(100);
}

export async function countUnreadNotifications(recipientUserId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(
      and(
        eq(notification.recipientUserId, recipientUserId),
        isNull(notification.readAt),
      ),
    );
  return { count: result?.count ?? 0 };
}

export async function markNotificationRead(
  notificationId: string,
  recipientUserId: string,
  now = new Date(),
) {
  const rows = await db
    .update(notification)
    .set({ readAt: now })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.recipientUserId, recipientUserId),
      ),
    )
    .returning();
  return requireOwnedNotification(rows[0], recipientUserId);
}
