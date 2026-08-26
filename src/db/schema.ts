import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export const projectRole = pgEnum("project_role", [
  "admin",
  "maintain",
  "write",
  "read",
]);

export const decisionStatus = pgEnum("decision_status", [
  "proposed",
  "approved",
  "rejected",
  "superseded",
]);

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

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, {
    fields: [project.ownerUserId],
    references: [user.id],
    relationName: "projectOwner",
  }),
  members: many(projectMember),
  decisions: many(decision),
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

export const decisionRelations = relations(decision, ({ one }) => ({
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
}));

export const userApplicationRelations = relations(user, ({ many }) => ({
  ownedProjects: many(project, { relationName: "projectOwner" }),
  projectMemberships: many(projectMember, {
    relationName: "projectMemberUser",
  }),
  proposedDecisions: many(decision, { relationName: "decisionProposer" }),
  reviewedDecisions: many(decision, { relationName: "decisionReviewer" }),
}));
