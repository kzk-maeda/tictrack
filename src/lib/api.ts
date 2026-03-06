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
