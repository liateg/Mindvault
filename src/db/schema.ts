import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export const projectRole = pgEnum("project_role", [
  "admin",
  "maintain",
  "write",
  "triage",
  "read",
]);

export const decisionStatus = pgEnum("decision_status", [
  "proposed",
  "approved",
  "rejected",
  "superseded",
]);

export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "revoked",
]);

export const notificationType = pgEnum("notification_type", [
  "project_invitation",
]);

export const chunkKind = pgEnum("chunk_kind", ["full", "section"]);

export const project = pgTable(
  "project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("project_owner_user_id_idx").on(table.ownerUserId)],
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: projectRole("role").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("project_member_user_id_idx").on(table.userId),
  ],
);

export const decision = pgTable(
  "decision",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    proposalContent: text("proposal_content").notNull(),
    status: decisionStatus("status").default("proposed").notNull(),
    proposerUserId: text("proposer_user_id")
      .notNull()
      .references(() => user.id),
    reviewerUserId: text("reviewer_user_id").references(() => user.id),
    reviewedAt: timestamp("reviewed_at"),
    llmReasoningSummary: text("llm_reasoning_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("decision_project_status_idx").on(table.projectId, table.status),
    index("decision_proposer_user_id_idx").on(table.proposerUserId),
    index("decision_reviewer_user_id_idx").on(table.reviewerUserId),
  ],
);

export const decisionChunk = pgTable(
  "decision_chunk",
  {
    id: text("id").primaryKey(),
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => decision.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    chunkKind: chunkKind("chunk_kind").notNull(),
    sectionIndex: integer("section_index"),
    sectionCount: integer("section_count"),
    proposalSlice: text("proposal_slice").notNull(),
    sourceHash: text("source_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("decision_chunk_decision_id_idx").on(table.decisionId),
    index("decision_chunk_project_id_idx").on(table.projectId),
  ],
);

export const projectInvitation = pgTable(
  "project_invitation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => user.id),
    inviteeUserId: text("invitee_user_id")
      .notNull()
      .references(() => user.id),
    requestedRole: projectRole("requested_role").notNull(),
    status: invitationStatus("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_invitation_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    index("project_invitation_invitee_status_idx").on(
      table.inviteeUserId,
      table.status,
    ),
    uniqueIndex("project_invitation_pending_uidx")
      .on(table.projectId, table.inviteeUserId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type ProjectInvitationNotificationPayload = {
  projectTitle: string;
  inviterName: string;
  requestedRole: (typeof projectRole.enumValues)[number];
};

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    invitationId: uuid("invitation_id").references(
      () => projectInvitation.id,
      { onDelete: "cascade" },
    ),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    payload: jsonb("payload")
      .$type<ProjectInvitationNotificationPayload>()
      .notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_recipient_created_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    index("notification_recipient_read_idx").on(
      table.recipientUserId,
      table.readAt,
    ),
    uniqueIndex("notification_invitation_uidx").on(table.invitationId),
  ],
);

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, {
    fields: [project.ownerUserId],
    references: [user.id],
    relationName: "projectOwner",
  }),
  members: many(projectMember),
  decisions: many(decision),
  chunks: many(decisionChunk),
  invitations: many(projectInvitation),
  notifications: many(notification),
}));

export const projectMemberRelations = relations(projectMember, ({ one }) => ({
  project: one(project, {
    fields: [projectMember.projectId],
    references: [project.id],
  }),
  user: one(user, {
    fields: [projectMember.userId],
    references: [user.id],
    relationName: "projectMemberUser",
  }),
}));

export const decisionRelations = relations(decision, ({ one, many }) => ({
  project: one(project, {
    fields: [decision.projectId],
    references: [project.id],
  }),
  proposer: one(user, {
    fields: [decision.proposerUserId],
    references: [user.id],
    relationName: "decisionProposer",
  }),
  reviewer: one(user, {
    fields: [decision.reviewerUserId],
    references: [user.id],
    relationName: "decisionReviewer",
  }),
  chunks: many(decisionChunk),
}));

export const decisionChunkRelations = relations(decisionChunk, ({ one }) => ({
  decision: one(decision, {
    fields: [decisionChunk.decisionId],
    references: [decision.id],
  }),
  project: one(project, {
    fields: [decisionChunk.projectId],
    references: [project.id],
  }),
}));

export const projectInvitationRelations = relations(
  projectInvitation,
  ({ one, many }) => ({
    project: one(project, {
      fields: [projectInvitation.projectId],
      references: [project.id],
    }),
    inviter: one(user, {
      fields: [projectInvitation.inviterUserId],
      references: [user.id],
      relationName: "invitationInviter",
    }),
    invitee: one(user, {
      fields: [projectInvitation.inviteeUserId],
      references: [user.id],
      relationName: "invitationInvitee",
    }),
    notifications: many(notification),
  }),
);

export const notificationRelations = relations(notification, ({ one }) => ({
  recipient: one(user, {
    fields: [notification.recipientUserId],
    references: [user.id],
    relationName: "notificationRecipient",
  }),
  invitation: one(projectInvitation, {
    fields: [notification.invitationId],
    references: [projectInvitation.id],
  }),
  project: one(project, {
    fields: [notification.projectId],
    references: [project.id],
  }),
}));

export const userApplicationRelations = relations(user, ({ many }) => ({
  ownedProjects: many(project, { relationName: "projectOwner" }),
  projectMemberships: many(projectMember, {
    relationName: "projectMemberUser",
  }),
  proposedDecisions: many(decision, { relationName: "decisionProposer" }),
  reviewedDecisions: many(decision, { relationName: "decisionReviewer" }),
  sentInvitations: many(projectInvitation, {
    relationName: "invitationInviter",
  }),
  receivedInvitations: many(projectInvitation, {
    relationName: "invitationInvitee",
  }),
  notifications: many(notification, {
    relationName: "notificationRecipient",
  }),
}));
