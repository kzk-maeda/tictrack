"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import outputs from "../../amplify_outputs.json";
import type { ProblemDetails, LifeEvent } from "./types";

const API_ENDPOINT = outputs.custom.API.endpoint.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly details: ProblemDetails,
  ) {
    super(details.detail);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("Not authenticated");
  return token;
}

/**
 * Check if demo mode is active
 */
function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isDemoMode") === "true";
}

export async function apiClient<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";
  const isDemo = isDemoMode();

  // Block mutations in demo mode
  if (isDemo && method !== "GET") {
    throw new ApiError(403, {
      type: "demo-mode-mutation",
      title: "Demo Mode",
      status: 403,
      detail: "Mutations are not allowed in demo mode",
    });
  }

  // Construct URL: add /demo prefix if in demo mode
  const basePath = isDemo ? "/demo" : "";
  const url = `${API_ENDPOINT}${basePath}${path}`;

  // Prepare headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add auth token only if NOT in demo mode
  if (!isDemo) {
    const token = await getAuthToken();
    headers.Authorization = token;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      type: "unknown",
      title: "Error",
      status: response.status,
      detail: response.statusText,
    }));
    throw new ApiError(response.status, error as ProblemDetails);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// AI Label API functions
export interface TriggerAIAnalysisRequest {
  childId: string;
  s3Key: string;
  bucketName?: string;
  videoMimeType?: string;
}

export interface TriggerAIAnalysisResponse {
  episodeId: string;
  status: "analyzing";
  executionArn: string;
}

export async function triggerAIAnalysis(
  episodeId: string,
  request: TriggerAIAnalysisRequest
): Promise<TriggerAIAnalysisResponse> {
  return apiClient<TriggerAIAnalysisResponse>(`/analyze/${episodeId}`, {
    method: "POST",
    body: request,
  });
}

export interface SubmitFeedbackRequest {
  feedbackType: "useful" | "not_useful" | "incorrect" | "needs_edit";
  feedbackDetails?: string;
}

export async function submitAILabelFeedback(
  childId: string,
  episodeId: string,
  feedback: SubmitFeedbackRequest
): Promise<void> {
  return apiClient<void>(
    `/children/${childId}/episodes/${episodeId}/feedback`,
    {
      method: "PUT",
      body: feedback,
    }
  );
}

export interface AILabelResponse {
  episodeId: string;
  version: number;
  modelId: string;
  rawOutput: string;
  suggestedType: "motor" | "vocal" | "both";
  suggestedSeverity: number;
  suggestedContext?: string;
  confidence?: number;
  observations?: Array<{
    timestamp?: number;
    description: string;
    intensity?: "low" | "medium" | "high";
  }>;
  createdAt: string;
}

export async function getAILabel(
  childId: string,
  episodeId: string
): Promise<AILabelResponse> {
  return apiClient<AILabelResponse>(
    `/children/${childId}/episodes/${episodeId}/ai-label`
  );
}

export interface AnalysisStatusResponse {
  episodeId: string;
  status: "pending" | "analyzing" | "ai_suggested" | "failed";
  executionArn?: string;
  updatedAt?: string;
  aiLabel?: AILabelResponse;
  error?: string;
}

export async function getAnalysisStatus(
  childId: string,
  episodeId: string
): Promise<AnalysisStatusResponse> {
  return apiClient<AnalysisStatusResponse>(
    `/children/${childId}/episodes/${episodeId}/analysis-status`
  );
}

// Medication API functions
export interface CreateMedicationCardRequest {
  medicationName: string;
  medicationType: "antipsychotic" | "alpha2_agonist" | "other";
  dosageMg: number;
  frequency?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateMedicationCardRequest {
  medicationName?: string;
  medicationType?: "antipsychotic" | "alpha2_agonist" | "other";
  dosageMg?: number;
  frequency?: string;
  notes?: string;
  isActive?: boolean;
}

export interface MedicationCardResponse {
  medicationId: string;
  childId: string;
  medicationName: string;
  medicationType: "antipsychotic" | "alpha2_agonist" | "other";
  dosageMg: number;
  frequency?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationLogRequest {
  takenAt?: string;  // Defaults to current time if not provided
  dosageMg?: number;  // Override card dosage if specified
  notes?: string;
}

export interface MedicationLogResponse {
  logId: string;
  childId: string;
  medicationId: string;
  takenAt: string;
  dosageMg?: number;
  notes?: string;
  createdAt: string;
}

export async function listMedicationCards(
  childId: string
): Promise<MedicationCardResponse[]> {
  return apiClient<MedicationCardResponse[]>(
    `/children/${childId}/medications`
  );
}

export async function createMedicationCard(
  childId: string,
  request: CreateMedicationCardRequest
): Promise<MedicationCardResponse> {
  return apiClient<MedicationCardResponse>(
    `/children/${childId}/medications`,
    {
      method: "POST",
      body: request,
    }
  );
}

export async function updateMedicationCard(
  childId: string,
  medicationId: string,
  request: UpdateMedicationCardRequest
): Promise<MedicationCardResponse> {
  return apiClient<MedicationCardResponse>(
    `/children/${childId}/medications/${medicationId}`,
    {
      method: "PATCH",
      body: request,
    }
  );
}

export async function deleteMedicationCard(
  childId: string,
  medicationId: string
): Promise<void> {
  return apiClient<void>(
    `/children/${childId}/medications/${medicationId}`,
    {
      method: "DELETE",
    }
  );
}

export async function createMedicationLog(
  childId: string,
  medicationId: string,
  request: CreateMedicationLogRequest
): Promise<MedicationLogResponse> {
  return apiClient<MedicationLogResponse>(
    `/children/${childId}/medications/${medicationId}/logs`,
    {
      method: "POST",
      body: request,
    }
  );
}

export async function listMedicationLogs(
  childId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    medicationId?: string;
  }
): Promise<MedicationLogResponse[]> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.set("startDate", params.startDate);
  if (params?.endDate) queryParams.set("endDate", params.endDate);
  if (params?.medicationId) queryParams.set("medicationId", params.medicationId);

  const query = queryParams.toString();
  return apiClient<MedicationLogResponse[]>(
    `/children/${childId}/medication-logs${query ? `?${query}` : ""}`
  );
}

export async function deleteMedicationLog(
  childId: string,
  logId: string
): Promise<void> {
  return apiClient<void>(`/children/${childId}/medication-logs/${logId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Life Events API
// ============================================================================

export async function listLifeEvents(childId: string): Promise<LifeEvent[]> {
  return apiClient<LifeEvent[]>(`/children/${childId}/life-events`);
}

export async function createLifeEvent(
  childId: string,
  request: Omit<LifeEvent, "eventId" | "childId" | "createdAt" | "updatedAt">
): Promise<LifeEvent> {
  return apiClient<LifeEvent>(`/children/${childId}/life-events`, {
    method: "POST",
    body: request,
  });
}

export async function updateLifeEvent(
  eventId: string,
  request: Partial<Omit<LifeEvent, "eventId" | "childId" | "createdAt" | "updatedAt">>
): Promise<LifeEvent> {
  return apiClient<LifeEvent>(`/life-events/${eventId}`, {
    method: "PUT",
    body: request,
  });
}

export async function deleteLifeEvent(eventId: string): Promise<void> {
  return apiClient<void>(`/life-events/${eventId}`, {
    method: "DELETE",
  });
}
