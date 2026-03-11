#!/usr/bin/env ts-node
/**
 * Demo Data Cleanup Script for TicTrack
 *
 * Removes all data for the target user:
 * - All children and their related data
 * - Tic cards, episodes, AI labels, medications, logs, life events
 *
 * Target user: kzk.maeda0711+test@gmail.com
 *
 * Usage:
 *   ts-node scripts/cleanup-demo-data.ts
 *   npm run seed:clean
 */

import {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
  BatchWriteItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { REGION, USER_POOL_ID, TARGET_EMAIL, TABLES } from "./config";

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: REGION });
const cognito = new CognitoIdentityProviderClient({ region: REGION });

// Get userId from Cognito
async function getUserId(): Promise<string> {
  console.log(`Fetching userId for ${TARGET_EMAIL}...`);

  const response = await cognito.send(
    new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${TARGET_EMAIL}"`,
    })
  );

  if (!response.Users || response.Users.length === 0) {
    throw new Error(`User ${TARGET_EMAIL} not found in Cognito User Pool`);
  }

  const userId = response.Users[0].Username!;
  console.log(`✓ Found userId: ${userId}`);
  return userId;
}

// Get all children for a user
async function getChildren(userId: string): Promise<string[]> {
  console.log("Fetching children...");

  const response = await dynamodb.send(
    new QueryCommand({
      TableName: TABLES.CHILDREN,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
      },
    })
  );

  const childIds =
    response.Items?.map((item) => item.childId.S!).filter(Boolean) || [];
  console.log(`✓ Found ${childIds.length} children`);
  return childIds;
}

// Delete items by partition key (with optional index)
async function deleteByPartitionKey(
  tableName: string,
  partitionKeyName: string,
  partitionKeyValue: string,
  indexName?: string
): Promise<number> {
  let deletedCount = 0;
  let lastEvaluatedKey: any = undefined;

  do {
    const queryParams: any = {
      TableName: tableName,
      KeyConditionExpression: `${partitionKeyName} = :pk`,
      ExpressionAttributeValues: {
        ":pk": { S: partitionKeyValue },
      },
      ProjectionExpression: Object.keys(
        await getTableKeys(tableName)
      ).join(", "),
    };

    if (indexName) {
      queryParams.IndexName = indexName;
    }

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await dynamodb.send(new QueryCommand(queryParams));

    if (response.Items && response.Items.length > 0) {
      // Batch delete items (max 25 per batch)
      for (let i = 0; i < response.Items.length; i += 25) {
        const batch = response.Items.slice(i, i + 25);
        const deleteRequests = batch.map((item) => {
          const keys = getKeysFromItem(item, tableName);
          return {
            DeleteRequest: {
              Key: keys,
            },
          };
        });

        await dynamodb.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [tableName]: deleteRequests,
            },
          })
        );

        deletedCount += deleteRequests.length;
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return deletedCount;
}

// Get primary key structure for a table
async function getTableKeys(
  tableName: string
): Promise<{ [key: string]: string }> {
  // Define key schemas for each table
  const keySchemas: { [table: string]: { [key: string]: string } } = {
    [TABLES.CHILDREN]: { childId: "S" },
    [TABLES.TIC_CARDS]: { cardId: "S" },
    [TABLES.EPISODES]: { episodeId: "S" },
    [TABLES.AI_LABELS]: { episodeId: "S", version: "N" },
    [TABLES.MEDICATION_CARDS]: { medicationId: "S" },
    [TABLES.MEDICATION_LOGS]: { logId: "S" },
    [TABLES.LIFE_EVENTS]: { eventId: "S" },
  };

  return keySchemas[tableName] || {};
}

// Extract keys from an item
function getKeysFromItem(
  item: any,
  tableName: string
): { [key: string]: any } {
  const keySchema = {
    [TABLES.CHILDREN]: ["childId"],
    [TABLES.TIC_CARDS]: ["cardId"],
    [TABLES.EPISODES]: ["episodeId"],
    [TABLES.AI_LABELS]: ["episodeId", "version"],
    [TABLES.MEDICATION_CARDS]: ["medicationId"],
    [TABLES.MEDICATION_LOGS]: ["logId"],
    [TABLES.LIFE_EVENTS]: ["eventId"],
  }[tableName] || [];

  const keys: any = {};
  for (const keyName of keySchema) {
    if (item[keyName]) {
      keys[keyName] = item[keyName];
    }
  }
  return keys;
}

