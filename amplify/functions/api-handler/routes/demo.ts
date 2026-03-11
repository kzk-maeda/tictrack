/**
 * Demo Mode Routes
 *
 * Read-only routes that use a fixed demo userId instead of authentication.
 * These routes wrap existing route handlers and inject the demo userId.
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import type { RouteResult } from "../types.js";
import { listChildren } from "./children.js";
import { listEpisodes, getEpisodeAILabel, getAnalysisStatus } from "./episodes.js";
import { getDashboard } from "./dashboard.js";
import { listTicCards } from "./tic-cards.js";
import { listMedicationCards, listMedicationLogs } from "./medications.js";
import { listLifeEvents } from "./life-events.js";
import { handleVideoPlaybackUrl } from "./videos.js";
import { ForbiddenError } from "../lib/errors.js";

/**
 * Get demo user ID from environment
 */
export function getDemoUserId(): string {
  const demoUserId = process.env.DEMO_USER_ID;
  if (!demoUserId) {
    throw new Error("DEMO_USER_ID environment variable is not set");
  }
  return demoUserId;
}

/**
 * Create a mock authenticated event with demo userId
 */
function createDemoEvent(event: APIGatewayProxyEvent): APIGatewayProxyEvent {
  const demoUserId = getDemoUserId();

  return {
    ...event,
    requestContext: {
      ...event.requestContext,
      authorizer: {
        claims: {
          sub: demoUserId,
          email: "demo@example.com",
        },
      },
    },
  };
}

/**
 * Reject mutation operations (POST, PUT, DELETE)
 */
export async function rejectMutation(): Promise<RouteResult> {
  throw new ForbiddenError("Mutations are not allowed in demo mode");
}

/**
 * Demo wrapper for listChildren
 */
export function demoListChildren(event: APIGatewayProxyEvent): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listChildren(demoEvent);
}

/**
 * Demo wrapper for listEpisodes
 */
export function demoListEpisodes(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listEpisodes(demoEvent, params);
}

/**
 * Demo wrapper for getDashboard
 */
export function demoGetDashboard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return getDashboard(demoEvent, params);
}

/**
 * Demo wrapper for listTicCards
 */
export function demoListTicCards(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listTicCards(demoEvent, params);
}

/**
 * Demo wrapper for listMedicationCards
 */
export function demoListMedicationCards(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listMedicationCards(demoEvent, params);
}

/**
 * Demo wrapper for listMedicationLogs
 */
export function demoListMedicationLogs(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listMedicationLogs(demoEvent, params);
}

/**
 * Demo wrapper for listLifeEvents
 */
export function demoListLifeEvents(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return listLifeEvents(demoEvent, params);
}

/**
 * Demo wrapper for getEpisodeAILabel
 */
export function demoGetEpisodeAILabel(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return getEpisodeAILabel(demoEvent, params);
}

/**
 * Demo wrapper for getAnalysisStatus
 */
export function demoGetAnalysisStatus(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return getAnalysisStatus(demoEvent, params);
}

/**
 * Demo wrapper for handleVideoPlaybackUrl
 */
export function demoHandleVideoPlaybackUrl(
  event: APIGatewayProxyEvent
): Promise<RouteResult> {
  const demoEvent = createDemoEvent(event);
  return handleVideoPlaybackUrl(demoEvent);
}
