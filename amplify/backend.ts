import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

// Helper: get L1 CfnResource from L2 construct
// Uses explicit return type + any parameter to avoid 'as' type assertion,
// which tsx/esm tsImport cannot parse.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cfn(construct: any): { addPropertyOverride(path: string, value: unknown): void } {
  return construct.node.defaultChild;
}
import { auth } from "./auth/resource";
import { storage } from "./storage/resource";
import { apiHandler } from "./functions/api-handler/resource";
import { agentcoreProxy } from "./functions/agentcore-proxy/resource";
import { DatabaseConstruct } from "./custom/database/index";
import { FoundationConstruct } from "./custom/foundation/index";
import { ApiConstruct } from "./custom/api/index";
import { AgentCoreConstruct } from "./custom/agentcore/index";
import { OrchestrationConstruct } from "./custom/orchestration/index";

// =====================================================================
// Step 0-1: Currently active
// =====================================================================

const backend = defineBackend({
  auth,
  storage,
  apiHandler,
  agentcoreProxy,
});

// =====================================================================
// Amplify Auth overrides — Cognito User Pool
// =====================================================================

const userPoolCfn = cfn(backend.auth.resources.userPool);

// Password policy: min 8, uppercase, lowercase, numbers, symbols
userPoolCfn.addPropertyOverride("Policies", {
  PasswordPolicy: {
    MinimumLength: 8,
    RequireLowercase: true,
    RequireUppercase: true,
    RequireNumbers: true,
    RequireSymbols: true,
    TemporaryPasswordValidityDays: 7,
  },
});

// Custom attribute: coppa_consent (Boolean, mutable)
userPoolCfn.addPropertyOverride("Schema", [
  {
    Name: "coppa_consent",
    AttributeDataType: "Boolean",
    Mutable: true,
    Required: false,
  },
]);

// UserPoolClient: token validity (1h/1h/30d)
const userPoolClientCfn = cfn(backend.auth.resources.userPoolClient);
userPoolClientCfn.addPropertyOverride("AccessTokenValidity", 1);
userPoolClientCfn.addPropertyOverride("IdTokenValidity", 1);
userPoolClientCfn.addPropertyOverride("RefreshTokenValidity", 30);
userPoolClientCfn.addPropertyOverride("TokenValidityUnits", {
  AccessToken: "hours",
  IdToken: "hours",
  RefreshToken: "days",
});

// =====================================================================
// Amplify Storage overrides — S3 media lifecycle
// =====================================================================

const mediaBucketCfn = cfn(backend.storage.resources.bucket);
mediaBucketCfn.addPropertyOverride("LifecycleConfiguration", {
  Rules: [
    {
      Id: "archive-videos-90d",
      Prefix: "videos/",
      Status: "Enabled",
      Transitions: [
        {
          StorageClass: "GLACIER_IR",
          TransitionInDays: 90,
        },
      ],
    },
    {
      Id: "cleanup-tmp-1d",
      Prefix: "tmp/",
      Status: "Enabled",
      ExpirationInDays: 1,
    },
  ],
});

// =====================================================================
// Custom Stacks — Step 0: Database + Foundation
// =====================================================================

const databaseStack = backend.createStack("database-stack");
const database = new DatabaseConstruct(databaseStack, "Database");

const foundationStack = backend.createStack("foundation-stack");
const foundation = new FoundationConstruct(foundationStack, "Foundation");

// =====================================================================
// Custom Stack — Step 4: AgentCore Runtime
// =====================================================================

const agentCoreStack = backend.createStack("agentcore-stack");
const agentCore = new AgentCoreConstruct(agentCoreStack, "AgentCore", {
  agentsRepository: foundation.agentsRepository,
  imageTag: "latest",
  environmentVariables: {
    EPISODES_TABLE: database.episodesTable.tableName,
    AI_LABELS_TABLE: database.aiLabelsTable.tableName,
    CHILDREN_TABLE: database.childrenTable.tableName,
    S3_MEDIA_BUCKET: backend.storage.resources.bucket.bucketName,
    CODE_VERSION: "v9-fix-result-extraction", // Fix result extraction from event["result"]
  },
});

