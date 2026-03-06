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

export function validateTicType(value: unknown): "motor" | "vocal" {
  if (typeof value !== "string") {
    throw new ValidationError("type must be a string");
  }
  if (value !== "motor" && value !== "vocal") {
    throw new ValidationError("type must be 'motor' or 'vocal'");
  }
  return value;
}

export function validateSeverity(value: unknown): number {
  if (typeof value !== "number") {
    throw new ValidationError("severity must be a number");
  }
  if (!Number.isInteger(value)) {
    throw new ValidationError("severity must be an integer");
  }
  if (value < 1 || value > 3) {
    throw new ValidationError("severity must be 1, 2, or 3");
  }
  return value;
}

export function validateISODateTime(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("datetime must be a string");
  }
  // ISO 8601 format check (basic validation)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    throw new ValidationError("datetime must be in ISO 8601 format (e.g., 2026-03-06T14:30:00Z)");
  }
  // Additional check: parseable as Date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError("datetime is not a valid date");
  }
  return value;
}
