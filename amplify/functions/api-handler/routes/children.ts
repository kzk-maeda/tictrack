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
import { getOwnedChild } from "../lib/authorization.js";
import { ChildService } from "../services/child-service.js";

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

  await ChildService.deleteChildCascade(childId, userId);

  return noContent();
}

export async function setDefaultChild(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await getOwnedChild(childId, userId);

  // Get all children for this user
  const listResult = await docClient.send(
    new QueryCommand({
      TableName: TableNames.CHILDREN,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    }),
  );

  // Unset isDefault for all children
  for (const child of listResult.Items || []) {
    if (child.childId !== childId && child.isDefault) {
      await docClient.send(
        new UpdateCommand({
          TableName: TableNames.CHILDREN,
          Key: { childId: child.childId },
          UpdateExpression: "REMOVE isDefault SET updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":updatedAt": new Date().toISOString(),
          },
        }),
      );
    }
  }

  // Set isDefault=true for the target child
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableNames.CHILDREN,
      Key: { childId },
      UpdateExpression: "SET isDefault = :isDefault, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":isDefault": true,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return ok(result.Attributes);
}
