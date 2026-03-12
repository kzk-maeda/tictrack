"use client";

import outputs from "../../../amplify_outputs.json";
import { client } from "./client";
import { demoClient } from "./demo-client";

const API_ENDPOINT = outputs.custom.API.endpoint.replace(/\/$/, "");

/**
 * Check if demo mode is active
 */
function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isDemoMode") === "true";
}

/**
 * Universal API client that switches between authenticated and demo mode
 */
export async function apiClient<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const isDemo = isDemoMode();

  if (isDemo) {
    return demoClient<T>(API_ENDPOINT, path, options);
  } else {
    return client<T>(API_ENDPOINT, path, options);
  }
}

// Re-export ApiError for convenience
export { ApiError } from "./client";
