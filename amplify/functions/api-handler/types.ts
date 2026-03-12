/**
 * Backend Type Definitions
 *
 * This file re-exports shared domain types and defines backend-specific types.
 * Shared types are maintained in /shared/types.ts (single source of truth).
 */

import type { APIGatewayProxyEvent } from "aws-lambda";

// Re-export all shared domain types
export type {
  Child,
  User,
  TicCard,
  TicSymptom,
  EpisodeAILabel,
  Episode,
  MedicationType,
  MedicationCard,
  MedicationLog,
  LifeEventType,
  LifeEvent,
} from "../../../shared/types";

// ========================================
// Backend-Specific Types
// ========================================

/**
 * Route handler return type
 */
export interface RouteResult {
  statusCode: number;
  body: unknown;
}

/**
 * Route handler function signature
 */
export type RouteHandler = (
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
) => Promise<RouteResult>;

/**
 * Route definition for pattern-based routing
 */
export interface RouteDefinition {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}
