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
