import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/**
 * Get authenticated user ID from API Gateway authorizer context
 */
function getUserId(event: APIGatewayProxyEvent): string {
  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    throw new Error("Unauthorized: No user ID in request context");
  }
  return userId;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };

  try {
    // Handle OPTIONS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    // Extract episodeId from path
    const episodeId = event.pathParameters?.episodeId;
    if (!episodeId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "episodeId is required" }),
      };
    }

    // Get authenticated user ID
    const authenticatedUserId = getUserId(event);

    // Fetch episode from database
    const episodeResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.EPISODES_TABLE!,
        Key: {
          episodeId: { S: episodeId },
        },
      })
    );

    if (!episodeResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Episode not found" }),
      };
    }

    const childId = episodeResult.Item.childId?.S;
    const videoS3Key = episodeResult.Item.videoS3Key?.S;

    if (!childId || !videoS3Key) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Episode data is incomplete" }),
      };
    }

    // Fetch child to verify ownership
    const childResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.CHILDREN_TABLE!,
        Key: {
          childId: { S: childId },
        },
      })
    );

    if (!childResult.Item) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Child not found for episode" }),
      };
    }

    const childUserId = childResult.Item.userId?.S;
    if (childUserId !== authenticatedUserId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Access denied to this episode" }),
      };
    }

    // Parse optional videoMimeType from request body
    const body = event.body ? JSON.parse(event.body) : {};
    const videoMimeType = body.videoMimeType || "video/webm";

    // Use environment variable for bucket name (from backend.ts)
    const bucketName = process.env.MEDIA_BUCKET!;

    // Start Step Functions execution with DB values (not client input)
    const executionName = `${episodeId}-${Date.now()}`;
    const execution = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        name: executionName,
        input: JSON.stringify({
          episodeId,
          childId,
          s3Key: videoS3Key, // From DB, not from client
          bucketName,        // From env var, not from client
          videoMimeType,
        }),
      })
    );

    // Update Episodes table with analyzing status
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.EPISODES_TABLE!,
        Key: {
          episodeId: { S: episodeId },
        },
        UpdateExpression:
          "SET labelStatus = :status, executionArn = :arn, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":status": { S: "analyzing" },
          ":arn": { S: execution.executionArn! },
          ":updatedAt": { S: new Date().toISOString() },
        },
      })
    );

    // Return 202 Accepted with execution details
    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({
        episodeId,
        status: "analyzing",
        executionArn: execution.executionArn,
      }),
    };
  } catch (error) {
    console.error("Start analysis error:", error);

    // Return 401 for authentication errors
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to start analysis",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
