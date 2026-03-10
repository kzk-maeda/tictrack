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
  if (value < 1 || value > 5) {
    throw new ValidationError("severity must be between 1 and 5");
  }
  return value;
}

export function validateComplexity(value: unknown): "simple" | "complex" {
  if (typeof value !== "string") {
    throw new ValidationError("complexity must be a string");
  }
  if (value !== "simple" && value !== "complex") {
    throw new ValidationError("complexity must be 'simple' or 'complex'");
  }
  return value;
}

export function validateSymptomId(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("symptomId must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 100) {
    throw new ValidationError("symptomId must be 100 characters or fewer");
  }
  return trimmed;
}

export function validateCustomSymptom(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("customSymptom must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 100) {
    throw new ValidationError("customSymptom must be 100 characters or fewer");
  }
  return trimmed;
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

export function validateMedicationType(value: unknown): "antipsychotic" | "alpha2_agonist" | "other" {
  if (typeof value !== "string") {
    throw new ValidationError("medicationType must be a string");
  }
  if (value !== "antipsychotic" && value !== "alpha2_agonist" && value !== "other") {
    throw new ValidationError("medicationType must be 'antipsychotic', 'alpha2_agonist', or 'other'");
  }
  return value;
}

export function validateDosage(value: unknown): number {
  if (typeof value !== "number") {
    throw new ValidationError("dosage must be a number");
  }
  if (value <= 0) {
    throw new ValidationError("dosage must be greater than 0");
  }
  return value;
}

export function validateFrequency(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ValidationError("frequency must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > 100) {
    throw new ValidationError("frequency must be 100 characters or fewer");
  }
  return trimmed;
}
