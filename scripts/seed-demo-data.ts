#!/usr/bin/env ts-node
/**
 * Demo Data Seed Script for TicTrack
 *
 * Creates realistic demo data for testing and demonstration:
 * - 1 child
 * - 10 tic cards (various symptoms)
 * - ~80 episodes (Jan-Mar 2026)
 * - 2 medication cards (from 2026/01/20)
 * - ~50 medication logs
 * - 4 life events
 * - 3 video episodes with AI labels
 *
 * Target user: kzk.maeda0711+test@gmail.com
 *
 * Usage:
 *   ts-node scripts/seed-demo-data.ts
 */

import {
  DynamoDBClient,
  PutItemCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, PutObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { REGION, USER_POOL_ID, BUCKET_NAME, TARGET_EMAIL, TABLES } from "./config";
import {
  CHILD_DATA,
  TIC_CARDS,
  VIDEO_EPISODES,
  MEDICATIONS,
  LIFE_EVENTS,
  EPISODE_SETTINGS,
  MEDICATION_LOG_SETTINGS,
} from "./demo-data";

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: REGION });
const cognito = new CognitoIdentityProviderClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

// Helper to generate random date in range
function randomDate(start: Date, end: Date): string {
  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
  return date.toISOString();
}

// Helper to generate time-based distribution (more in evening)
function randomTimeWeighted(date: string): string {
  const d = new Date(date);
  const hour = Math.random() < 0.3
    ? Math.floor(Math.random() * 6) + 6  // 30% morning (6-12)
    : Math.random() < 0.5
    ? Math.floor(Math.random() * 6) + 12 // 20% afternoon (12-18)
    : Math.floor(Math.random() * 4) + 18; // 50% evening (18-22)

  d.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return d.toISOString();
}

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

// Verify configuration
function verifyConfig() {
  console.log(`Region: ${REGION}`);
  console.log(`Target user: ${TARGET_EMAIL}`);
  console.log(`Example table: ${TABLES.CHILDREN}`);
}

// Create child
async function createChild(userId: string): Promise<string> {
  const childId = randomUUID();
  const now = new Date().toISOString();

  console.log("Creating child...");
  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLES.CHILDREN,
      Item: {
        childId: { S: childId },
        userId: { S: userId },
        displayName: { S: CHILD_DATA.displayName },
        birthYearMonth: { S: CHILD_DATA.birthYearMonth },
        isDefault: { BOOL: CHILD_DATA.isDefault },
        createdAt: { S: now },
        updatedAt: { S: now },
      },
    })
  );

  console.log(`✓ Created child: ${childId}`);
  return childId;
}

// Store card metadata for episode creation
interface CardMetadata {
  cardId: string;
  type: "motor" | "vocal";
  severity: number;
}

// Create tic cards
async function createTicCards(childId: string): Promise<CardMetadata[]> {
  console.log("Creating tic cards...");

  const cardMetadata: CardMetadata[] = [];
  const now = new Date().toISOString();

  for (const card of TIC_CARDS) {
    const cardId = randomUUID();
    cardMetadata.push({
      cardId,
      type: card.type,
      severity: card.severity,
    });

    const item: any = {
      cardId: { S: cardId },
      childId: { S: childId },
      type: { S: card.type },
      complexity: { S: card.complexity },
      severity: { N: card.severity.toString() },
      isActive: { BOOL: true },
      createdAt: { S: now },
      updatedAt: { S: now },
    };

    // Add label field for dashboard display
    if ("label" in card && card.label) {
      item.label = { S: card.label };
    }

    if ("symptomId" in card) {
      item.symptomId = { S: card.symptomId };
    }
    if ("customSymptom" in card) {
      item.customSymptom = { S: card.customSymptom };
    }

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.TIC_CARDS,
        Item: item,
      })
    );
  }

  console.log(`✓ Created ${cardMetadata.length} tic cards`);
  return cardMetadata;
}

// Create episodes
async function createEpisodes(childId: string, cards: CardMetadata[]): Promise<string[]> {
  console.log("Creating episodes...");

  const episodes: string[] = [];

  // Create quick_log episodes
  for (let i = 0; i < EPISODE_SETTINGS.totalQuickLogs; i++) {
    const episodeId = randomUUID();
    episodes.push(episodeId);

    const occurredAt = randomTimeWeighted(
      randomDate(EPISODE_SETTINGS.startDate, EPISODE_SETTINGS.endDate)
    );
    const card = cards[Math.floor(Math.random() * cards.length)];
    const context =
      EPISODE_SETTINGS.contexts[
        Math.floor(Math.random() * EPISODE_SETTINGS.contexts.length)
      ];

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.EPISODES,
        Item: {
          episodeId: { S: episodeId },
          childId: { S: childId },
          recordType: { S: "quick_log" },
          ticCardId: { S: card.cardId },
          occurredAt: { S: occurredAt },
          context: { S: context },
          labelStatus: { S: "confirmed" },
          // Denormalize type and severity for dashboard aggregation
          type: { S: card.type },
          severity: { N: card.severity.toString() },
          createdAt: { S: new Date().toISOString() },
          updatedAt: { S: new Date().toISOString() },
        },
      })
    );
  }

  console.log(`✓ Created ${episodes.length} episodes`);
  return episodes;
}

