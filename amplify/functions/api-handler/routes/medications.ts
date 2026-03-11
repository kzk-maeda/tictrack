import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import type { RouteResult, MedicationCard, MedicationLog } from "../types.js";
import { getUserId } from "../lib/auth.js";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { ok, created, noContent } from "../lib/response.js";
import {
  parseJsonBody,
  validateDisplayName,
  validateMedicationType,
  validateDosage,
  validateFrequency,
} from "../lib/validation.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";

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

export async function listMedicationCards(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await verifyChildOwnership(childId, userId);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.MEDICATION_CARDS,
      IndexName: "childId-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
    }),
  );

  return ok(result.Items || []);
}

export async function createMedicationCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);

  // Validate required fields
  const medicationName = validateDisplayName(body.medicationName);
  const medicationType = validateMedicationType(body.medicationType);
  const dosageMg = validateDosage(body.dosageMg);

  // Validate optional fields
  const frequency = validateFrequency(body.frequency);
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  const now = new Date().toISOString();
  const card: MedicationCard = {
    medicationId: ulid(),
    childId,
    medicationName,
    medicationType,
    dosageMg,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Add optional fields only if they exist
  if (frequency) card.frequency = frequency;
  if (notes) card.notes = notes;

  await docClient.send(
    new PutCommand({
      TableName: TableNames.MEDICATION_CARDS,
      Item: card,
    }),
  );

  return created(card);
}

async function getMedicationCard(medicationId: string, childId: string): Promise<MedicationCard> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.MEDICATION_CARDS,
      Key: { medicationId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError("Medication card not found");
  }

  if (result.Item.childId !== childId) {
    throw new ForbiddenError("Access denied");
  }

  return result.Item as MedicationCard;
}

export async function updateMedicationCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const medicationId = params.medicationId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);
  await getMedicationCard(medicationId, childId);

  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (body.medicationName !== undefined) {
    const medicationName = validateDisplayName(body.medicationName);
    updates.push("#medicationName = :medicationName");
    names["#medicationName"] = "medicationName";
    values[":medicationName"] = medicationName;
  }

  if (body.medicationType !== undefined) {
    const medicationType = validateMedicationType(body.medicationType);
    updates.push("#medicationType = :medicationType");
    names["#medicationType"] = "medicationType";
    values[":medicationType"] = medicationType;
  }

  if (body.dosageMg !== undefined) {
    const dosageMg = validateDosage(body.dosageMg);
    updates.push("#dosageMg = :dosageMg");
    names["#dosageMg"] = "dosageMg";
    values[":dosageMg"] = dosageMg;
  }

  if (body.frequency !== undefined) {
    const frequency = validateFrequency(body.frequency);
    updates.push("#frequency = :frequency");
    names["#frequency"] = "frequency";
    values[":frequency"] = frequency || undefined;
  }

  if (body.notes !== undefined) {
    updates.push("#notes = :notes");
    names["#notes"] = "notes";
    values[":notes"] = body.notes || undefined;
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
      TableName: TableNames.MEDICATION_CARDS,
      Key: { medicationId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    }),
  );

  return ok(result.Attributes);
}

export async function deleteMedicationCard(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const medicationId = params.medicationId;

  await verifyChildOwnership(childId, userId);
  await getMedicationCard(medicationId, childId);

  // Delete associated medication logs first
  const logsResult = await docClient.send(
    new QueryCommand({
      TableName: TableNames.MEDICATION_LOGS,
      IndexName: "medicationId-takenAt-index",
      KeyConditionExpression: "medicationId = :medicationId",
      ExpressionAttributeValues: { ":medicationId": medicationId },
    }),
  );

  if (logsResult.Items && logsResult.Items.length > 0) {
    for (const log of logsResult.Items) {
      await docClient.send(
        new DeleteCommand({
          TableName: TableNames.MEDICATION_LOGS,
          Key: { logId: log.logId },
        }),
      );
    }
  }

  // Delete the medication card
  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.MEDICATION_CARDS,
      Key: { medicationId },
    }),
  );

  return noContent();
}

export async function listMedicationLogs(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;

  await verifyChildOwnership(childId, userId);

  const result = await docClient.send(
    new QueryCommand({
      TableName: TableNames.MEDICATION_LOGS,
      IndexName: "childId-takenAt-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
      ScanIndexForward: false, // Sort by takenAt descending
    }),
  );

  return ok(result.Items || []);
}

export async function createMedicationLog(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const medicationId = params.medicationId;
  const body = parseJsonBody(event.body);

  await verifyChildOwnership(childId, userId);
  const medicationCard = await getMedicationCard(medicationId, childId);

  // Optional fields
  const dosageMg = body.dosageMg !== undefined ? validateDosage(body.dosageMg) : medicationCard.dosageMg;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const takenAt = typeof body.takenAt === "string" ? body.takenAt : new Date().toISOString();

  const now = new Date().toISOString();
  const log: MedicationLog = {
    logId: ulid(),
    childId,
    medicationId,
    takenAt,
    createdAt: now,
  };

  // Add optional fields only if they exist
  if (dosageMg !== undefined) log.dosageMg = dosageMg;
  if (notes) log.notes = notes;

  await docClient.send(
    new PutCommand({
      TableName: TableNames.MEDICATION_LOGS,
      Item: log,
    }),
  );

  return created(log);
}

async function getMedicationLog(logId: string, childId: string): Promise<MedicationLog> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableNames.MEDICATION_LOGS,
      Key: { logId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError("Medication log not found");
  }

  if (result.Item.childId !== childId) {
    throw new ForbiddenError("Access denied");
  }

  return result.Item as MedicationLog;
}

export async function deleteMedicationLog(
  event: APIGatewayProxyEvent,
  params: Record<string, string>,
): Promise<RouteResult> {
  const userId = getUserId(event);
  const childId = params.childId;
  const logId = params.logId;

  await verifyChildOwnership(childId, userId);
  await getMedicationLog(logId, childId);

  await docClient.send(
    new DeleteCommand({
      TableName: TableNames.MEDICATION_LOGS,
      Key: { logId },
    }),
  );

  return noContent();
}
