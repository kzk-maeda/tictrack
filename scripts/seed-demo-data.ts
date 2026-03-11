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
        displayName: { S: "太郎" },
        birthYearMonth: { S: "2018-04" },
        isDefault: { BOOL: true },
        createdAt: { S: now },
        updatedAt: { S: now },
      },
    })
  );

  console.log(`✓ Created child: ${childId}`);
  return childId;
}

// Create tic cards
async function createTicCards(childId: string): Promise<string[]> {
  console.log("Creating tic cards...");

  const cards = [
    { type: "motor", complexity: "simple", symptomId: "eye_blink", severity: 2 },
    { type: "motor", complexity: "simple", symptomId: "head_jerk", severity: 3 },
    { type: "motor", complexity: "simple", symptomId: "shoulder_shrug", severity: 2 },
    { type: "motor", complexity: "simple", symptomId: "facial_grimace", severity: 3 },
    { type: "motor", complexity: "complex", symptomId: "touching_objects", severity: 2 },
    { type: "vocal", complexity: "simple", symptomId: "throat_clear", severity: 3 },
    { type: "vocal", complexity: "simple", symptomId: "sniff", severity: 2 },
    { type: "vocal", complexity: "simple", symptomId: "cough", severity: 2 },
    { type: "vocal", complexity: "complex", symptomId: "repeating_words", severity: 1 },
    { type: "motor", complexity: "complex", customSymptom: "首を何度も回す", severity: 3 },
  ];

  const cardIds: string[] = [];
  const now = new Date().toISOString();

  for (const card of cards) {
    const cardId = randomUUID();
    cardIds.push(cardId);

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

  console.log(`✓ Created ${cardIds.length} tic cards`);
  return cardIds;
}

// Create episodes
async function createEpisodes(childId: string, cardIds: string[]): Promise<string[]> {
  console.log("Creating episodes...");

  const episodes: string[] = [];
  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-03-10");

  // Create ~80 quick_log episodes
  for (let i = 0; i < 80; i++) {
    const episodeId = randomUUID();
    episodes.push(episodeId);

    const occurredAt = randomTimeWeighted(randomDate(startDate, endDate));
    const cardId = cardIds[Math.floor(Math.random() * cardIds.length)];
    const contexts = ["home", "school", "play", "sleep", "meal", "stress"];
    const context = contexts[Math.floor(Math.random() * contexts.length)];

    await dynamodb.send(
      new PutItemCommand({
        TableName: TABLES.EPISODES,
        Item: {
          episodeId: { S: episodeId },
          childId: { S: childId },
          recordType: { S: "quick_log" },
          ticCardId: { S: cardId },
          occurredAt: { S: occurredAt },
          context: { S: context },
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

  // We'll create 3 video episodes
  const videos = [
    {
      date: "2026-02-15T19:30:00Z",
      s3Key: "videos/demo/eye-blink-demo.mp4",
      aiLabel: {
        suggestedType: "motor",
        suggestedSeverity: 2,
        suggestedContext: "home",
        confidence: 0.85,
        observations: [
          { timestamp: 2.5, description: "Rapid eye blinking observed", intensity: "medium" },
          { timestamp: 5.1, description: "Frequency increased", intensity: "medium" },
        ],
      },
    },
    {
      date: "2026-02-20T20:15:00Z",
      s3Key: "videos/demo/throat-clear-demo.mp4",
      aiLabel: {
        suggestedType: "vocal",
        suggestedSeverity: 3,
        suggestedContext: "stress",
        confidence: 0.92,
        observations: [
          { timestamp: 1.2, description: "Throat clearing sound detected", intensity: "high" },
          { timestamp: 3.8, description: "Repeated throat clearing", intensity: "high" },
        ],
      },
    },
    {
      date: "2026-03-05T18:45:00Z",
      s3Key: "videos/demo/shoulder-shrug-demo.mp4",
      aiLabel: {
        suggestedType: "motor",
        suggestedSeverity: 2,
        suggestedContext: "play",
        confidence: 0.78,
        observations: [
          { timestamp: 0.8, description: "Shoulder shrugging movement", intensity: "low" },
          { timestamp: 4.5, description: "Repeated shoulder movement", intensity: "medium" },
        ],
      },
    },
  ];

  for (const video of videos) {
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

  console.log(`✓ Created 3 video episodes with AI labels`);
}

// Create medication cards
async function createMedications(childId: string): Promise<string[]> {
  console.log("Creating medication cards...");

  const medications = [
    {
      name: "リスペリドン (Risperdal)",
      type: "antipsychotic",
      dosageMg: 0.5,
      frequency: "1日2回（朝・夕食後）",
      startDate: "2026-01-20",
    },
    {
      name: "グアンファシン (Intuniv)",
      type: "alpha2_agonist",
      dosageMg: 1.0,
      frequency: "1日1回（就寝前）",
      startDate: "2026-01-25",
    },
  ];

  const medicationIds: string[] = [];

  for (const med of medications) {
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

  const startDate = new Date("2026-01-20");
  const endDate = new Date("2026-03-10");
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  let logCount = 0;

  // Create daily logs for each medication
  for (let day = 0; day < days; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);

    for (const medicationId of medicationIds) {
      // Skip some days randomly (90% adherence)
      if (Math.random() > 0.9) continue;

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

  const events = [
    {
      type: "graduation",
      title: "保育園卒園",
      occurredAt: "2026-03-15",
      stressLevel: 4,
      notes: "小学校入学を控えて緊張している様子",
    },
    {
      type: "medical",
      title: "小児神経科の初診",
      occurredAt: "2026-01-15",
      stressLevel: 3,
      notes: "チック症状について専門医に相談",
    },
    {
      type: "social",
      title: "発表会",
      occurredAt: "2026-02-10",
      stressLevel: 4,
      notes: "大勢の前での発表で緊張",
    },
    {
      type: "family_change",
      title: "妹が生まれる",
      occurredAt: "2026-01-30",
      stressLevel: 2,
      notes: "家族構成の変化",
    },
  ];

  for (const event of events) {
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

  console.log(`✓ Created ${events.length} life events`);
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
    const cardIds = await createTicCards(childId);
    console.log();

    // Step 5: Create episodes
    console.log("Step 5: Creating episodes...");
    await createEpisodes(childId, cardIds);
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
