/**
 * Dashboard API Routes
 *
 * Provides real-time aggregation data for analysis dashboard
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import { GetCommand, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import type { RouteResult } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { GSI } from "../lib/schema.js";
import { ok } from "../lib/response.js";
import { BadRequestError } from "../lib/errors.js";
import { aggregateData } from "../lib/aggregation.js";
import { verifyChildOwnership } from "../lib/authorization.js";

/**
 * GET /children/{childId}/dashboard
 *
 * Query parameters:
 * - start: Start date (ISO 8601 format, default: 7 days ago)
 * - end: End date (ISO 8601 format, default: today)
 */
export async function getDashboard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  // Parse and validate date range FIRST (before auth checks)
  const { startDate, endDate } = parseDateRange(event.queryStringParameters);

  const userId = getUserId(event);
  const { childId } = params;

  // Verify child ownership
  await verifyChildOwnership(childId, userId);

  // Fetch episodes for the date range
  const episodes = await fetchEpisodes(childId, startDate, endDate);

  // Fetch tic cards for symptom name mapping
  const ticCards = await fetchTicCards(childId, episodes);

  // Aggregate data
  const aggregation = aggregateData(episodes, ticCards, startDate, endDate);

  return ok(aggregation);
}

/**
 * Parse and validate date range from query parameters
 */
function parseDateRange(
  queryParams: Record<string, string | undefined> | null
): { startDate: Date; endDate: Date } {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  // Default: last 7 days
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 6); // 7 days including today
  defaultStart.setHours(0, 0, 0, 0); // Start of day

  let startDate = defaultStart;
  let endDate = now;

  if (queryParams?.start) {
    startDate = parseDate(queryParams.start);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestError("Invalid date format for 'start'");
    }
    startDate.setHours(0, 0, 0, 0); // Start of day
  }

  if (queryParams?.end) {
    endDate = parseDate(queryParams.end);
    if (isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid date format for 'end'");
    }
    endDate.setHours(23, 59, 59, 999); // End of day
  }

  // Validate date range
  if (endDate < startDate) {
    throw new BadRequestError("End date must be after start date");
  }

  return { startDate, endDate };
}

/**
 * Parse ISO 8601 date string
 */
function parseDate(dateStr: string): Date {
  // Support YYYY-MM-DD and full ISO 8601
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00Z");
  }
  return new Date(dateStr);
}

/**
 * Fetch episodes for the specified date range
 */
async function fetchEpisodes(
  childId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.EPISODES,
      IndexName: GSI.Episodes.byChildOccurredAt.name,
      KeyConditionExpression: "childId = :childId AND occurredAt BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":childId": childId,
        ":start": startISO,
        ":end": endISO,
      },
    })
  );

  return result.Items || [];
}

/**
 * Fetch tic cards for symptom name mapping
 */
async function fetchTicCards(
  childId: string,
  episodes: any[]
): Promise<Map<string, any>> {
  // Extract unique tic card IDs
  const ticCardIds = new Set<string>();
  for (const episode of episodes) {
    if (episode.ticCardId) {
      ticCardIds.add(episode.ticCardId);
    }
  }

  if (ticCardIds.size === 0) {
    return new Map();
  }

  // Batch get tic cards
  const keys = Array.from(ticCardIds).map((cardId) => ({
    cardId,
  }));

  const result = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TableNames.TIC_CARDS]: {
          Keys: keys,
        },
      },
    })
  );

  const ticCardsArray = result.Responses?.[TableNames.TIC_CARDS] || [];

  // Convert to Map for fast lookup
  const ticCardsMap = new Map();
  for (const card of ticCardsArray) {
    ticCardsMap.set(card.cardId, card);
  }

  return ticCardsMap;
}
