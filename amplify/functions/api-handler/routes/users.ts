import type { APIGatewayProxyEvent } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { RouteResult, User } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok } from "../lib/response.js";
import { parseJsonBody, validateDisplayName } from "../lib/validation.js";

export async function getMe(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const userId = getUserId(event);

  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.USERS,
      Key: { userId },
    }),
  );

  if (!result.Item) {
    const now = new Date().toISOString();
    const claims = event.requestContext.authorizer?.claims;
    const newUser: User = {
      userId,
      email: (claims?.email as string) || "",
      displayName: "",
      settings: {},
      createdAt: now,
      updatedAt: now,
    };
    await docClient.send(
      new PutCommand({
        TableName: TableNames.USERS,
        Item: newUser,
      }),
    );
    return ok(newUser);
  }

  return ok(result.Item);
}

export async function updateMe(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const body = parseJsonBody(event.body);

  const existing = await docClient.send(
    new GetCommand({
      TableName: TableNames.USERS,
      Key: { userId },
    }),
  );

  const current = (existing.Item as User) || {
    userId,
    email: "",
    displayName: "",
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (body.displayName !== undefined) {
    current.displayName = validateDisplayName(body.displayName);
  }

  if (body.settings !== undefined && typeof body.settings === "object") {
    current.settings = { ...current.settings, ...(body.settings as Record<string, unknown>) };
  }

  current.updatedAt = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: TableNames.USERS,
      Item: current,
    }),
  );

  return ok(current);
}
