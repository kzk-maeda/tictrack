import { apiClient } from "./index";

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
