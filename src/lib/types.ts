export interface Child {
  childId: string;
  userId: string;
  displayName: string;
  birthYearMonth: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
}

export interface TicCard {
  cardId: string;
  childId: string;

  // Legacy field (deprecated, kept for backward compatibility)
  label?: string;

  // New 2-axis classification
  type: "motor" | "vocal";
  complexity: "simple" | "complex";

  // Specific symptom (either from master data or custom)
  symptomId?: string;        // e.g., "motor_simple_eye_blinking"
  customSymptom?: string;    // Custom symptom name if symptomId is null

  // Metadata
  description?: string;
  severity: number;          // 1-5 scale
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  episodeId: string;
  childId: string;
  recordType: "video" | "quick_log";
  ticCardId?: string;
  occurredAt: string;
  context?: string;
  notes?: string;
  labelStatus: "pending" | "analyzing" | "ai_suggested" | "confirmed" | "edited" | "failed";
  executionArn?: string;     // Step Functions execution ARN (for async AI analysis)

  // Confirmed tic label (after user approval/editing)
  confirmedTic?: TicSymptom;

  videoS3Key?: string;
  videoMimeType?: string;
  videoFileSize?: number;
  videoDuration?: number;
  uploadStatus?: "pending" | "completed" | "failed";
  originalAILabel?: EpisodeAILabel; // Structured AI label data (stored by store_label tool)
  feedbackType?: "useful" | "not_useful" | "incorrect" | "needs_edit";
  feedbackDetails?: string;
  createdAt: string;
  updatedAt: string;
}

// AI label data structure stored in Episodes.originalAILabel
export interface EpisodeAILabel {
  primaryTic?: TicSymptom;
  secondaryTics?: TicSymptom[];
  severity?: number; // 1-5
  observations?: Array<{
    timestamp?: number;
    description: string;
    intensity?: "low" | "medium" | "high";
  }>;
  // Legacy fields for backward compatibility
  type?: "motor" | "vocal" | "both";
  context?: string;
  suggestedType?: "motor" | "vocal" | "both";
  suggestedSeverity?: number;
  suggestedContext?: string;
  confidence?: number;
}

// Tic symptom master data
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

// Tic symptom (used in TicCard and AILabel)
export interface TicSymptom {
  type: "motor" | "vocal";
  complexity: "simple" | "complex";
  symptomId?: string;        // e.g., "motor_simple_eye_blinking"
  customSymptom?: string;    // Custom symptom description
  confidence: number;        // 0.0-1.0
}

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