// Grant agent permissions to access DynamoDB tables
agentCore.grantDynamoDBAccess([
  database.episodesTable.tableArn,
  database.aiLabelsTable.tableArn,
  database.childrenTable.tableArn,
]);

// Grant agent permissions to access S3 buckets
agentCore.grantS3Access([
  backend.storage.resources.bucket.bucketArn,
  foundation.knowledgeBucket.bucketArn,
]);

// =====================================================================
// Custom Stack — Step 4: Backend Integration (Orchestration + API)
// =====================================================================

const backendIntegrationStack = backend.createStack("backend-integration-stack");

// Create orchestration (Step Functions State Machine)
const orchestration = new OrchestrationConstruct(backendIntegrationStack, "Orchestration", {
  invokeAgentCoreLambda: backend.agentcoreProxy.resources.lambda,
  episodesTable: database.episodesTable,
  aiLabelsTable: database.aiLabelsTable,
});

// Create API Gateway with all integrations
const api = new ApiConstruct(backendIntegrationStack, "Api", {
  userPool: backend.auth.resources.userPool,
  apiHandlerFn: backend.apiHandler.resources.lambda,
  corsOrigin: "*",
  stateMachineArn: orchestration.stateMachine.stateMachineArn,
  episodesTable: database.episodesTable,
  region: Stack.of(backendIntegrationStack).region,
});

// =====================================================================
// Lambda environment variables — api-handler
// =====================================================================

backend.apiHandler.addEnvironment(
  "USERS_TABLE",
  database.usersTable.tableName
);
backend.apiHandler.addEnvironment(
  "CHILDREN_TABLE",
  database.childrenTable.tableName
);
backend.apiHandler.addEnvironment(
  "TIC_CARDS_TABLE",
  database.ticCardsTable.tableName
);
backend.apiHandler.addEnvironment(
  "MEDICATION_CARDS_TABLE",
  database.medicationCardsTable.tableName
);
backend.apiHandler.addEnvironment(
  "EPISODES_TABLE",
  database.episodesTable.tableName
);
backend.apiHandler.addEnvironment(
  "MEDICATION_LOGS_TABLE",
  database.medicationLogsTable.tableName
);
backend.apiHandler.addEnvironment(
  "AI_LABELS_TABLE",
  database.aiLabelsTable.tableName
);
backend.apiHandler.addEnvironment(
  "CHECK_INS_TABLE",
  database.checkInsTable.tableName
);
backend.apiHandler.addEnvironment(
  "WEEKLY_REPORTS_TABLE",
  database.weeklyReportsTable.tableName
);
backend.apiHandler.addEnvironment(
  "SHARE_TOKENS_TABLE",
  database.shareTokensTable.tableName
);
backend.apiHandler.addEnvironment(
  "S3_MEDIA_BUCKET",
  backend.storage.resources.bucket.bucketName
);
backend.apiHandler.addEnvironment(
  "S3_KNOWLEDGE_BUCKET",
  foundation.knowledgeBucket.bucketName
);
backend.apiHandler.addEnvironment(
  "REGION",
  Stack.of(backend.apiHandler.resources.lambda).region
);

// =====================================================================
// IAM grants — api-handler
// =====================================================================

// DynamoDB: CRUD on all tables + indexes
backend.apiHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ],
    resources: database.allTableAndIndexArns,
  })
);

// S3: read/write on media bucket
backend.storage.resources.bucket.grantReadWrite(
  backend.apiHandler.resources.lambda
);

// Cognito: AdminDeleteUser (for data deletion requests)
backend.apiHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:AdminDeleteUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);

// =====================================================================
// Lambda environment variables — agentcore-proxy
// =====================================================================

backend.agentcoreProxy.addEnvironment(
  "AGENTCORE_RUNTIME_ARN",
  agentCore.runtimeArn
);
backend.agentcoreProxy.addEnvironment(
  "EPISODES_TABLE",
  database.episodesTable.tableName
);
backend.agentcoreProxy.addEnvironment(
  "AI_LABELS_TABLE",
  database.aiLabelsTable.tableName
);
backend.agentcoreProxy.addEnvironment(
  "REGION",
  Stack.of(backend.agentcoreProxy.resources.lambda).region
);

