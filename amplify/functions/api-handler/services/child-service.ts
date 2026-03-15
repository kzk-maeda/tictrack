import {
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, TableNames } from "../lib/dynamodb.js";
import { GSI } from "../lib/schema.js";
import { getOwnedChild } from "../lib/authorization.js";

/**
 * ChildService - Business logic for Child domain
 */
export class ChildService {
  /**
   * Delete a child and all related data (cascade deletion)
   *
   * Order of deletion:
   * 1. TicCards
   * 2. Episodes → AILabels
   * 3. MedicationCards → MedicationLogs
   * 4. LifeEvents
   * 5. Child
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

    // 1. Delete TicCards
    const ticCardsResult = await docClient.send(
      new QueryCommand({
        TableName: TableNames.TIC_CARDS,
        IndexName: GSI.TicCards.byChildId.name,
        KeyConditionExpression: "childId = :childId",
        ExpressionAttributeValues: { ":childId": childId },
      }),
    );

    if (ticCardsResult.Items && ticCardsResult.Items.length > 0) {
      for (const card of ticCardsResult.Items) {
        await docClient.send(
          new DeleteCommand({
            TableName: TableNames.TIC_CARDS,
            Key: { cardId: card.cardId },
          }),
        );
      }
    }

    // 2. Delete Episodes and their AILabels
    const episodesResult = await docClient.send(
      new QueryCommand({
        TableName: TableNames.EPISODES,
        IndexName: GSI.Episodes.byChildOccurredAt.name,
        KeyConditionExpression: "childId = :childId",
        ExpressionAttributeValues: { ":childId": childId },
      }),
    );

    if (episodesResult.Items && episodesResult.Items.length > 0) {
      for (const episode of episodesResult.Items) {
        // Delete AILabels for this episode
        const aiLabelsResult = await docClient.send(
          new QueryCommand({
            TableName: TableNames.AI_LABELS,
            KeyConditionExpression: "episodeId = :episodeId",
            ExpressionAttributeValues: { ":episodeId": episode.episodeId },
          }),
        );

        if (aiLabelsResult.Items && aiLabelsResult.Items.length > 0) {
          for (const label of aiLabelsResult.Items) {
            await docClient.send(
              new DeleteCommand({
                TableName: TableNames.AI_LABELS,
                Key: { episodeId: label.episodeId, version: label.version },
              }),
            );
          }
        }

        // Delete the episode
        await docClient.send(
          new DeleteCommand({
            TableName: TableNames.EPISODES,
            Key: { episodeId: episode.episodeId },
          }),
        );
      }
    }

    // 3. Delete MedicationCards and their MedicationLogs
    const medicationCardsResult = await docClient.send(
      new QueryCommand({
        TableName: TableNames.MEDICATION_CARDS,
        IndexName: GSI.MedicationCards.byChildId.name,
        KeyConditionExpression: "childId = :childId",
        ExpressionAttributeValues: { ":childId": childId },
      }),
    );

    if (medicationCardsResult.Items && medicationCardsResult.Items.length > 0) {
      for (const card of medicationCardsResult.Items) {
        // Delete MedicationLogs for this card
        const logsResult = await docClient.send(
          new QueryCommand({
            TableName: TableNames.MEDICATION_LOGS,
            IndexName: GSI.MedicationLogs.byMedicationTakenAt.name,
            KeyConditionExpression: "medicationId = :medicationId",
            ExpressionAttributeValues: { ":medicationId": card.medicationId },
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
            Key: { medicationId: card.medicationId },
          }),
        );
      }
    }

    // 4. Delete LifeEvents
    const lifeEventsResult = await docClient.send(
      new QueryCommand({
        TableName: TableNames.LIFE_EVENTS,
        IndexName: GSI.LifeEvents.byChildOccurredAt.name,
        KeyConditionExpression: "childId = :childId",
        ExpressionAttributeValues: { ":childId": childId },
      }),
    );

    if (lifeEventsResult.Items && lifeEventsResult.Items.length > 0) {
      for (const event of lifeEventsResult.Items) {
        await docClient.send(
          new DeleteCommand({
            TableName: TableNames.LIFE_EVENTS,
            Key: { eventId: event.eventId },
          }),
        );
      }
    }

    // 5. Finally, delete the child
    await docClient.send(
      new DeleteCommand({
        TableName: TableNames.CHILDREN,
        Key: { childId },
      }),
    );
  }
}
