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
  label: string;
  type: "motor" | "vocal";
  description?: string;
  severity: number;
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
  labelStatus: "pending" | "ai_suggested" | "confirmed" | "edited";
  videoS3Key?: string;
  videoMimeType?: string;
  videoFileSize?: number;
  videoDuration?: number;
  uploadStatus?: "pending" | "completed" | "failed";
  originalAILabel?: string; // JSON string of original AI label (for edited episodes)
  feedbackType?: "useful" | "not_useful" | "incorrect" | "needs_edit";
  feedbackDetails?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AILabel {
  episodeId: string;
  version: number;
  modelId: string;
  rawOutput: string; // JSON string
  suggestedType: "motor" | "vocal" | "both";
  suggestedSeverity: number; // 1-3
  suggestedContext?: string;
  confidence?: number; // 0.0-1.0
  observations?: Array<{
    timestamp?: string;
    description: string;
    intensity?: "low" | "medium" | "high";
  }>;
  createdAt: string;
}
