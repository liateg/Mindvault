import type { RequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export function rejectUnknownKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new ApiError(400, `Unknown field: ${unknown[0]}`);
  }
}

export function requiredText(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${key} must be a non-empty string`);
  }
  return value.trim();
}

export function optionalText(
  body: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError(400, `${key} must be a string or null`);
  }
  return value.trim();
}

export function presentOptionalText(
  body: Record<string, unknown>,
  key: string,
): string | null {
  const value = optionalText(body, key);
  if (value === undefined) {
    throw new ApiError(400, `${key} is required`);
  }
  return value;
}

export function requireAtLeastOne(
  body: Record<string, unknown>,
  keys: readonly string[],
): void {
  if (!keys.some((key) => body[key] !== undefined)) {
    throw new ApiError(400, "At least one editable field is required");
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidParam(value: unknown, name: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new ApiError(400, `${name} must be a valid UUID`);
  }
  return value;
}

export function stringParam(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${name} is required`);
  }
  return value;
}

export function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  name: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ApiError(
      400,
      `${name} must be one of: ${allowed.join(", ")}`,
    );
  }
  return value as T[number];
}
