import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { project, projectMember } from "../db/schema.js";
import { ApiError } from "./validation.js";

export const roles = ["read", "triage", "write", "maintain", "admin"] as const;
export type ProjectRole = (typeof roles)[number];
export type Permission = "view" | "review" | "write" | "maintain" | "admin";

const roleLevel: Record<ProjectRole, number> = {
  read: 0,
  triage: 1,
  write: 2,
  maintain: 3,
  admin: 4,
};

const permissionLevel: Record<Permission, number> = {
  view: 0,
  review: 1,
  write: 2,
  maintain: 3,
  admin: 4,
};

export function can(role: ProjectRole, permission: Permission): boolean {
  return roleLevel[role] >= permissionLevel[permission];
}

export async function requireProjectAccess(
  projectId: string,
  userId: string,
  permission: Permission,
) {
  const [foundProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  if (!foundProject) {
    throw new ApiError(404, "Project not found");
  }

  const [membership] = await db
    .select()
    .from(projectMember)
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .limit(1);

  const role: ProjectRole | undefined =
    foundProject.ownerUserId === userId ? "admin" : membership?.role;

  if (!role || !can(role, permission)) {
    throw new ApiError(403, "Insufficient project permission");
  }

  return { project: foundProject, role };
}
