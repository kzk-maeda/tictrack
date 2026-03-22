import {
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { GSI } from "../lib/schema.js";
import { getOwnedChild } from "../lib/authorization.js";
import { transactDeleteItems } from "../lib/transact-delete.js";

/**
 * ChildService - Business logic for Child domain
 */
export class ChildService {
  /**
   * Delete a child and all related data (cascade deletion)
   *
   * Uses a two-phase approach for safety:
   * 1. Soft-delete: Set deletedAt on child (immediately hidden from UI)
   * 2. Physical delete: Remove related data in batched transactions, then remove child
   *
   * If physical deletion fails partway, the child remains soft-deleted
   * and related data can be cleaned up on retry.
   *
   * @throws {ForbiddenError} if user does not own the child
   * @throws {NotFoundError} if child does not exist
   */
  static async deleteChildCascade(
    childId: string,
    userId: string,
  ): Promise<void> {
    // Authorization check
    await getOwnedChild(childId, userId);

    // Phase 1: Soft-delete the child (immediately hidden from queries)
    await docClient.send(
      new UpdateCommand({
        TableName: TableNames.CHILDREN,
        Key: { childId },
        UpdateExpression: "SET deletedAt = :deletedAt",
        ExpressionAttributeValues: {
          ":deletedAt": new Date().toISOString(),
        },
      }),
    );

    // Phase 2: Physical deletion of related data
    // Each entity group is deleted in a transaction batch for atomicity within the group.
    // If a group fails, prior groups are already deleted but the child remains soft-deleted.

    // 2a. Delete TicCards
    const ticCards = await queryAllItems(
      TableNames.TIC_CARDS,
      GSI.TicCards.byChildId.name,
      "childId",
      childId,
    );
    await transactDeleteItems(
      ticCards.map((c) => ({ tableName: TableNames.TIC_CARDS, key: { cardId: c.cardId } })),
    );

    // 2b. Delete Episodes + AILabels
    const episodes = await queryAllItems(
      TableNames.EPISODES,
      GSI.Episodes.byChildOccurredAt.name,
      "childId",
      childId,
    );

    const episodeDeleteItems: { tableName: string; key: Record<string, unknown> }[] = [];
    for (const episode of episodes) {
      // Collect AILabels for this episode
      const aiLabels = await queryAllItems(
        TableNames.AI_LABELS,
        undefined, // PK query, no GSI
        "episodeId",
        episode.episodeId,
      );
      for (const label of aiLabels) {
        episodeDeleteItems.push({
          tableName: TableNames.AI_LABELS,
          key: { episodeId: label.episodeId, version: label.version },
        });
      }
      episodeDeleteItems.push({
        tableName: TableNames.EPISODES,
        key: { episodeId: episode.episodeId },
      });
    }
    await transactDeleteItems(episodeDeleteItems);

    // 2c. Delete MedicationCards + MedicationLogs
    const medicationCards = await queryAllItems(
      TableNames.MEDICATION_CARDS,
      GSI.MedicationCards.byChildId.name,
      "childId",
      childId,
    );

    const medicationDeleteItems: { tableName: string; key: Record<string, unknown> }[] = [];
    for (const card of medicationCards) {
      const logs = await queryAllItems(
        TableNames.MEDICATION_LOGS,
        GSI.MedicationLogs.byMedicationTakenAt.name,
        "medicationId",
        card.medicationId,
      );
      for (const log of logs) {
        medicationDeleteItems.push({
          tableName: TableNames.MEDICATION_LOGS,
          key: { logId: log.logId },
        });
      }
      medicationDeleteItems.push({
        tableName: TableNames.MEDICATION_CARDS,
        key: { medicationId: card.medicationId },
      });
    }
    await transactDeleteItems(medicationDeleteItems);

    // 2d. Delete LifeEvents
    const lifeEvents = await queryAllItems(
      TableNames.LIFE_EVENTS,
      GSI.LifeEvents.byChildOccurredAt.name,
      "childId",
      childId,
    );
    await transactDeleteItems(
      lifeEvents.map((e) => ({ tableName: TableNames.LIFE_EVENTS, key: { eventId: e.eventId } })),
    );

    // Phase 3: Physical-delete the child record
    await docClient.send(
      new DeleteCommand({
        TableName: TableNames.CHILDREN,
        Key: { childId },
      }),
    );
  }
}

/**
 * Query all items from a table/GSI with pagination support.
 */
async function queryAllItems(
  tableName: string,
  indexName: string | undefined,
  partitionKeyName: string,
  partitionKeyValue: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const params: Record<string, unknown> = {
      TableName: tableName,
      KeyConditionExpression: `${partitionKeyName} = :pk`,
      ExpressionAttributeValues: { ":pk": partitionKeyValue },
    };
    if (indexName) params.IndexName = indexName;
    if (lastKey) params.ExclusiveStartKey = lastKey;

    const result = await docClient.send(new QueryCommand(params));
    if (result.Items) items.push(...result.Items);
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}
