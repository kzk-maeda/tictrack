"use client";

import { ApiError } from "./types";
import type { ProblemDetails } from "../types";

export async function demoClient<T>(
  apiEndpoint: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";

  // Block mutations in demo mode
  if (method !== "GET") {
    throw new ApiError(403, {
      type: "demo-mode-mutation",
      title: "Demo Mode",
      status: 403,
      detail: "Mutations are not allowed in demo mode",
    });
  }

  // Add /demo prefix to path
  const url = `${apiEndpoint}/demo${path}`;

  // Prepare headers (NO Authorization in demo mode)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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
