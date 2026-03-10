import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

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

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { childId, s3Key, bucketName, videoMimeType } = body;

    if (!childId || !s3Key || !bucketName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "childId, s3Key, and bucketName are required",
        }),
      };
    }

    // Start Step Functions execution
    const executionName = `${episodeId}-${Date.now()}`;
    const execution = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN!,
        name: executionName,
        input: JSON.stringify({
          episodeId,
          childId,
          s3Key,
          bucketName,
          videoMimeType: videoMimeType || "video/webm",
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