// Create video episodes with AI labels
async function createVideoEpisodes(childId: string): Promise<void> {
  console.log("Creating video episodes with AI labels...");

  for (const video of VIDEO_EPISODES) {
    const episodeId = randomUUID();

    // Create episode
    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.EPISODES,
        Item: {
          episodeId: { S: episodeId },
          childId: { S: childId },
          recordType: { S: "video" },
          occurredAt: { S: video.date },
          s3Key: { S: video.s3Key },
          videoMimeType: { S: "video/mp4" },
          createdAt: { S: new Date().toISOString() },
          updatedAt: { S: new Date().toISOString() },
        },
      })
    );

    // Create AI label
    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.AI_LABELS,
        Item: {
          episodeId: { S: episodeId },
          version: { N: "1" },
          modelId: { S: "amazon.nova-pro-v1:0" },
          rawOutput: { S: JSON.stringify(video.aiLabel) },
          suggestedType: { S: video.aiLabel.suggestedType },
          suggestedSeverity: { N: video.aiLabel.suggestedSeverity.toString() },
          suggestedContext: { S: video.aiLabel.suggestedContext },
          confidence: { N: video.aiLabel.confidence.toString() },
          observations: {
            S: JSON.stringify(video.aiLabel.observations),
          },
          createdAt: { S: new Date().toISOString() },
        },
      })
    );
  }

  console.log(`✓ Created ${VIDEO_EPISODES.length} video episodes with AI labels`);
}

// Create medication cards
async function createMedications(childId: string): Promise<string[]> {
  console.log("Creating medication cards...");

  const medicationIds: string[] = [];

  for (const med of MEDICATIONS) {
    const medicationId = randomUUID();
    medicationIds.push(medicationId);

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.MEDICATION_CARDS,
        Item: {
          medicationId: { S: medicationId },
          childId: { S: childId },
          medicationName: { S: med.name },
          medicationType: { S: med.type },
          dosageMg: { N: med.dosageMg.toString() },
          frequency: { S: med.frequency },
          isActive: { BOOL: true },
          createdAt: { S: `${med.startDate}T00:00:00Z` },
          updatedAt: { S: new Date().toISOString() },
        },
      })
    );
  }

  console.log(`✓ Created ${medicationIds.length} medication cards`);
  return medicationIds;
}

// Create medication logs
async function createMedicationLogs(
  childId: string,
  medicationIds: string[]
): Promise<void> {
  console.log("Creating medication logs...");

  const days = Math.ceil(
    (MEDICATION_LOG_SETTINGS.endDate.getTime() -
      MEDICATION_LOG_SETTINGS.startDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  let logCount = 0;

  // Create daily logs for each medication
  for (let day = 0; day < days; day++) {
    const date = new Date(MEDICATION_LOG_SETTINGS.startDate);
    date.setDate(date.getDate() + day);

    for (const medicationId of medicationIds) {
      // Skip some days randomly based on adherence rate
      if (Math.random() > MEDICATION_LOG_SETTINGS.adherenceRate) continue;

      const logId = randomUUID();
      const takenAt = new Date(date);
      takenAt.setHours(20, Math.floor(Math.random() * 60), 0);

      await dynamodb.send(
        new PutItemCommand({
          TableName: TABLES.MEDICATION_LOGS,
          Item: {
            logId: { S: logId },
            childId: { S: childId },
            medicationId: { S: medicationId },
            takenAt: { S: takenAt.toISOString() },
            createdAt: { S: new Date().toISOString() },
          },
        })
      );

      logCount++;
    }
  }

  console.log(`✓ Created ${logCount} medication logs`);
}

// Create life events
async function createLifeEvents(childId: string): Promise<void> {
  console.log("Creating life events...");

  for (const event of LIFE_EVENTS) {
    const eventId = randomUUID();

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.LIFE_EVENTS,
        Item: {
          eventId: { S: eventId },
          childId: { S: childId },
          eventType: { S: event.type },
          title: { S: event.title },
          occurredAt: { S: event.occurredAt },
          stressLevel: { N: event.stressLevel.toString() },
          notes: { S: event.notes },
          createdAt: { S: new Date().toISOString() },
          updatedAt: { S: new Date().toISOString() },
        },
      })
    );
  }

  console.log(`✓ Created ${LIFE_EVENTS.length} life events`);
}

// Main execution
async function main() {
  console.log("=== TicTrack Demo Data Seed Script ===\n");

  try {
    // Step 1: Verify configuration
    console.log("Step 1: Verifying configuration...");
    verifyConfig();
    console.log();

    // Step 2: Get userId
    console.log("Step 2: Getting userId from Cognito...");
    const userId = await getUserId();
    console.log();

    // Step 3: Create child
    console.log("Step 3: Creating child...");
    const childId = await createChild(userId);
    console.log();

    // Step 4: Create tic cards
    console.log("Step 4: Creating tic cards...");
    const cards = await createTicCards(childId);
    console.log();

    // Step 5: Create episodes
    console.log("Step 5: Creating episodes...");
    await createEpisodes(childId, cards);
    console.log();

    // Step 6: Create video episodes with AI labels
    console.log("Step 6: Creating video episodes...");
    await createVideoEpisodes(childId);
    console.log();

    // Step 7: Create medications
    console.log("Step 7: Creating medication cards...");
    const medicationIds = await createMedications(childId);
    console.log();

    // Step 8: Create medication logs
    console.log("Step 8: Creating medication logs...");
    await createMedicationLogs(childId, medicationIds);
    console.log();

    // Step 9: Create life events
    console.log("Step 9: Creating life events...");
    await createLifeEvents(childId);
    console.log();

    console.log("=== ✓ Demo data seeding completed successfully! ===");
    console.log(`\nChild ID: ${childId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Target Email: ${TARGET_EMAIL}`);
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    process.exit(1);
  }
}

// Run the script
main();
