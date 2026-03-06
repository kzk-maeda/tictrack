import { ValidationError } from "./errors.js";

export function validateDisplayName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(
      "displayName is required and must be a non-empty string",
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > 50) {
    throw new ValidationError(
      "displayName must be 50 characters or fewer",
    );
  }
  return trimmed;
}

export function validateBirthYearMonth(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError(
      "birthYearMonth must be in YYYY-MM format",
    );
  }
  const year = parseInt(value.substring(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    throw new ValidationError(
      "birthYearMonth year is out of valid range",
    );
  }
  return value;
}

export function parseJsonBody(body: string | null): Record<string, unknown> {
  if (!body) {
    throw new ValidationError("Request body is required");
  }
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new ValidationError("Request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError("Invalid JSON in request body");
  }
}
