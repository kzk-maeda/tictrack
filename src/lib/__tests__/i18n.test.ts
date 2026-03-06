import { describe, it, expect } from "vitest";
import jaMessages from "../../../messages/ja.json";
import enMessages from "../../../messages/en.json";

function getAllKeys(obj: any, prefix = ""): string[] {
  return Object.keys(obj).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof obj[key] === "object" && obj[key] !== null
      ? getAllKeys(obj[key], path)
      : [path];
  });
}

function findEmptyValues(obj: any, prefix = ""): string[] {
  return Object.keys(obj).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      return findEmptyValues(obj[key], path);
    }
    return obj[key] === "" ? [path] : [];
  });
}

describe("i18n translation files", () => {
  it("should have matching keys in ja and en", () => {
    const jaKeys = getAllKeys(jaMessages);
    const enKeys = getAllKeys(enMessages);

    expect(jaKeys.sort()).toEqual(enKeys.sort());
  });

  it("should not have empty values in ja", () => {
    const emptyValues = findEmptyValues(jaMessages);
    expect(emptyValues).toEqual([]);
  });

  it("should not have empty values in en", () => {
    const emptyValues = findEmptyValues(enMessages);
    expect(emptyValues).toEqual([]);
  });

  it("should have all required top-level keys", () => {
    const requiredKeys = [
      "common",
      "auth",
      "nav",
      "children",
      "ticCards",
      "timeline",
      "settings",
      "offline",
      "manifest",
    ];

    const jaKeys = Object.keys(jaMessages);
    const enKeys = Object.keys(enMessages);

    requiredKeys.forEach((key) => {
      expect(jaKeys).toContain(key);
      expect(enKeys).toContain(key);
    });
  });
});
