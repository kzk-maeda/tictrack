/**
 * Life Events API Routes
 *
 * Manage life events that may affect tic symptoms (e.g., graduation, relocation)
 */

import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  QueryCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RouteResult } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok, created } from "../lib/response.js";
import { ValidationError, ForbiddenError, NotFoundError } from "../lib/errors.js";
import { ulid } from "ulidx";

/**
 * GET /children/{childId}/life-events
 */
export async function listLifeEvents(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const userId = getUserId(event);
  const { childId } = params;

  // Verify child ownership
  await verifyChildOwnership(childId, userId);

  // Query life events
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.LIFE_EVENTS,
      IndexName: "childId-occurredAt-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: {
        ":childId": childId,
      },
      ScanIndexForward: false, // Sort by occurredAt descending (newest first)
    })
  );

  return ok(result.Items || []);
}

/**
 * POST /children/{childId}/life-events
 */
export async function createLifeEvent(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const userId = getUserId(event);
  const { childId } = params;
  const body = JSON.parse(event.body || "{}");

  // Verify child ownership
  await verifyChildOwnership(childId, userId);

  // Validate required fields
  if (!body.eventType || !body.title || !body.occurredAt) {
    throw new ValidationError("eventType, title, and occurredAt are required");
  }

  // Validate eventType
  const validEventTypes = [
    "graduation",
    "school_transfer",
    "relocation",
    "family_change",
    "medical",
    "social",
    "other",
  ];
  if (!validEventTypes.includes(body.eventType)) {
    throw new ValidationError(`Invalid eventType. Must be one of: ${validEventTypes.join(", ")}`);
  }

  // Validate stressLevel if provided
  if (body.stressLevel !== undefined) {
    const level = Number(body.stressLevel);
    if (isNaN(level) || level < 1 || level > 5) {
      throw new ValidationError("stressLevel must be between 1 and 5");
    }
  }

  const now = new Date().toISOString();
  const lifeEvent = {
    eventId: ulid(),
    childId,
    eventType: body.eventType,
    title: body.title,
    occurredAt: body.occurredAt,
    endDate: body.endDate || undefined,
    notes: body.notes || undefined,
    stressLevel: body.stressLevel ? Number(body.stressLevel) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.LIFE_EVENTS,
      Item: lifeEvent,
    })
  );

  return created(lifeEvent);
}

/**
 * PUT /life-events/{eventId}
 */
export async function updateLifeEvent(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const userId = getUserId(event);
  const { eventId } = params;
  const body = JSON.parse(event.body || "{}");

  // Get existing event
  const existing = await docClient.send(
    new GetCommand({
      TableName: TableNames.LIFE_EVENTS,
      Key: { eventId },
    })
  );

  if (!existing.Item) {
    throw new NotFoundError("Life event not found");
  }

  // Verify child ownership
  await verifyChildOwnership(existing.Item.childId, userId);

  // Build update expression
  const updates: string[] = [];
  const attributeNames: Record<string, string> = {};
  const attributeValues: Record<string, unknown> = {};

  if (body.eventType !== undefined) {
    const validEventTypes = [
      "graduation",
      "school_transfer",
      "relocation",
      "family_change",
      "medical",
      "social",
      "other",
    ];
    if (!validEventTypes.includes(body.eventType)) {
      throw new ValidationError(`Invalid eventType. Must be one of: ${validEventTypes.join(", ")}`);
    }
    updates.push("#eventType = :eventType");
    attributeNames["#eventType"] = "eventType";
    attributeValues[":eventType"] = body.eventType;
  }

  if (body.title !== undefined) {
    updates.push("#title = :title");
    attributeNames["#title"] = "title";
    attributeValues[":title"] = body.title;
  }

  if (body.occurredAt !== undefined) {
    updates.push("#occurredAt = :occurredAt");
    attributeNames["#occurredAt"] = "occurredAt";
    attributeValues[":occurredAt"] = body.occurredAt;
  }

  if (body.endDate !== undefined) {
    if (body.endDate === null) {
      updates.push("REMOVE endDate");
    } else {
      updates.push("#endDate = :endDate");
      attributeNames["#endDate"] = "endDate";
      attributeValues[":endDate"] = body.endDate;
    }
  }

  if (body.notes !== undefined) {
    if (body.notes === null || body.notes === "") {
      updates.push("REMOVE notes");
    } else {
      updates.push("#notes = :notes");
      attributeNames["#notes"] = "notes";
      attributeValues[":notes"] = body.notes;
    }
  }

  if (body.stressLevel !== undefined) {
    if (body.stressLevel === null) {
      updates.push("REMOVE stressLevel");
    } else {
      const level = Number(body.stressLevel);
      if (isNaN(level) || level < 1 || level > 5) {
        throw new ValidationError("stressLevel must be between 1 and 5");
      }
      updates.push("#stressLevel = :stressLevel");
      attributeNames["#stressLevel"] = "stressLevel";
      attributeValues[":stressLevel"] = level;
    }
  }

  if (updates.length === 0) {
    return ok(existing.Item);
  }

  // Always update updatedAt
  updates.push("#updatedAt = :updatedAt");
  attributeNames["#updatedAt"] = "updatedAt";
  attributeValues[":updatedAt"] = new Date().toISOString();

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.LIFE_EVENTS,
      Key: { eventId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return ok(result.Attributes);
}

/**
 * DELETE /life-events/{eventId}
 */
export async function deleteLifeEvent(
  event: APIGatewayProxyEvent,
  params: Record<string, string>
): Promise<RouteResult> {
  const userId = getUserId(event);
  const { eventId } = params;

  // Get existing event
  const existing = await docClient.send(
    new GetCommand({
      TableName: TableNames.LIFE_EVENTS,
      Key: { eventId },
    })
  );

  if (!existing.Item) {
    throw new NotFoundError("Life event not found");
  }

  // Verify child ownership
  await verifyChildOwnership(existing.Item.childId, userId);

  // Delete event
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.LIFE_EVENTS,
      Key: { eventId },
    })
  );

  return ok({ message: "Life event deleted successfully" });
}

/**
 * Verify that the child belongs to the authenticated user
 */
async function verifyChildOwnership(
  childId: string,
  userId: string
): Promise<void> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.CHILDREN,
      Key: { childId },
    })
  );

  if (!result.Item || result.Item.userId !== userId) {
    throw new ForbiddenError("Access denied to this child's data");
  }
}
