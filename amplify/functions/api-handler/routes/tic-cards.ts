import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import type { RouteResult, TicCard } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok, created, noContent } from "../lib/response.js";
import {
  parseJsonBody,
  validateDisplayName,
  validateTicType,
  validateSeverity,
} from "../lib/validation.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

async function verifyChildOwnership(
  childId: string,
  userId: string,
): Promise<void> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.CHILDREN,
      Key: { childId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError("Child not found");
  }

  if (result.Item.userId !== userId) {
    throw new ForbiddenError("Access denied");
  }
}

export async function listTicCards(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await verifyChildOwnership(childId, userId);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.TIC_CARDS,
      IndexName: "childId-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
    }),
  );

  return ok(result.Items || []);
}

export async function createTicCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);

  const label = validateDisplayName(body.label);
  const type = validateTicType(body.type);
  const severity = validateSeverity(body.severity);
  const description = typeof body.description === "string" ? body.description : undefined;

  const now = new Date().toISOString();
  const card: TicCard = {
    cardId: ulid(),
    childId,
    label,
    type,
    description,
    severity,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.TIC_CARDS,
      Item: card,
    }),
  );

  return created(card);
}

async function getTicCard(cardId: string, childId: string): Promise<TicCard> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.TIC_CARDS,
      Key: { cardId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError("Tic card not found");
  }

  if (result.Item.childId !== childId) {
    throw new ForbiddenError("Access denied");
  }

  return result.Item as TicCard;
}

export async function updateTicCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const cardId = params.cardId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);
  await getTicCard(cardId, childId);

  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (body.label !== undefined) {
    const label = validateDisplayName(body.label);
    updates.push("#label = :label");
    names["#label"] = "label";
    values[":label"] = label;
  }

  if (body.type !== undefined) {
    const type = validateTicType(body.type);
    updates.push("#type = :type");
    names["#type"] = "type";
    values[":type"] = type;
  }

  if (body.description !== undefined) {
    updates.push("#description = :description");
    names["#description"] = "description";
    values[":description"] = body.description || undefined;
  }

  if (body.severity !== undefined) {
    const severity = validateSeverity(body.severity);
    updates.push("#severity = :severity");
    names["#severity"] = "severity";
    values[":severity"] = severity;
  }

  if (body.isActive !== undefined && typeof body.isActive === "boolean") {
    updates.push("#isActive = :isActive");
    names["#isActive"] = "isActive";
    values[":isActive"] = body.isActive;
  }

  const now = new Date().toISOString();
  updates.push("#updatedAt = :updatedAt");
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = now;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.TIC_CARDS,
      Key: { cardId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );

  return ok(result.Attributes);
}

export async function deleteTicCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const cardId = params.cardId;

  await verifyChildOwnership(childId, userId);
  await getTicCard(cardId, childId);

  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.TIC_CARDS,
      Key: { cardId },
    }),
  );

  return noContent();
}
