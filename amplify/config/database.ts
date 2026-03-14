import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { DatabaseConstruct } from "../custom/database/index";
import { FoundationConstruct } from "../custom/foundation/index";

export interface DatabaseConfig {
  createStack: (name: string) => Stack;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiHandler: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
}

export interface DatabaseResources {
  database: DatabaseConstruct;
  foundation: FoundationConstruct;
}

/**
 * Configure Database and Foundation stacks with Lambda environment variables and IAM grants
 */
export function configureDatabase(config: DatabaseConfig): DatabaseResources {
  // =====================================================================
  // Create Custom Stacks
  // =====================================================================

  const databaseStack = config.createStack("database-stack");
  const environment = process.env.AWS_BRANCH ?? "sandbox";
  const database = new DatabaseConstruct(databaseStack, "Database", { environment });

  const foundationStack = config.createStack("foundation-stack");
  const foundation = new FoundationConstruct(foundationStack, "Foundation");

  // =====================================================================
  // Lambda environment variables — api-handler
  // =====================================================================

  config.apiHandler.addEnvironment("USERS_TABLE", database.usersTable.tableName);
  config.apiHandler.addEnvironment("CHILDREN_TABLE", database.childrenTable.tableName);
  config.apiHandler.addEnvironment("TIC_CARDS_TABLE", database.ticCardsTable.tableName);
  config.apiHandler.addEnvironment("MEDICATION_CARDS_TABLE", database.medicationCardsTable.tableName);
  config.apiHandler.addEnvironment("EPISODES_TABLE", database.episodesTable.tableName);
  config.apiHandler.addEnvironment("MEDICATION_LOGS_TABLE", database.medicationLogsTable.tableName);
  config.apiHandler.addEnvironment("AI_LABELS_TABLE", database.aiLabelsTable.tableName);
  config.apiHandler.addEnvironment("CHECK_INS_TABLE", database.checkInsTable.tableName);
  config.apiHandler.addEnvironment("WEEKLY_REPORTS_TABLE", database.weeklyReportsTable.tableName);
  config.apiHandler.addEnvironment("SHARE_TOKENS_TABLE", database.shareTokensTable.tableName);
  config.apiHandler.addEnvironment("LIFE_EVENTS_TABLE", database.lifeEventsTable.tableName);
  config.apiHandler.addEnvironment("S3_MEDIA_BUCKET", config.storage.bucket.bucketName);
  config.apiHandler.addEnvironment("S3_KNOWLEDGE_BUCKET", foundation.knowledgeBucket.bucketName);
  config.apiHandler.addEnvironment(
    "REGION",
    Stack.of(config.apiHandler.resources.lambda).region
  );
  // Demo mode user ID (populated from seed script)
  config.apiHandler.addEnvironment(
    "DEMO_USER_ID",
    process.env.DEMO_USER_ID || "47644a48-a081-70d1-6e8b-272c764c6078"
  );

  // =====================================================================
  // IAM grants — api-handler
  // =====================================================================

  // DynamoDB: CRUD on all tables + indexes
  config.apiHandler.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
      ],
      resources: database.allTableAndIndexArns,
    })
  );

  // S3: read/write on media bucket
  config.storage.bucket.grantReadWrite(config.apiHandler.resources.lambda);

  return { database, foundation };
}
