/**
 * Shared configuration for seed and cleanup scripts
 */

// AWS Configuration
export const REGION = "ap-northeast-1";
export const USER_POOL_ID = "ap-northeast-1_k1nZn5TA4";
export const BUCKET_NAME = "amplify-awsaideascompetit-tictrackmediabucket710f7-vrusjcjf3sph";

// Target user for demo data
export const TARGET_EMAIL = "kzk.maeda0711+test@gmail.com";

// DynamoDB table names (as defined in amplify/custom/database/index.ts)
export const TABLES = {
  USERS: "Users",
  CHILDREN: "Children",
  TIC_CARDS: "TicCards",
  EPISODES: "Episodes",
  AI_LABELS: "AILabels",
  MEDICATION_CARDS: "MedicationCards",
  MEDICATION_LOGS: "MedicationLogs",
  LIFE_EVENTS: "LifeEvents",
  CHECK_INS: "CheckIns",
  WEEKLY_REPORTS: "WeeklyReports",
  SHARE_TOKENS: "ShareTokens",
} as const;