// Delete all data for a child
async function deleteChildData(childId: string): Promise<void> {
  console.log(`\nDeleting data for child: ${childId}`);

  // 1. Delete tic cards
  const ticCardsCount = await deleteByPartitionKey(
    TABLES.TIC_CARDS,
    "childId",
    childId,
    "childId-index"
  );
  console.log(`  ✓ Deleted ${ticCardsCount} tic cards`);

  // 2. Get all episodes (needed for AI labels)
  const episodesQuery = await dynamodb.send(
    new QueryCommand({
      TableName: TABLES.EPISODES,
      IndexName: "childId-occurredAt-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: {
        ":childId": { S: childId },
      },
      ProjectionExpression: "episodeId",
    })
  );

  const episodeIds =
    episodesQuery.Items?.map((item) => item.episodeId.S!).filter(Boolean) ||
    [];
  console.log(`  Found ${episodeIds.length} episodes`);

  // 3. Delete AI labels for episodes
  let aiLabelsCount = 0;
  for (const episodeId of episodeIds) {
    const count = await deleteByPartitionKey(
      TABLES.AI_LABELS,
      "episodeId",
      episodeId
    );
    aiLabelsCount += count;
  }
  console.log(`  ✓ Deleted ${aiLabelsCount} AI labels`);

  // 4. Delete episodes
  const episodesCount = await deleteByPartitionKey(
    TABLES.EPISODES,
    "childId",
    childId,
    "childId-occurredAt-index"
  );
  console.log(`  ✓ Deleted ${episodesCount} episodes`);

  // 5. Delete medication cards and logs
  const medicationCardsQuery = await dynamodb.send(
    new QueryCommand({
      TableName: TABLES.MEDICATION_CARDS,
      IndexName: "childId-index",
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: {
        ":childId": { S: childId },
      },
      ProjectionExpression: "medicationId",
    })
  );

  const medicationIds =
    medicationCardsQuery.Items?.map((item) => item.medicationId.S!).filter(
      Boolean
    ) || [];

  let medicationLogsCount = 0;
  for (const medicationId of medicationIds) {
    const count = await deleteByPartitionKey(
      TABLES.MEDICATION_LOGS,
      "medicationId",
      medicationId,
      "medicationId-takenAt-index"
    );
    medicationLogsCount += count;
  }
  console.log(`  ✓ Deleted ${medicationLogsCount} medication logs`);

  const medicationCardsCount = await deleteByPartitionKey(
    TABLES.MEDICATION_CARDS,
    "childId",
    childId,
    "childId-index"
  );
  console.log(`  ✓ Deleted ${medicationCardsCount} medication cards`);

  // 6. Delete life events
  const lifeEventsCount = await deleteByPartitionKey(
    TABLES.LIFE_EVENTS,
    "childId",
    childId,
    "childId-occurredAt-index"
  );
  console.log(`  ✓ Deleted ${lifeEventsCount} life events`);

  // 7. Finally, delete the child itself
  await dynamodb.send(
    new DeleteItemCommand({
      TableName: TABLES.CHILDREN,
      Key: {
        childId: { S: childId },
      },
    })
  );
  console.log(`  ✓ Deleted child record`);
}

// Main execution
async function main() {
  console.log("=== TicTrack Demo Data Cleanup Script ===\n");

  try {
    // Step 1: Get userId
    console.log("Step 1: Getting userId from Cognito...");
    const userId = await getUserId();
    console.log();

    // Step 2: Get all children
    console.log("Step 2: Getting children...");
    const childIds = await getChildren(userId);

    if (childIds.length === 0) {
      console.log("\n✓ No data to clean up. User has no children.");
      return;
    }

    console.log();

    // Step 3: Delete data for each child
    console.log("Step 3: Deleting child data...");
    for (const childId of childIds) {
      await deleteChildData(childId);
    }

    console.log("\n=== ✓ Demo data cleanup completed successfully! ===");
    console.log(`\nDeleted data for ${childIds.length} child(ren)`);
    console.log(`User ID: ${userId}`);
    console.log(`Target Email: ${TARGET_EMAIL}`);
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Run the script
main();
