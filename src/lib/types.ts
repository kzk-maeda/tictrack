export interface Child {
  childId: string;
  userId: string;
  displayName: string;
  birthYearMonth: string;
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
  createdAt: string;
  updatedAt: string;
}
