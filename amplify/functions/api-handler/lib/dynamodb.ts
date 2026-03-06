import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TableNames = {
  USERS: process.env.USERS_TABLE!,
  CHILDREN: process.env.CHILDREN_TABLE!,
  TIC_CARDS: process.env.TIC_CARDS_TABLE!,
  EPISODES: process.env.EPISODES_TABLE!,
  AI_LABELS: process.env.AI_LABELS_TABLE!,
  CHECK_INS: process.env.CHECK_INS_TABLE!,
  WEEKLY_REPORTS: process.env.WEEKLY_REPORTS_TABLE!,
  SHARE_TOKENS: process.env.SHARE_TOKENS_TABLE!,
} as const;
