import type { APIGatewayProxyEvent } from "aws-lambda";

export interface RouteResult {
  statusCode: number;
  body: unknown;
}

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
) => Promise<RouteResult>;

export interface RouteDefinition {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

export interface Child {
  childId: string;
  userId: string;
  displayName: string;
  birthYearMonth: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
