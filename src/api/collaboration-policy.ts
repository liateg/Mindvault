import { ApiError } from "./validation.js";

export type CollaborationProjectRole =
  | "read"
  | "triage"
  | "write"
  | "maintain"
  | "admin";

export type ActionableInvitation = {
  id: string;
  projectId: string;
  inviteeUserId: string;
  requestedRole: CollaborationProjectRole;
  status: "pending" | "accepted" | "declined" | "revoked";
  expiresAt: Date;
};

export function normalizeInviteEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "email must be a valid email address");
  }
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new ApiError(400, "email must be a valid email address");
  }
  return email;
}

export function assertInvitationRoleAllowed(
  actorRole: CollaborationProjectRole,
  requestedRole: CollaborationProjectRole,
): void {
  if (requestedRole === "admin" && actorRole !== "admin") {
    throw new ApiError(403, "Only admins can invite project admins");
  }
}

export function requireActionableInvitation<T extends ActionableInvitation>(
  invitation: T | undefined,
  inviteeUserId: string,
  now: Date,
): T {
  if (
    !invitation ||
    invitation.inviteeUserId !== inviteeUserId ||
    invitation.status !== "pending"
  ) {
    throw new ApiError(404, "Invitation not found");
  }
  if (invitation.expiresAt <= now) {
    throw new ApiError(410, "Invitation has expired");
  }
  return invitation;
}

export function requireOwnedNotification<
  T extends { recipientUserId: string },
>(notification: T | undefined, recipientUserId: string): T {
  if (!notification || notification.recipientUserId !== recipientUserId) {
    throw new ApiError(404, "Notification not found");
  }
  return notification;
}

export interface InvitationAcceptanceOperations<
  T extends ActionableInvitation,
  R,
> {
  lockInvitation(invitationId: string): Promise<T | undefined>;
  addMember(
    projectId: string,
    userId: string,
    role: CollaborationProjectRole,
  ): Promise<boolean>;
  markAccepted(invitationId: string, now: Date): Promise<R | undefined>;
  markNotificationRead(
    invitationId: string,
    userId: string,
    now: Date,
  ): Promise<void>;
}

export async function acceptInvitationTransaction<
  T extends ActionableInvitation,
  R,
>(
  operations: InvitationAcceptanceOperations<T, R>,
  invitationId: string,
  inviteeUserId: string,
  now: Date,
): Promise<R> {
  const invitation = requireActionableInvitation(
    await operations.lockInvitation(invitationId),
    inviteeUserId,
    now,
  );
  if (
    !(await operations.addMember(
      invitation.projectId,
      inviteeUserId,
      invitation.requestedRole,
    ))
  ) {
    throw new ApiError(409, "User is already a project member");
  }
  const accepted = await operations.markAccepted(invitationId, now);
  if (!accepted) {
    throw new ApiError(409, "Invitation is no longer pending");
  }
  await operations.markNotificationRead(invitationId, inviteeUserId, now);
  return accepted;
}
