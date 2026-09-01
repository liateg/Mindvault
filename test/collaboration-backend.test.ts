import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acceptInvitationTransaction,
  assertInvitationRoleAllowed,
  normalizeInviteEmail,
  requireActionableInvitation,
  requireOwnedNotification,
  type ActionableInvitation,
} from "../src/api/collaboration-policy.js";
import { ApiError } from "../src/api/validation.js";

const now = new Date("2026-09-01T12:00:00.000Z");
const invitation: ActionableInvitation = {
  id: "invitation-1",
  projectId: "project-1",
  inviteeUserId: "invitee-1",
  requestedRole: "write",
  status: "pending",
  expiresAt: new Date("2026-09-02T12:00:00.000Z"),
};

function assertApiError(
  operation: () => unknown,
  status: number,
  message: string,
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === status &&
      error.message === message,
  );
}

test("normalizes invite email without providing a user-search contract", () => {
  assert.equal(normalizeInviteEmail("  Person@Example.COM "), "person@example.com");
  assertApiError(
    () => normalizeInviteEmail("not-an-email"),
    400,
    "email must be a valid email address",
  );
});

test("uses the same private response for foreign and completed invitations", () => {
  assertApiError(
    () => requireActionableInvitation(invitation, "other-user", now),
    404,
    "Invitation not found",
  );
  assertApiError(
    () =>
      requireActionableInvitation(
        { ...invitation, status: "accepted" },
        invitation.inviteeUserId,
        now,
      ),
    404,
    "Invitation not found",
  );
});

test("rejects an expired invitation before membership is created", () => {
  assertApiError(
    () =>
      requireActionableInvitation(
        { ...invitation, expiresAt: now },
        invitation.inviteeUserId,
        now,
      ),
    410,
    "Invitation has expired",
  );
});

test("acceptance performs membership, state, and notification writes in order", async () => {
  const calls: string[] = [];
  const accepted = { ...invitation, status: "accepted" as const };
  const result = await acceptInvitationTransaction(
    {
      lockInvitation: async (id) => {
        calls.push(`lock:${id}`);
        return invitation;
      },
      addMember: async (projectId, userId, role) => {
        calls.push(`member:${projectId}:${userId}:${role}`);
        return true;
      },
      markAccepted: async (id) => {
        calls.push(`accept:${id}`);
        return accepted;
      },
      markNotificationRead: async (id, userId) => {
        calls.push(`read:${id}:${userId}`);
      },
    },
    invitation.id,
    invitation.inviteeUserId,
    now,
  );

  assert.equal(result, accepted);
  assert.deepEqual(calls, [
    "lock:invitation-1",
    "member:project-1:invitee-1:write",
    "accept:invitation-1",
    "read:invitation-1:invitee-1",
  ]);
});

test("duplicate membership aborts acceptance before invitation mutation", async () => {
  const calls: string[] = [];
  await assert.rejects(
    acceptInvitationTransaction(
      {
        lockInvitation: async () => invitation,
        addMember: async () => {
          calls.push("member");
          return false;
        },
        markAccepted: async () => {
          calls.push("accept");
          return invitation;
        },
        markNotificationRead: async () => {
          calls.push("read");
        },
      },
      invitation.id,
      invitation.inviteeUserId,
      now,
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.message === "User is already a project member",
  );
  assert.deepEqual(calls, ["member"]);
});

test("only admins can create or revoke admin invitations", () => {
  assert.doesNotThrow(() => assertInvitationRoleAllowed("maintain", "write"));
  assert.doesNotThrow(() => assertInvitationRoleAllowed("admin", "admin"));
  assertApiError(
    () => assertInvitationRoleAllowed("maintain", "admin"),
    403,
    "Only admins can invite project admins",
  );
});

test("notification ownership and invitation IDOR checks return private 404s", () => {
  assert.equal(
    requireOwnedNotification(
      { id: "notification-1", recipientUserId: "invitee-1" },
      "invitee-1",
    ).id,
    "notification-1",
  );
  assertApiError(
    () =>
      requireOwnedNotification(
        { id: "notification-1", recipientUserId: "invitee-1" },
        "other-user",
      ),
    404,
    "Notification not found",
  );
  assertApiError(
    () => requireActionableInvitation(invitation, "other-user", now),
    404,
    "Invitation not found",
  );
});

test("migration enforces one pending invite and relational ownership", async () => {
  const migrationUrl = new URL(
    "../drizzle/0003_cuddly_sphinx.sql",
    import.meta.url,
  );
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX "project_invitation_pending_uidx"/);
  assert.match(sql, /WHERE "project_invitation"\."status" = 'pending'/);
  assert.match(sql, /notification_recipient_user_id_user_id_fk/);
  assert.match(sql, /notification_invitation_id_project_invitation_id_fk/);
  assert.match(sql, /project_invitation_invitee_user_id_user_id_fk/);
});
