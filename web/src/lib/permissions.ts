export const projectRoles = [
  "read",
  "triage",
  "write",
  "maintain",
  "admin",
] as const;

export type ProjectRole = (typeof projectRoles)[number];
export type ProjectPermission =
  | "view"
  | "review"
  | "write"
  | "maintain"
  | "admin";

const roleLevel: Record<ProjectRole, number> = {
  read: 0,
  triage: 1,
  write: 2,
  maintain: 3,
  admin: 4,
};

const permissionLevel: Record<ProjectPermission, number> = {
  view: 0,
  review: 1,
  write: 2,
  maintain: 3,
  admin: 4,
};

export function can(
  role: ProjectRole | null | undefined,
  permission: ProjectPermission,
): boolean {
  return role !== null &&
    role !== undefined &&
    roleLevel[role] >= permissionLevel[permission];
}
