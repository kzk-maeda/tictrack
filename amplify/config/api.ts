import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { OrchestrationConstruct } from "../custom/orchestration/index";
import { ApiConstruct } from "../custom/api/index";
import type { DatabaseConstruct } from "../custom/database/index";

export interface ApiConfig {
  createStack: (name: string) => Stack;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiHandler: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentcoreProxy: any;
  database: DatabaseConstruct;
}

export interface ApiResources {
  orchestration: OrchestrationConstruct;
  api: ApiConstruct;
}

/**
 * Configure API Gateway, Orchestration (Step Functions), and related IAM grants
 */
export function configureApi(config: ApiConfig): ApiResources {
  // =====================================================================
  // Create Backend Integration stack
  // =====================================================================

  const backendIntegrationStack = config.createStack("backend-integration-stack");

  // Create orchestration (Step Functions State Machine)
  const environment = process.env.AWS_BRANCH ?? "sandbox";
  const orchestration = new OrchestrationConstruct(backendIntegrationStack, "Orchestration", {
    invokeAgentCoreLambda: config.agentcoreProxy.resources.lambda,
    episodesTable: config.database.episodesTable,
    aiLabelsTable: config.database.aiLabelsTable,
    environment,
  });

  // Create API Gateway with all integrations
  const api = new ApiConstruct(backendIntegrationStack, "Api", {
    userPool: config.auth.userPool,
    apiHandlerFn: config.apiHandler.resources.lambda,
    corsOrigin: "*",
    stateMachineArn: orchestration.stateMachine.stateMachineArn,
    episodesTable: config.database.episodesTable,
    childrenTable: config.database.childrenTable,
    mediaBucket: config.storage.bucket,
    region: Stack.of(backendIntegrationStack).region,
  });

  // =====================================================================
  // IAM grants — api-handler (Cognito)
  // =====================================================================

  // Cognito: AdminDeleteUser (for data deletion requests)
  config.apiHandler.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ["cognito-idp:AdminDeleteUser"],
      resources: [config.auth.userPool.userPoolArn],
    })
  );

  return { orchestration, api };
}
