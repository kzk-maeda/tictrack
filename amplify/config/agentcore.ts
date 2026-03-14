import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AgentCoreConstruct } from "../custom/agentcore/index";
import type { DatabaseConstruct } from "../custom/database/index";
import type { FoundationConstruct } from "../custom/foundation/index";

export interface AgentCoreConfig {
  createStack: (name: string) => Stack;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentcoreProxy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
  database: DatabaseConstruct;
  foundation: FoundationConstruct;
}

/**
 * Configure AgentCore Runtime and agentcore-proxy Lambda
 */
export function configureAgentCore(config: AgentCoreConfig): AgentCoreConstruct {
  // =====================================================================
  // Create AgentCore Runtime stack
  // =====================================================================

  const agentCoreStack = config.createStack("agentcore-stack");
  const environment = process.env.AWS_BRANCH ?? "sandbox";
  const agentCore = new AgentCoreConstruct(agentCoreStack, "AgentCore", {
    agentsRepository: config.foundation.agentsRepository,
    imageTag: "latest",
    environment,
    environmentVariables: {
      EPISODES_TABLE: config.database.episodesTable.tableName,
      AI_LABELS_TABLE: config.database.aiLabelsTable.tableName,
      CHILDREN_TABLE: config.database.childrenTable.tableName,
      S3_MEDIA_BUCKET: config.storage.bucket.bucketName,
      CODE_VERSION: "v9-fix-result-extraction", // Fix result extraction from event["result"]
    },
  });

  // Grant agent permissions to access DynamoDB tables
  agentCore.grantDynamoDBAccess([
    config.database.episodesTable.tableArn,
    config.database.aiLabelsTable.tableArn,
    config.database.childrenTable.tableArn,
  ]);

  // Grant agent permissions to access S3 buckets
  agentCore.grantS3Access([
    config.storage.bucket.bucketArn,
    config.foundation.knowledgeBucket.bucketArn,
  ]);

  // =====================================================================
  // Lambda environment variables — agentcore-proxy
  // =====================================================================

  config.agentcoreProxy.addEnvironment("AGENTCORE_RUNTIME_ARN", agentCore.runtimeArn);
  config.agentcoreProxy.addEnvironment("EPISODES_TABLE", config.database.episodesTable.tableName);
  config.agentcoreProxy.addEnvironment("AI_LABELS_TABLE", config.database.aiLabelsTable.tableName);
  config.agentcoreProxy.addEnvironment(
    "REGION",
    Stack.of(config.agentcoreProxy.resources.lambda).region
  );

  // =====================================================================
  // IAM grants — agentcore-proxy
  // =====================================================================

  // Bedrock AgentCore: Invoke Runtime
  config.agentcoreProxy.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ["bedrock-agentcore:InvokeAgentRuntime"],
      resources: [agentCore.runtimeArn, `${agentCore.runtimeArn}/*`],
    })
  );

  // DynamoDB: Read episodes, write AI labels
  config.agentcoreProxy.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"],
      resources: [
        config.database.episodesTable.tableArn,
        config.database.aiLabelsTable.tableArn,
      ],
    })
  );

  return agentCore;
}
