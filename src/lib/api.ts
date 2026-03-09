"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import outputs from "../../amplify_outputs.json";
import type { ProblemDetails } from "./types";

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

export async function apiClient<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_ENDPOINT}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
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
  rawOutput: unknown;
  suggestedType: "motor" | "vocal" | "both";
  suggestedSeverity: number;
  suggestedContext?: string;
  confidence?: number;
  observations?: Array<{
    timestamp?: string;
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
