import type { RouteResult } from "../types.js";

export function ok(body: unknown): RouteResult {
  return { statusCode: 200, body };
}

export function created(body: unknown): RouteResult {
  return { statusCode: 201, body };
}

export function noContent(): RouteResult {
  return { statusCode: 204, body: null };
}

export function problemDetails(
  statusCode: number,
  title: string,
  detail?: string,
): RouteResult {
  return {
    statusCode,
    body: {
      type: `https://tictrack.app/errors/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status: statusCode,
      detail: detail || title,
    },
  };
}
