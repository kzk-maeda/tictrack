/**
 * Shared configuration for seed and cleanup scripts
 *
 * Reads table names and resource IDs from amplify_outputs.json
 * so scripts work across all environments (sandbox, staging, production).
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load amplify outputs
const outputsPath = join(__dirname, "..", "amplify_outputs.json");
const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));

// AWS Configuration (from amplify_outputs.json)
export const REGION = outputs.auth.aws_region as string;
export const USER_POOL_ID = outputs.auth.user_pool_id as string;
export const BUCKET_NAME = outputs.storage.bucket_name as string;

// Target user for demo data
export const TARGET_EMAIL = "kzk.maeda0711+test@gmail.com";

// DynamoDB table names (dynamically resolved from amplify_outputs.json)
const tables = outputs.custom?.Tables;
if (!tables) {
  throw new Error(
    "Table names not found in amplify_outputs.json.\n" +
    "Run 'npx ampx generate outputs' to regenerate after deploying the latest backend."
  );
}

export const TABLES = {
  USERS: tables.users as string,
  CHILDREN: tables.children as string,
  TIC_CARDS: tables.ticCards as string,
  EPISODES: tables.episodes as string,
  AI_LABELS: tables.aiLabels as string,
  MEDICATION_CARDS: tables.medicationCards as string,
  MEDICATION_LOGS: tables.medicationLogs as string,
  LIFE_EVENTS: tables.lifeEvents as string,
  CHECK_INS: tables.checkIns as string,
  WEEKLY_REPORTS: tables.weeklyReports as string,
  SHARE_TOKENS: tables.shareTokens as string,
  INVITATIONS: tables.invitations as string,
} as const;
