import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import type { RouteResult, Child } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok, created, noContent } from "../lib/response.js";
import {
  validateDisplayName,
  validateBirthYearMonth,
  parseJsonBody,
} from "../lib/validation.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

export async function listChildren(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const userId = getUserId(event);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.CHILDREN,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );

  return ok(result.Items || []);
}

export async function createChild(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const body = parseJsonBody(event.body);

  const displayName = validateDisplayName(body.displayName);
  const birthYearMonth = validateBirthYearMonth(body.birthYearMonth);

  const now = new Date().toISOString();
  const child: Child = {
    childId: ulid(),
    userId,
    displayName,
    birthYearMonth,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.CHILDREN,
      Item: child,
    }),
  );

  return created(child);
}

async function getOwnedChild(
  childId: string,
  userId: string,
): Promise<Child> {
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

  return result.Item as Child;
}

export async function updateChild(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const body = parseJsonBody(event.body);

  await getOwnedChild(childId, userId);

  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    const displayName = validateDisplayName(body.displayName);
    updates.push("#displayName = :displayName");
    names["#displayName"] = "displayName";
    values[":displayName"] = displayName;
  }

  if (body.birthYearMonth !== undefined) {
    const birthYearMonth = validateBirthYearMonth(body.birthYearMonth);
    updates.push("#birthYearMonth = :birthYearMonth");
    names["#birthYearMonth"] = "birthYearMonth";
    values[":birthYearMonth"] = birthYearMonth;
  }

  const now = new Date().toISOString();
  updates.push("#updatedAt = :updatedAt");
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = now;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.CHILDREN,
      Key: { childId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );

  return ok(result.Attributes);
}

export async function deleteChild(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await getOwnedChild(childId, userId);

  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.CHILDREN,
      Key: { childId },
    }),
  );

  return noContent();
}
