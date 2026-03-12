import { docClient } from "./dynamodb.js";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { NotFoundError, ForbiddenError } from "./errors.js";

const CHILDREN_TABLE = process.env.CHILDREN_TABLE!;

export interface Child {
  childId: string;
  userId: string;
  displayName: string;
  birthYear?: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

/**
 * Verify that a child belongs to the specified user
 * @param childId - ID of the child to verify
 * @param userId - ID of the authenticated user
 * @throws {NotFoundError} if child does not exist
 * @throws {ForbiddenError} if child does not belong to the user
 */
export async function verifyChildOwnership(
  childId: string,
  userId: string
): Promise<void> {
  const child = await fetchChild(childId);

  if (child.userId !== userId) {
    throw new ForbiddenError("Access denied to this child");
  }
}

/**
 * Get a child and verify that it belongs to the specified user
 * @param childId - ID of the child to fetch
 * @param userId - ID of the authenticated user
 * @returns The child object
 * @throws {NotFoundError} if child does not exist
 * @throws {ForbiddenError} if child does not belong to the user
 */
export async function getOwnedChild(
  childId: string,
  userId: string
): Promise<Child> {
  const child = await fetchChild(childId);

  if (child.userId !== userId) {
    throw new ForbiddenError("Access denied to this child");
  }

  return child;
}

/**
 * Internal helper to fetch a child from the database
 * @param childId - ID of the child to fetch
 * @returns The child object
 * @throws {NotFoundError} if child does not exist
 */
async function fetchChild(childId: string): Promise<Child> {
  const result = await docClient.send(
    new GetCommand({
      TableName: CHILDREN_TABLE,
      Key: { childId },
    })
  );

  if (!result.Item) {
    throw new NotFoundError("Child not found");
  }

  return result.Item as Child;
}
