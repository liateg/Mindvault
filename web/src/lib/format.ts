export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isInvitationActionable(
  status: string | null | undefined,
  expiresAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (status !== "pending" || !expiresAt) return false;
  return new Date(expiresAt) > now;
}
