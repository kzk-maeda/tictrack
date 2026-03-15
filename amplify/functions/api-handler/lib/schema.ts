/**
 * Schema Registry — Single source of truth for DynamoDB schemas used by api-handler.
 *
 * GSI names, key structures, and attribute names referenced by route handlers
 * and services MUST be defined here instead of being hardcoded.
 *
 * Note: This covers tables accessible to the api-handler Lambda only.
 * Tables used exclusively by other Lambdas (e.g., Invitations by
 * validate-invitation) are defined in GSI/Keys for reference but omitted
 * from the Schema object since api-handler has no env var or IAM grant for them.
 *
 * This registry mirrors the CDK definitions in amplify/custom/database/index.ts.
 * When the CDK schema changes, update this file to keep them in sync.
 */

import { TableNames } from "./dynamodb.js";

// ---------------------------------------------------------------------------
// GSI Definitions
// ---------------------------------------------------------------------------

export const GSI = {
  /** Children table: query by userId, sorted by createdAt */
  Children: {
    byUserId: {
      name: "userId-index",
      pk: "userId",
      sk: "createdAt",
    },
  },

  /** TicCards table: query by childId, sorted by createdAt */
  TicCards: {
    byChildId: {
      name: "childId-index",
      pk: "childId",
      sk: "createdAt",
    },
  },

  /** MedicationCards table: query by childId, sorted by createdAt */
  MedicationCards: {
    byChildId: {
      name: "childId-index",
      pk: "childId",
      sk: "createdAt",
    },
  },

  /** Episodes table: query by childId, sorted by occurredAt */
  Episodes: {
    byChildOccurredAt: {
      name: "childId-occurredAt-index",
      pk: "childId",
      sk: "occurredAt",
    },
  },

  /** MedicationLogs table: two GSIs for different query patterns */
  MedicationLogs: {
    byChildTakenAt: {
      name: "childId-takenAt-index",
      pk: "childId",
      sk: "takenAt",
    },
    byMedicationTakenAt: {
      name: "medicationId-takenAt-index",
      pk: "medicationId",
      sk: "takenAt",
    },
  },

  /** CheckIns table: query by childId, sorted by weekStart */
  CheckIns: {
    byChildWeekStart: {
      name: "childId-weekStart-index",
      pk: "childId",
      sk: "weekStart",
    },
  },

  /** WeeklyReports table: query by childId, sorted by weekStart */
  WeeklyReports: {
    byChildWeekStart: {
      name: "childId-weekStart-index",
      pk: "childId",
      sk: "weekStart",
    },
  },

  /** LifeEvents table: query by childId, sorted by occurredAt */
  LifeEvents: {
    byChildOccurredAt: {
      name: "childId-occurredAt-index",
      pk: "childId",
      sk: "occurredAt",
    },
  },

  /** Invitations table: query by email */
  Invitations: {
    byEmail: {
      name: "email-index",
      pk: "email",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Table Key Definitions
// ---------------------------------------------------------------------------

export const Keys = {
  Users: { pk: "userId" },
  Children: { pk: "childId" },
  TicCards: { pk: "cardId" },
  MedicationCards: { pk: "medicationId" },
  Episodes: { pk: "episodeId" },
  MedicationLogs: { pk: "logId" },
  AILabels: { pk: "episodeId", sk: "version" },
  CheckIns: { pk: "checkInId" },
  WeeklyReports: { pk: "reportId" },
  ShareTokens: { pk: "shareToken" },
  LifeEvents: { pk: "eventId" },
  Invitations: { pk: "invitationCode" },
} as const;

// ---------------------------------------------------------------------------
// Full Schema (Table name + Keys + GSIs combined)
// ---------------------------------------------------------------------------

export const Schema = {
  Users: {
    table: TableNames.USERS,
    keys: Keys.Users,
  },
  Children: {
    table: TableNames.CHILDREN,
    keys: Keys.Children,
    gsi: GSI.Children,
  },
  TicCards: {
    table: TableNames.TIC_CARDS,
    keys: Keys.TicCards,
    gsi: GSI.TicCards,
  },
  MedicationCards: {
    table: TableNames.MEDICATION_CARDS,
    keys: Keys.MedicationCards,
    gsi: GSI.MedicationCards,
  },
  Episodes: {
    table: TableNames.EPISODES,
    keys: Keys.Episodes,
    gsi: GSI.Episodes,
  },
  MedicationLogs: {
    table: TableNames.MEDICATION_LOGS,
    keys: Keys.MedicationLogs,
    gsi: GSI.MedicationLogs,
  },
  AILabels: {
    table: TableNames.AI_LABELS,
    keys: Keys.AILabels,
  },
  CheckIns: {
    table: TableNames.CHECK_INS,
    keys: Keys.CheckIns,
    gsi: GSI.CheckIns,
  },
  WeeklyReports: {
    table: TableNames.WEEKLY_REPORTS,
    keys: Keys.WeeklyReports,
    gsi: GSI.WeeklyReports,
  },
  ShareTokens: {
    table: TableNames.SHARE_TOKENS,
    keys: Keys.ShareTokens,
  },
  LifeEvents: {
    table: TableNames.LIFE_EVENTS,
    keys: Keys.LifeEvents,
    gsi: GSI.LifeEvents,
  },
  // Invitations table is used by validate-invitation Lambda, not api-handler.
  // Included in GSI/Keys for completeness but not in Schema.table mapping.
} as const;
