"use client";

import { apiClient } from "./index";

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
  takenAt?: string; // Defaults to current time if not provided
  dosageMg?: number; // Override card dosage if specified
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
  if (params?.medicationId)
    queryParams.set("medicationId", params.medicationId);

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
