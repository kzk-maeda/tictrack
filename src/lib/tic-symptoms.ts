import symptomsData from "@/data/tic-symptoms.json";
import type { TicSymptomDefinition } from "./types";

export interface TicSymptomsData {
  version: string;
  lastUpdated: string;
  symptoms: TicSymptomDefinition[];
  categories: {
    motor: {
      simple: string[];
      complex: string[];
    };
    vocal: {
      simple: string[];
      complex: string[];
    };
  };
  metadata: {
    totalSymptoms: number;
    motorSimple: number;
    motorComplex: number;
    vocalSimple: number;
    vocalComplex: number;
    commonSymptoms: number;
  };
}

/**
 * Get all tic symptoms from master data
 */
export function getAllSymptoms(): TicSymptomDefinition[] {
  return (symptomsData as TicSymptomsData).symptoms;
}

/**
 * Get symptoms filtered by type and complexity
 */
export function getSymptomsByTypeAndComplexity(
  type: "motor" | "vocal",
  complexity: "simple" | "complex"
): TicSymptomDefinition[] {
  return getAllSymptoms().filter(
    (s) => s.type === type && s.complexity === complexity
  );
}

/**
 * Get common symptoms (frequently occurring)
 */
export function getCommonSymptoms(): TicSymptomDefinition[] {
  return getAllSymptoms().filter((s) => s.isCommon);
}

/**
 * Get symptom by ID
 */
export function getSymptomById(
  symptomId: string
): TicSymptomDefinition | undefined {
  return getAllSymptoms().find((s) => s.symptomId === symptomId);
}

/**
 * Get symptom display name (locale-aware)
 */
export function getSymptomName(
  symptomId: string,
  locale: "ja" | "en" = "ja"
): string {
  const symptom = getSymptomById(symptomId);
  if (!symptom) return symptomId;
  return locale === "ja" ? symptom.nameJa : symptom.nameEn;
}

/**
 * Get symptom description (locale-aware)
 */
export function getSymptomDescription(
  symptomId: string,
  locale: "ja" | "en" = "ja"
): string | undefined {
  const symptom = getSymptomById(symptomId);
  if (!symptom) return undefined;
  return locale === "ja" ? symptom.descriptionJa : symptom.descriptionEn;
}

/**
 * Group symptoms by complexity for display
 */
export function groupSymptomsByComplexity(
  type: "motor" | "vocal"
): {
  simple: TicSymptomDefinition[];
  complex: TicSymptomDefinition[];
} {
  const symptoms = getAllSymptoms().filter((s) => s.type === type);
  return {
    simple: symptoms.filter((s) => s.complexity === "simple").sort((a, b) => a.displayOrder - b.displayOrder),
    complex: symptoms.filter((s) => s.complexity === "complex").sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

/**
 * Search symptoms by name (fuzzy match)
 */
export function searchSymptoms(
  query: string,
  locale: "ja" | "en" = "ja"
): TicSymptomDefinition[] {
  const lowerQuery = query.toLowerCase();
  return getAllSymptoms().filter((s) => {
    const name = locale === "ja" ? s.nameJa : s.nameEn;
    const description = locale === "ja" ? s.descriptionJa : s.descriptionEn;
    return (
      name.toLowerCase().includes(lowerQuery) ||
      (description && description.toLowerCase().includes(lowerQuery))
    );
  });
}
