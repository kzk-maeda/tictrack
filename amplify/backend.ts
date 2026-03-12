import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { auth } from "./auth/resource";
import { storage } from "./storage/resource";
import { apiHandler } from "./functions/api-handler/resource";
import { agentcoreProxy } from "./functions/agentcore-proxy/resource";
import { configureAuth } from "./config/auth";
import { configureStorage } from "./config/storage";
import { configureDatabase } from "./config/database";
import { configureAgentCore } from "./config/agentcore";
import { configureApi } from "./config/api";

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
// Configuration: Apply overrides and create custom stacks
// =====================================================================

// Auth: Cognito User Pool and User Pool Client overrides
configureAuth(backend.auth.resources);

// Storage: S3 media bucket lifecycle rules
configureStorage(backend.storage.resources);

// Database: Database + Foundation stacks + api-handler env vars + IAM
const { database, foundation } = configureDatabase({
  createStack: backend.createStack.bind(backend),
  apiHandler: backend.apiHandler,
  storage: backend.storage.resources,
});

// AgentCore: AgentCore Runtime + agentcore-proxy env vars + IAM
const agentCore = configureAgentCore({
  createStack: backend.createStack.bind(backend),
  agentcoreProxy: backend.agentcoreProxy,
  storage: backend.storage.resources,
  database,
  foundation,
});

// API: Orchestration (Step Functions) + API Gateway + api-handler IAM
const { orchestration, api } = configureApi({
  createStack: backend.createStack.bind(backend),
  auth: backend.auth.resources,
  storage: backend.storage.resources,
  apiHandler: backend.apiHandler,
  agentcoreProxy: backend.agentcoreProxy,
  database,
});

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
