import type { APIGatewayProxyEvent } from "aws-lambda";

export interface RouteResult {
  statusCode: number;
  body: unknown;
}

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
) => Promise<RouteResult>;

export interface RouteDefinition {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

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

// Tic symptom structure (2-axis classification)
export interface TicSymptom {
  type: "motor" | "vocal";
  complexity: "simple" | "complex";
  symptomId?: string;        // e.g., "motor_simple_eye_blinking"
  customSymptom?: string;    // Used when symptomId is not specified
  confidence?: number;       // 0.0-1.0
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