// =====================================================================
// IAM grants — agentcore-proxy
// =====================================================================

// Bedrock AgentCore: Invoke Runtime
backend.agentcoreProxy.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["bedrock-agentcore:InvokeAgentRuntime"],
    resources: [agentCore.runtimeArn, `${agentCore.runtimeArn}/*`],
  })
);

// DynamoDB: Read episodes, write AI labels
backend.agentcoreProxy.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"],
    resources: [
      database.episodesTable.tableArn,
      database.aiLabelsTable.tableArn,
    ],
  })
);

// =====================================================================
// Lambda environment variables — start-analysis
// =====================================================================
// Removed: startAnalysis is now created directly in api-stack

// =====================================================================
// IAM grants — start-analysis
// =====================================================================
// Removed: startAnalysis IAM grants are now handled in ApiConstruct

// =====================================================================
// Outputs
// =====================================================================

backend.addOutput({
  custom: {
    API: {
      endpoint: api.restApi.url,
      region: Stack.of(api.restApi).region,
    },
    KnowledgeBucket: foundation.knowledgeBucket.bucketName,
    AgentsECR: foundation.agentsRepository.repositoryUri,
    AgentCore: {
      runtimeArn: agentCore.runtimeArn,
      runtimeId: agentCore.runtimeId,
      runtimeEndpoint: agentCore.runtimeEndpoint,
      executionRoleArn: agentCore.agentExecutionRole.roleArn,
      logGroupName: agentCore.logGroup.logGroupName,
    },
  },
});

// =====================================================================
// Step 4: AI Labeling — AgentCore Runtime (ACTIVE)
// =====================================================================
//
// ✅ AgentCore Runtime deployed (see agentcore-stack above)
//
// TODO: Lambda Proxy (uncomment when ready)
//
// import { aiProxy } from './functions/ai-proxy/resource';
//
// Add aiProxy to defineBackend({...})
//
// backend.aiProxy.addEnvironment('EPISODES_TABLE', database.episodesTable.tableName);
// backend.aiProxy.addEnvironment('AI_LABELS_TABLE', database.aiLabelsTable.tableName);
// backend.aiProxy.addEnvironment('AGENTCORE_RUNTIME_ARN', agentCore.runtimeArn);
// backend.aiProxy.addEnvironment('REGION', Stack.of(agentCoreStack).region);
//
// backend.aiProxy.resources.lambda.addToRolePolicy(new PolicyStatement({
//   actions: [
//     'dynamodb:UpdateItem',
//     'dynamodb:GetItem',
//     'bedrock:InvokeAgent', // To call AgentCore
//   ],
//   resources: [
//     database.episodesTable.tableArn,
//     database.aiLabelsTable.tableArn,
//     agentCore.agentRuntimeArn,
//   ],
// }));
//
// Add /analyze/{proxy+} route to ApiConstruct

// =====================================================================
// Step 6: Weekly Reports (uncomment when ready)
// =====================================================================
//
// import { reportGenerator } from './functions/report-generator/resource';
//
// Add reportGenerator to defineBackend({...})
//
// const orchestrationStack = backend.createStack('orchestration-stack');
// const orchestration = new OrchestrationConstruct(orchestrationStack, 'Orchestration', { ... });
//
// IAM grants for report-generator Lambda:
//   - DynamoDB read on all tables, write on WeeklyReports
//   - S3 PutObject on media/reports/*
//   - Bedrock InvokeModel + ApplyGuardrail

// =====================================================================
// Step 7: Knowledge Base (uncomment when ready)
// =====================================================================
//
// Set CREATE_KNOWLEDGE_BASE=true to enable in AiConstruct
// AiConstruct creates: Bedrock Knowledge Base + DataSource + IAM Role

// =====================================================================
// Step 8: Data Deletion (uncomment when ready)
// =====================================================================
//
// import { dataDeletion } from './functions/data-deletion/resource';
//
// Add dataDeletion to defineBackend({...})
//
// OrchestrationConstruct: add data deletion Step Functions workflow
//
// api-handler already has Step Functions startExecution permission
// (add when Step Functions ARN is available)
