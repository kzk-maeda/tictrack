import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb.js";

/**
 * Maximum items per DynamoDB TransactWriteItems call.
 */
const TRANSACT_WRITE_LIMIT = 100;

interface DeleteItem {
  tableName: string;
  key: Record<string, unknown>;
}

/**
 * Delete multiple items atomically using TransactWriteItems.
 * If the total exceeds 100 items, batches are executed sequentially.
 * Each batch is atomic, but batches are NOT atomic relative to each other.
 *
 * For full atomicity, ensure total items <= 100.
 */
export async function transactDeleteItems(items: DeleteItem[]): Promise<void> {
  if (items.length === 0) return;

  // Split into batches of 100
  for (let i = 0; i < items.length; i += TRANSACT_WRITE_LIMIT) {
    const batch = items.slice(i, i + TRANSACT_WRITE_LIMIT);

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: batch.map((item) => ({
          Delete: {
            TableName: item.tableName,
            Key: item.key,
          },
        })),
      }),
    );
  }
}
