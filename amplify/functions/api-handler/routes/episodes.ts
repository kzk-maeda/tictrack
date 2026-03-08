import type { APIGatewayProxyEvent } from "aws-lambda";
import { PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import type { RouteResult, Episode } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok, created, noContent } from "../lib/response.js";
import { parseJsonBody, validateISODateTime } from "../lib/validation.js";
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

async function verifyTicCardOwnership(
  ticCardId: string,
  childId: string,
): Promise<void> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.TIC_CARDS,
      Key: { cardId: ticCardId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError("Tic card not found");
  }

  if (result.Item.childId !== childId) {
    throw new ForbiddenError("Tic card does not belong to this child");
  }
}

export async function listEpisodes(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await verifyChildOwnership(childId, userId);

  const from = event.queryStringParameters?.from;
  const to = event.queryStringParameters?.to;

  let keyConditionExpression = "childId = :childId";
  const expressionValues: Record<string, string> = { ":childId": childId };

  if (from && to) {
    keyConditionExpression += " AND occurredAt BETWEEN :from AND :to";
    expressionValues[":from"] = from;
    expressionValues[":to"] = to;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.EPISODES,
      IndexName: "childId-occurredAt-index",
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false, // Descending order (newest first)
    }),
  );

  return ok(result.Items || []);
}

export async function createEpisode(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);

  const recordType = body.recordType as "video" | "quick_log";
  if (recordType !== "video" && recordType !== "quick_log") {
    throw new ForbiddenError("recordType must be 'video' or 'quick_log'");
  }

  const occurredAt = validateISODateTime(body.occurredAt);
  const ticCardId = typeof body.ticCardId === "string" ? body.ticCardId : undefined;
  const context = typeof body.context === "string" ? body.context : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  // Cross-child isolation: Verify tic card belongs to this child
  if (ticCardId) {
    await verifyTicCardOwnership(ticCardId, childId);
  }

  const labelStatus = recordType === "quick_log" ? "confirmed" : "pending";

  const now = new Date().toISOString();
  const episode: Episode = {
    episodeId: ulid(),
    childId,
    recordType,
    ticCardId,
    occurredAt,
    context,
    notes,
    labelStatus,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.EPISODES,
      Item: episode,
    }),
  );

  return created(episode);
}

export async function deleteEpisode(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const { childId, episodeId } = params;

  await verifyChildOwnership(childId, userId);

  // Verify episode exists and belongs to this child
  const getResult = await docClient.send(
    new GetCommand({
      TableName: TableNames.EPISODES,
      Key: { episodeId },
    }),
  );

  if (!getResult.Item) {
    throw new NotFoundError("Episode not found");
  }

  if (getResult.Item.childId !== childId) {
    throw new ForbiddenError("Episode does not belong to this child");
  }

  // Delete the episode
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.EPISODES,
      Key: { episodeId },
    }),
  );

  return noContent();
}

export async function submitEpisodeFeedback(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const episodeId = params.episodeId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);

  // Validate feedback type
  const feedbackType = body.feedbackType as string;
  const validFeedbackTypes = ["useful", "not_useful", "incorrect", "needs_edit"];
  if (!validFeedbackTypes.includes(feedbackType)) {
    throw new ForbiddenError(`feedbackType must be one of: ${validFeedbackTypes.join(", ")}`);
  }

  // Get the episode to verify ownership
  const getResult = await docClient.send(
    new GetCommand({
      TableName: TableNames.EPISODES,
      Key: { episodeId },
    }),
  );

  if (!getResult.Item) {
    throw new NotFoundError("Episode not found");
  }

  if (getResult.Item.childId !== childId) {
    throw new ForbiddenError("Episode does not belong to this child");
  }

  // Update episode with feedback
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TableNames.EPISODES,
      Key: { episodeId },
      UpdateExpression:
        "SET feedbackType = :feedbackType, feedbackDetails = :feedbackDetails, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":feedbackType": feedbackType,
        ":feedbackDetails": body.feedbackDetails || null,
        ":updatedAt": now,
      },
    }),
  );

  return ok({ message: "Feedback submitted successfully" });
}

export async function getEpisodeAILabel(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const episodeId = params.episodeId;

  await verifyChildOwnership(childId, userId);

  // Get the episode to verify ownership
  const episodeResult = await docClient.send(
    new GetCommand({
      TableName: TableNames.EPISODES,
      Key: { episodeId },
    }),
  );

  if (!episodeResult.Item) {
    throw new NotFoundError("Episode not found");
  }

  if (episodeResult.Item.childId !== childId) {
    throw new ForbiddenError("Episode does not belong to this child");
  }

  // Query AI labels for this episode (get latest version)
  const aiLabelsResult = await docClient.send(
    new QueryCommand({
      TableName: TableNames.AI_LABELS,
      KeyConditionExpression: "episodeId = :episodeId",
      ExpressionAttributeValues: {
        ":episodeId": episodeId,
      },
      ScanIndexForward: false, // Descending order (latest version first)
      Limit: 1,
    }),
  );

  if (!aiLabelsResult.Items || aiLabelsResult.Items.length === 0) {
    throw new NotFoundError("AI label not found");
  }

  const aiLabel = aiLabelsResult.Items[0];

  // Parse rawOutput if it's a JSON string
  let parsedOutput = aiLabel.rawOutput;
  if (typeof aiLabel.rawOutput === "string") {
    try {
      parsedOutput = JSON.parse(aiLabel.rawOutput);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  return ok({
    ...aiLabel,
    rawOutput: parsedOutput,
  });
}
