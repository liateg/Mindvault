import type { ProjectRole } from "./permissions";

export type { ProjectRole };

export type DecisionStatus = "proposed" | "approved" | "rejected" | "superseded";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked";

export type Project = {
  id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  role: ProjectRole;
};

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  name: string;
  email: string;
  image: string | null;
};

export type Decision = {
  id: string;
  projectId: string;
  title: string;
  proposalContent: string;
  status: DecisionStatus;
  proposerUserId: string;
  reviewerUserId: string | null;
  reviewedAt: string | null;
  llmReasoningSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInvitation = {
  id: string;
  projectId: string;
  inviterUserId: string;
  inviteeUserId: string;
  inviteeName: string;
  inviteeEmail: string;
  requestedRole: ProjectRole;
  status: InvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationItem = {
  id: string;
  type: "project_invitation";
  invitationId: string | null;
  projectId: string | null;
  payload: {
    projectTitle: string;
    inviterName: string;
    requestedRole: ProjectRole;
  };
  invitationStatus: InvitationStatus | null;
  invitationExpiresAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type UnreadCount = {
  count: number;
};
