// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateDisplayName,
  validateBirthYearMonth,
  parseJsonBody,
  validateTicType,
  validateSeverity,
  validateISODateTime,
} from "../lib/validation.js";
import { ValidationError } from "../lib/errors.js";

describe("validateDisplayName", () => {
  it("returns trimmed name for valid input", () => {
    expect(validateDisplayName("タロウ")).toBe("タロウ");
  });

  it("trims whitespace from valid input", () => {
    expect(validateDisplayName("  タロウ  ")).toBe("タロウ");
  });

  it("throws ValidationError for empty string", () => {
    expect(() => validateDisplayName("")).toThrow(ValidationError);
    expect(() => validateDisplayName("")).toThrow(
      "displayName is required and must be a non-empty string",
    );
  });

  it("throws ValidationError for whitespace-only string", () => {
    expect(() => validateDisplayName("   ")).toThrow(ValidationError);
  });

  it("throws ValidationError for non-string value", () => {
    expect(() => validateDisplayName(null)).toThrow(ValidationError);
    expect(() => validateDisplayName(undefined)).toThrow(ValidationError);
    expect(() => validateDisplayName(123)).toThrow(ValidationError);
  });

  it("throws ValidationError for string exceeding 50 characters", () => {
    const longName = "あ".repeat(51);
    expect(() => validateDisplayName(longName)).toThrow(ValidationError);
    expect(() => validateDisplayName(longName)).toThrow("50 characters");
  });

  it("accepts exactly 50 character string", () => {
    const exactName = "あ".repeat(50);
    expect(validateDisplayName(exactName)).toBe(exactName);
  });
});

describe("validateBirthYearMonth", () => {
  it("returns valid YYYY-MM format string", () => {
    expect(validateBirthYearMonth("2020-05")).toBe("2020-05");
  });

  it("accepts January (01) and December (12)", () => {
    expect(validateBirthYearMonth("2020-01")).toBe("2020-01");
    expect(validateBirthYearMonth("2020-12")).toBe("2020-12");
  });

  it("throws ValidationError for invalid month 00", () => {
    expect(() => validateBirthYearMonth("2020-00")).toThrow(ValidationError);
  });

  it("throws ValidationError for invalid month 13", () => {
    expect(() => validateBirthYearMonth("2020-13")).toThrow(ValidationError);
  });

  it("throws ValidationError for missing month padding", () => {
    expect(() => validateBirthYearMonth("2020-5")).toThrow(ValidationError);
  });

  it("throws ValidationError for non-string value", () => {
    expect(() => validateBirthYearMonth(null)).toThrow(ValidationError);
    expect(() => validateBirthYearMonth(202005)).toThrow(ValidationError);
  });

  it("throws ValidationError for completely invalid format", () => {
    expect(() => validateBirthYearMonth("invalid")).toThrow(ValidationError);
    expect(() => validateBirthYearMonth("2020/05")).toThrow(ValidationError);
    expect(() => validateBirthYearMonth("20-05")).toThrow(ValidationError);
  });

  it("throws ValidationError for year before 1900", () => {
    expect(() => validateBirthYearMonth("1899-01")).toThrow(ValidationError);
    expect(() => validateBirthYearMonth("1899-01")).toThrow("out of valid range");
  });

  it("throws ValidationError for future year", () => {
    const futureYear = new Date().getFullYear() + 1;
    expect(() => validateBirthYearMonth(`${futureYear}-01`)).toThrow(
      ValidationError,
    );
  });

  it("accepts the current year", () => {
    const currentYear = new Date().getFullYear();
    expect(validateBirthYearMonth(`${currentYear}-01`)).toBe(
      `${currentYear}-01`,
    );
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON object", () => {
    const result = parseJsonBody('{"name":"test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("throws ValidationError for null body", () => {
    expect(() => parseJsonBody(null)).toThrow(ValidationError);
    expect(() => parseJsonBody(null)).toThrow("Request body is required");
  });

  it("throws ValidationError for invalid JSON", () => {
    expect(() => parseJsonBody("not json")).toThrow(ValidationError);
    expect(() => parseJsonBody("not json")).toThrow("Invalid JSON");
  });

  it("throws ValidationError for JSON array", () => {
    expect(() => parseJsonBody("[1,2,3]")).toThrow(ValidationError);
    expect(() => parseJsonBody("[1,2,3]")).toThrow("must be a JSON object");
  });

  it("throws ValidationError for JSON primitive", () => {
    expect(() => parseJsonBody('"string"')).toThrow(ValidationError);
    expect(() => parseJsonBody("42")).toThrow(ValidationError);
  });
});

describe("validateTicType", () => {
  it("returns valid type 'motor'", () => {
    expect(validateTicType("motor")).toBe("motor");
  });

  it("returns valid type 'vocal'", () => {
    expect(validateTicType("vocal")).toBe("vocal");
  });

  it("throws ValidationError for invalid type", () => {
    expect(() => validateTicType("invalid")).toThrow(ValidationError);
    expect(() => validateTicType("invalid")).toThrow("must be 'motor' or 'vocal'");
  });

  it("throws ValidationError for non-string value", () => {
    expect(() => validateTicType(null)).toThrow(ValidationError);
    expect(() => validateTicType(123)).toThrow(ValidationError);
  });
});

describe("validateSeverity", () => {
  it("returns valid severity 1", () => {
    expect(validateSeverity(1)).toBe(1);
  });

  it("returns valid severity 2", () => {
    expect(validateSeverity(2)).toBe(2);
  });

  it("returns valid severity 3", () => {
    expect(validateSeverity(3)).toBe(3);
  });

  it("returns valid severity 4", () => {
    expect(validateSeverity(4)).toBe(4);
  });

  it("returns valid severity 5", () => {
    expect(validateSeverity(5)).toBe(5);
  });

  it("throws ValidationError for severity 0", () => {
    expect(() => validateSeverity(0)).toThrow(ValidationError);
    expect(() => validateSeverity(0)).toThrow("must be between 1 and 5");
  });

  it("throws ValidationError for severity 6", () => {
    expect(() => validateSeverity(6)).toThrow(ValidationError);
    expect(() => validateSeverity(6)).toThrow("must be between 1 and 5");
  });

  it("throws ValidationError for non-number value", () => {
    expect(() => validateSeverity("2")).toThrow(ValidationError);
    expect(() => validateSeverity(null)).toThrow(ValidationError);
  });

  it("throws ValidationError for non-integer value", () => {
    expect(() => validateSeverity(2.5)).toThrow(ValidationError);
  });
});

describe("validateISODateTime", () => {
  it("returns valid ISO 8601 datetime", () => {
    expect(validateISODateTime("2026-03-06T14:30:00Z")).toBe("2026-03-06T14:30:00Z");
  });

  it("returns valid ISO 8601 datetime with milliseconds", () => {
    expect(validateISODateTime("2026-03-06T14:30:00.123Z")).toBe("2026-03-06T14:30:00.123Z");
  });

  it("throws ValidationError for invalid format", () => {
    expect(() => validateISODateTime("2026-03-06")).toThrow(ValidationError);
    expect(() => validateISODateTime("2026/03/06 14:30")).toThrow(ValidationError);
  });

  it("throws ValidationError for non-string value", () => {
    expect(() => validateISODateTime(null)).toThrow(ValidationError);
    expect(() => validateISODateTime(new Date())).toThrow(ValidationError);
  });
});
