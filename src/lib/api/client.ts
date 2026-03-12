import { fetchAuthSession } from "aws-amplify/auth";
import type { ProblemDetails } from "../types";

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

export async function client<T>(
  apiEndpoint: string,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method || "GET";

  // Get auth token
  const token = await getAuthToken();

  // Construct URL (NO /demo prefix for authenticated client)
  const url = `${apiEndpoint}${path}`;

  // Prepare headers with Authorization
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: token,
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
