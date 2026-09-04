import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { user } from "../db/auth-schema.js";
import { decision, decisionChunk, project, projectMember } from "../db/schema.js";
import {
  MAX_CONTEXT_DECISIONS,
  type ApprovedDecisionContext,
  type PersistedDecisionChunk,
} from "../llm/decision-context.js";
import { can, type ProjectRole } from "./authorization.js";
import { ApiError } from "./validation.js";

export type ProjectInput = {
  title: string;
  description?: string | null;
};

export type DecisionInput = {
  title: string;
  proposalContent: string;
  llmReasoningSummary?: string | null;
};

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new ApiError(404, message);
  return row;
}

export async function listProjects(userId: string) {
  return db
    .select({
      id: project.id,
      title: project.title,
      description: project.description,
      ownerUserId: project.ownerUserId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      role: projectMember.role,
    })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(eq(projectMember.userId, userId))
    .orderBy(desc(project.updatedAt));
}

export async function createProject(userId: string, input: ProjectInput) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(project)
      .values({ ...input, ownerUserId: userId })
      .returning();
    const created = firstOrThrow(rows, "Failed to create project");
    await tx.insert(projectMember).values({
      projectId: created.id,
      userId,
      role: "admin",
    });
    return { ...created, role: "admin" as const };
  });
}

export async function updateProject(
  projectId: string,
  input: Partial<ProjectInput>,
) {
  const rows = await db
    .update(project)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(project.id, projectId))
    .returning();
  return firstOrThrow(rows, "Project not found");
}

export async function deleteProject(projectId: string) {
  const rows = await db
    .delete(project)
    .where(eq(project.id, projectId))
    .returning({ id: project.id });
  firstOrThrow(rows, "Project not found");
}

