import { apiClient } from "./index";
import type { LifeEvent } from "../types";

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
  request: Partial<
    Omit<LifeEvent, "eventId" | "childId" | "createdAt" | "updatedAt">
  >
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
