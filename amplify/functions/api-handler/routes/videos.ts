import type { APIGatewayProxyEvent } from "aws-lambda";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { docClient } from "../lib/dynamodb.js";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ok } from "../lib/response.js";
import { getUserId } from "../lib/auth.js";
import type { RouteResult } from "../types.js";

const s3Client = new S3Client({});
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET!;
const EPISODES_TABLE = process.env.EPISODES_TABLE!;

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function handleVideoUploadUrl(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  try {
    console.log("handleVideoUploadUrl called", {
      pathParameters: event.pathParameters,
      body: event.body,
      env: {
        MEDIA_BUCKET,
        EPISODES_TABLE
      }
    });

    const userId = getUserId(event);
    const { childId, episodeId } = event.pathParameters || {};
    const body = JSON.parse(event.body || "{}");
    const { contentType, fileSize } = body;

    console.log("Parsed request", { userId, childId, episodeId, contentType, fileSize });

    // Validation
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new Error(
        `Invalid Content Type: Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(
        `File Too Large: File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Verify episode exists and belongs to user
    console.log("Checking episode exists", { episodeId, childId });
    const getResult = await docClient.send(
      new GetCommand({
        TableName: EPISODES_TABLE,
        Key: { episodeId },
      }),
    );

    if (!getResult.Item) {
      console.log("Episode not found");
      throw new Error("Episode Not Found: Episode not found");
    }

    console.log("Episode found", getResult.Item);

    // Generate S3 key
    const timestamp = Date.now();
    const extension = contentType === "video/mp4" ? "mp4" : "webm";
    const s3Key = `videos/${userId}/${childId}/${episodeId}/${timestamp}.${extension}`;

    console.log("Generating presigned URL", { s3Key, bucket: MEDIA_BUCKET });

    // Generate presigned URL for upload (PUT)
    const putCommand = new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 }); // 5 minutes

    console.log("Presigned URL generated successfully");

    return ok({ url, s3Key });
  } catch (error) {
    console.error("Error in handleVideoUploadUrl", error);
    throw error;
  }
}

export async function handleVideoUploadComplete(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const { childId, episodeId } = event.pathParameters || {};
  const body = JSON.parse(event.body || "{}");
  const { s3Key, mimeType, fileSize, duration } = body;

  // Verify episode exists
  const getResult = await docClient.send(
    new GetCommand({
      TableName: EPISODES_TABLE,
      Key: { episodeId },
    }),
  );

  if (!getResult.Item) {
    throw new Error("Episode Not Found: Episode not found");
  }

  // Update episode with video metadata
  const updateResult = await docClient.send(
    new UpdateCommand({
      TableName: EPISODES_TABLE,
      Key: { episodeId },
      UpdateExpression:
        "SET videoS3Key = :s3Key, videoMimeType = :mimeType, videoFileSize = :fileSize, videoDuration = :duration, uploadStatus = :status, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":s3Key": s3Key,
        ":mimeType": mimeType,
        ":fileSize": fileSize,
        ":duration": duration,
        ":status": "completed",
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return ok(updateResult.Attributes);
}

export async function handleVideoPlaybackUrl(
  event: APIGatewayProxyEvent,
): Promise<RouteResult> {
  const { childId, episodeId } = event.pathParameters || {};

  // Get episode with video metadata
  const getResult = await docClient.send(
    new GetCommand({
      TableName: EPISODES_TABLE,
      Key: { episodeId },
    }),
  );

  if (!getResult.Item || !getResult.Item.videoS3Key) {
    throw new Error("Video Not Found: Video not found");
  }

  // Generate presigned URL for playback (GET)
  const getCommand = new GetObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: getResult.Item.videoS3Key,
  });

  const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }); // 60 minutes

  return ok({ url });
}
