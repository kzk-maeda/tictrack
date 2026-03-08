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
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("AgentCore Proxy invoked", {
    path: event.path,
    episodeId: event.pathParameters?.episodeId,
    requestId: context.awsRequestId,
  });

  try {
    // Extract episodeId from path
    const episodeId = event.pathParameters?.episodeId;
    if (!episodeId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing episodeId in path" }),
      };
    }

    // Parse request body
    const body: AnalyzeRequest = JSON.parse(event.body || "{}");
    if (!body.childId || !body.s3Key || !body.bucketName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
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

    console.log("Invoking AgentCore Runtime", {
      agentRuntimeArn,
      episodeId,
      sessionId: context.awsRequestId,
    });

    // Invoke AgentCore Runtime
    const command = new InvokeAgentRuntimeCommand({
      agentRuntimeArn,
      runtimeSessionId: context.awsRequestId,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      qualifier: "DEFAULT",
    });

    const response = await agentCoreClient.send(command);

    // Decode response
    // Note: Response structure may vary; adapt based on actual AgentCore response
    const responseText = response.response
      ? new TextDecoder().decode(
          response.response as unknown as Uint8Array
        )
      : JSON.stringify({ status: "completed", episodeId });
    const result = JSON.parse(responseText);

    console.log("AgentCore Runtime response received", {
      episodeId,
      status: result.status,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(result),
    };
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
