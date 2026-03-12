/**
 * Frontend Type Definitions
 *
 * This file re-exports shared domain types and defines frontend-specific types.
 * Shared types are maintained in /shared/types.ts (single source of truth).
 */

// Re-export all shared domain types
export type {
  Child,
  User,
  TicCard,
  TicSymptom,
  EpisodeAILabel,
  Episode,
  MedicationType,
  MedicationCard,
  MedicationLog,
  LifeEventType,
  LifeEvent,
} from "../../shared/types";

// Import types needed for local type definitions
import type { TicSymptom } from "../../shared/types";

// ========================================
// Frontend-Specific Types
// ========================================

/**
 * RFC 7807 Problem Details for HTTP APIs
 * Used for error responses from the API
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
}

/**
 * Tic symptom master data definition
 * Used for symptom selection UI
 */
export interface TicSymptomDefinition {
  symptomId: string;           // e.g., "motor_simple_eye_blinking"
  type: "motor" | "vocal";
  complexity: "simple" | "complex";
  category: string;            // e.g., "eye", "facial", "head", "throat", etc.
  nameJa: string;              // Japanese name
  nameEn: string;              // English name
  descriptionJa?: string;      // Japanese description
  descriptionEn?: string;      // English description
  displayOrder: number;        // Display order in UI
  isCommon: boolean;           // Frequently occurring symptom flag
}

/**
 * AI Label (AILabels table)
 * Full AI label record including version history
 */
export interface AILabel {
  episodeId: string;
  version: number;
  modelId: string;
  rawOutput: string; // JSON string

  // Primary tic (most prominent) - OPTIONAL until backend Phase 3 is complete
  primaryTic?: TicSymptom;

  // Secondary tics (if multiple detected)
  secondaryTics?: TicSymptom[];

  // Overall severity assessment - OPTIONAL until backend Phase 3 is complete
  severity?: number; // 1-5

  // Detailed observations
  observations?: Array<{
    timestamp?: number;        // Seconds in video
    description: string;
    intensity?: "low" | "medium" | "high";
  }>;

  // Legacy fields (deprecated, kept for backward compatibility)
  suggestedType?: "motor" | "vocal" | "both";
  suggestedSeverity?: number;
  suggestedContext?: string;
  confidence?: number;

  createdAt: string;
}

/**
 * Dashboard aggregation data
 * Computed by backend aggregation logic
 */
export interface DashboardData {
  basicStats: {
    totalEpisodes: number;
    recordedDays: number;
    missingDays: number;
    avgPerRecordedDay: number;
    dataCompleteness: string;
  };
  typeDistribution: {
    motor: number;
    vocal: number;
    both: number;
  };
  severityDistribution: {
    "1": number;
    "2": number;
    "3": number;
    average: number;
  };
  timePattern: {
    "06-12": number;
    "12-18": number;
    "18-22": number;
    "22-06": number;
    peakTime?: string;
  };
  mostFrequentTics: Array<{
    symptom: string;
    count: number;
  }>;
}
