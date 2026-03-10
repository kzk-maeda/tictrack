import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";

const agentCoreClient = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

interface AnalyzeRequest {
  episodeId?: string; // Added for Step Functions direct invocation
  childId: string;
  s3Key: string;
  bucketName: string;
  videoMimeType?: string;
}

/**
 * AgentCore Proxy Lambda Handler
 *
 * Invokes Bedrock AgentCore Runtime to analyze tic episodes
 *
 * Path: POST /analyze/{episodeId}
 * Body: { childId, s3Key, bucketName, videoMimeType }
 *
 * Environment variables:
 * - AGENTCORE_RUNTIME_ARN: ARN of the AgentCore Runtime
 * - EPISODES_TABLE: DynamoDB episodes table name
 * - AI_LABELS_TABLE: DynamoDB AI labels table name
 */
interface StepFunctionsResponse {
  episodeId: string;
  status: string;
  label?: Record<string, unknown>;
  error?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent | AnalyzeRequest,
  context: Context
): Promise<APIGatewayProxyResult | StepFunctionsResponse> => {
  // CODE VERSION: v5.0 - Support both API Gateway and Step Functions invocation
  const isAPIGateway = "path" in event;

  console.log("🔄 AgentCore Proxy v5.0 invoked", {
    invocationType: isAPIGateway ? "API Gateway" : "Step Functions",
    path: isAPIGateway ? event.path : "N/A",
    requestId: context.awsRequestId,
    timestamp: new Date().toISOString(),
  });

  try {
    let episodeId: string;
    let body: AnalyzeRequest;

    if (isAPIGateway) {
      // API Gateway invocation
      const apiEvent = event as APIGatewayProxyEvent;
      episodeId = apiEvent.pathParameters?.episodeId || "";

      if (!episodeId) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Missing episodeId in path" }),
        };
      }

      body = JSON.parse(apiEvent.body || "{}");
    } else {
      // Step Functions direct invocation
      const sfnEvent = event as AnalyzeRequest;
      episodeId = sfnEvent.episodeId || "";
      body = sfnEvent;

      if (!episodeId) {
        throw new Error("Missing episodeId in Step Functions payload");
      }
    }
    if (!body.childId || !body.s3Key || !body.bucketName) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Missing required fields: childId, s3Key, bucketName",
        }),
      };
    }

    // Get AgentCore Runtime ARN from environment
    const agentRuntimeArn = process.env.AGENTCORE_RUNTIME_ARN;
    if (!agentRuntimeArn) {
      throw new Error("AGENTCORE_RUNTIME_ARN environment variable not set");
    }

    // Prepare payload for AgentCore Runtime
    const payload = {
      episodeId,
      childId: body.childId,
      s3Key: body.s3Key,
      bucketName: body.bucketName,
      videoMimeType: body.videoMimeType || "video/webm",
    };

    console.log("Invoking AgentCore Runtime via SDK", {
      agentRuntimeArn,
      episodeId,
      sessionId: context.awsRequestId,
    });

    // Invoke AgentCore Runtime using SDK (correct approach per AWS docs)
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn,
      runtimeSessionId: context.awsRequestId,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      contentType: "application/json",
      qualifier: "DEFAULT", // Required to target the DEFAULT endpoint
    });

    const response = await agentCoreClient.send(command);

    // Decode response using transformToString (per AWS SDK docs)
    const responseText = response.response
      ? await response.response.transformToString()
      : JSON.stringify({ status: "completed", episodeId });

    console.log("Raw response from AgentCore:", responseText);

    const result = JSON.parse(responseText);

    console.log("AgentCore Runtime response received", {
      episodeId,
      status: result.status,
      hasLabel: !!result.label,
    });

    // Return format depends on invocation type
    if (isAPIGateway) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(result),
      };
    } else {
      // Step Functions expects direct object (not API Gateway response format)
      // Pass through the complete result from AgentCore
      return {
        episodeId,
        status: result.status,
        label: result.label || {},
        error: result.error,
      };
    }
  } catch (error) {
    console.error("AgentCore Proxy error", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