export async function listMembers(projectId: string) {
  return db
    .select({
      projectId: projectMember.projectId,
      userId: projectMember.userId,
      role: projectMember.role,
      joinedAt: projectMember.joinedAt,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.joinedAt);
}

export async function getMember(projectId: string, userId: string) {
  const rows = await db
    .select({
      projectId: projectMember.projectId,
      userId: projectMember.userId,
      role: projectMember.role,
      joinedAt: projectMember.joinedAt,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .limit(1);
  return firstOrThrow(rows, "Project member not found");
}

function assertCanManageMember(
  actorRole: ProjectRole,
  ownerUserId: string,
  targetUserId: string,
  currentRole: ProjectRole | undefined,
  nextRole?: ProjectRole,
): void {
  if (targetUserId === ownerUserId && nextRole !== "admin") {
    throw new ApiError(409, "The project owner must remain an admin member");
  }
  const involvesAdmin = currentRole === "admin" || nextRole === "admin";
  if (involvesAdmin && !can(actorRole, "admin")) {
    throw new ApiError(403, "Only admins can manage admin memberships");
  }
}

export async function addMember(
  projectId: string,
  ownerUserId: string,
  actorRole: ProjectRole,
  userId: string,
  role: ProjectRole,
) {
  assertCanManageMember(actorRole, ownerUserId, userId, undefined, role);
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!existingUser) throw new ApiError(404, "User not found");

  const rows = await db
    .insert(projectMember)
    .values({ projectId, userId, role })
    .onConflictDoNothing()
    .returning();
  if (!rows[0]) throw new ApiError(409, "User is already a project member");
  return getMember(projectId, userId);
}

export async function updateMember(
  projectId: string,
  ownerUserId: string,
  actorRole: ProjectRole,
  userId: string,
  role: ProjectRole,
) {
  const current = await getMember(projectId, userId);
  assertCanManageMember(actorRole, ownerUserId, userId, current.role, role);
  const rows = await db
    .update(projectMember)
    .set({ role })
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .returning();
  firstOrThrow(rows, "Project member not found");
  return getMember(projectId, userId);
}

export async function removeMember(
  projectId: string,
  ownerUserId: string,
  actorRole: ProjectRole,
  userId: string,
) {
  const current = await getMember(projectId, userId);
  if (userId === ownerUserId) {
    throw new ApiError(409, "The project owner cannot be removed");
  }
  assertCanManageMember(actorRole, ownerUserId, userId, current.role);
  await db
    .delete(projectMember)
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    );
}

export async function listDecisions(projectId: string) {
  return db
    .select()
    .from(decision)
    .where(eq(decision.projectId, projectId))
    .orderBy(desc(decision.updatedAt));
}

export async function listApprovedDecisionsForContext(
  projectId: string,
): Promise<ApprovedDecisionContext[]> {
  const decisions = await db
    .select({
      id: decision.id,
      title: decision.title,
      proposalContent: decision.proposalContent,
      llmReasoningSummary: decision.llmReasoningSummary,
    })
    .from(decision)
    .where(
      and(
        eq(decision.projectId, projectId),
        eq(decision.status, "approved"),
      ),
    )
    .orderBy(desc(decision.updatedAt))
    .limit(MAX_CONTEXT_DECISIONS);

  if (decisions.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: decisionChunk.id,
      decisionId: decisionChunk.decisionId,
      chunkKind: decisionChunk.chunkKind,
      sectionIndex: decisionChunk.sectionIndex,
      sectionCount: decisionChunk.sectionCount,
      proposalSlice: decisionChunk.proposalSlice,
    })
    .from(decisionChunk)
    .where(
      inArray(
        decisionChunk.decisionId,
        decisions.map((item) => item.id),
      ),
    );

  const chunksByDecision = new Map<string, PersistedDecisionChunk[]>();
  for (const row of rows) {
    const persisted: PersistedDecisionChunk = {
      chunkId: row.id,
      chunkKind: row.chunkKind,
      proposalSlice: row.proposalSlice,
    };
    if (row.sectionIndex !== null) {
      persisted.sectionIndex = row.sectionIndex;
    }
    if (row.sectionCount !== null) {
      persisted.sectionCount = row.sectionCount;
    }
    const list = chunksByDecision.get(row.decisionId) ?? [];
    list.push(persisted);
    chunksByDecision.set(row.decisionId, list);
  }

  for (const [, list] of chunksByDecision) {
    list.sort(
      (left, right) => (left.sectionIndex ?? 0) - (right.sectionIndex ?? 0),
    );
  }

  return decisions.map((item) => {
    const persistedChunks = chunksByDecision.get(item.id);
    if (persistedChunks === undefined || persistedChunks.length === 0) {
      return item;
    }
    return { ...item, persistedChunks };
  });
}

export async function getDecision(projectId: string, decisionId: string) {
  const rows = await db
    .select()
    .from(decision)
    .where(
      and(eq(decision.projectId, projectId), eq(decision.id, decisionId)),
    )
    .limit(1);
  return firstOrThrow(rows, "Decision not found");
}

export async function createDecision(
  projectId: string,
  proposerUserId: string,
  input: DecisionInput,
) {
  const rows = await db
    .insert(decision)
    .values({ ...input, projectId, proposerUserId })
    .returning();
  return firstOrThrow(rows, "Failed to create decision");
}

export async function updateDecision(
  projectId: string,
  decisionId: string,
  input: Partial<DecisionInput>,
) {
  const rows = await db
    .update(decision)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(eq(decision.projectId, projectId), eq(decision.id, decisionId)),
    )
    .returning();
  return firstOrThrow(rows, "Decision not found");
}

export async function reviewDecision(
  projectId: string,
  decisionId: string,
  reviewerUserId: string,
  status: "approved" | "rejected" | "superseded",
) {
  const rows = await db
    .update(decision)
    .set({
      status,
      reviewerUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(decision.projectId, projectId), eq(decision.id, decisionId)),
    )
    .returning();
  return firstOrThrow(rows, "Decision not found");
}

export async function deleteDecision(
  projectId: string,
  decisionId: string,
) {
  const rows = await db
    .delete(decision)
    .where(
      and(eq(decision.projectId, projectId), eq(decision.id, decisionId)),
    )
    .returning({ id: decision.id });
  firstOrThrow(rows, "Decision not found");
}
