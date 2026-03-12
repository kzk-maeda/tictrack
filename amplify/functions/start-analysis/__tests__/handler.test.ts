// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

// Mock AWS SDK clients
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: class MockSFNClient {
    send = mockSend;
  },
  StartExecutionCommand: class MockStartExecutionCommand {
    constructor(public input: any) {}
  },
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class MockDynamoDBClient {
    send = mockSend;
  },
  UpdateItemCommand: class MockUpdateItemCommand {
    constructor(public input: any) {}
  },
  GetItemCommand: class MockGetItemCommand {
    constructor(public input: any) {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: mockSend }),
  },
  GetCommand: class MockGetCommand {
    constructor(public input: any) {}
  },
}));

// Set up environment variables
process.env.STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789012:stateMachine:test";
process.env.EPISODES_TABLE = "Episodes";
process.env.CHILDREN_TABLE = "Children";
process.env.MEDIA_BUCKET = "test-media-bucket";

const { handler } = await import("../handler.js");

function createMockEvent(
  episodeId: string,
  userId: string = "user-123",
  body?: unknown,
): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: `/episodes/${episodeId}/analyze`,
    pathParameters: { episodeId },
    body: body ? JSON.stringify(body) : null,
    headers: {},
    requestContext: {
      authorizer: {
        claims: {
          sub: userId,
          email: "test@example.com",
        },
      },
      accountId: "123456789012",
      apiId: "test-api",
      protocol: "HTTP/1.1",
      httpMethod: "POST",
      path: `/episodes/${episodeId}/analyze`,
      stage: "dev",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "test-resource-id",
      resourcePath: "/episodes/{episodeId}/analyze",
      identity: {} as never,
    },
    resource: "/episodes/{episodeId}/analyze",
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    queryStringParameters: null,
    stageVariables: null,
  };
}

describe("start-analysis Lambda - IDOR Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TDD #1: Ownership verification (RED)", () => {
    it("should return 403 when accessing another user's episode", async () => {
      const episodeId = "episode-123";
      const attackerUserId = "attacker-456";

      // Mock: Episode exists in DB
      mockSend.mockResolvedValueOnce({
        Item: {
          episodeId: { S: episodeId },
          childId: { S: "child-789" },
          videoS3Key: { S: "videos/episode-123.webm" },
        },
      });

      // Mock: Child belongs to different user
      mockSend.mockResolvedValueOnce({
        Item: {
          childId: { S: "child-789" },
          userId: { S: "victim-999" }, // Different from attacker
        },
      });

      const event = createMockEvent(episodeId, attackerUserId, {
        // Attacker tries to inject their own values
        childId: "attacker-child-123",
        s3Key: "malicious/path.webm",
        bucketName: "attacker-bucket",
      });

      const result = await handler(event);

      // Should reject with 403
      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toHaveProperty("error");
      expect(JSON.parse(result.body).error).toContain("Access denied");
    });

    it("should return 404 when episode does not exist", async () => {
      const episodeId = "nonexistent-episode";

      // Mock: Episode not found in DB
      mockSend.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = createMockEvent(episodeId, "user-123", {
        childId: "child-123",
        s3Key: "videos/episode.webm",
        bucketName: "media-bucket",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toHaveProperty("error");
      expect(JSON.parse(result.body).error).toContain("Episode not found");
    });
  });

  describe("TDD #2: Use DB values instead of client input (RED)", () => {
    it("should ignore client-provided s3Key and use DB value", async () => {
      const episodeId = "episode-123";
      const userId = "user-123";
      const realS3Key = "videos/real-episode-123.webm";
      const clientProvidedS3Key = "videos/fake-path.webm";

      // Mock: Episode exists
      mockSend.mockResolvedValueOnce({
        Item: {
          episodeId: { S: episodeId },
          childId: { S: "child-789" },
          videoS3Key: { S: realS3Key },
        },
      });

      // Mock: Child belongs to authenticated user
      mockSend.mockResolvedValueOnce({
        Item: {
          childId: { S: "child-789" },
          userId: { S: userId },
        },
      });

      // Mock: Step Functions start
      mockSend.mockResolvedValueOnce({
        executionArn: "arn:aws:states:us-east-1:123456789012:execution:test:exec-123",
      });

      // Mock: DynamoDB update
      mockSend.mockResolvedValueOnce({});

      const event = createMockEvent(episodeId, userId, {
        // Client tries to provide fake s3Key
        childId: "ignored-child",
        s3Key: clientProvidedS3Key,
        bucketName: "ignored-bucket",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(202);

      // Verify Step Functions was called with DB values, not client values
      const sfnCall = mockSend.mock.calls.find(
        (call) => call[0].input?.stateMachineArn
      );
      expect(sfnCall).toBeDefined();
      if (!sfnCall) throw new Error("Step Functions call not found");

      const sfnInput = JSON.parse(sfnCall[0].input.input);
      expect(sfnInput.s3Key).toBe(realS3Key); // From DB
      expect(sfnInput.s3Key).not.toBe(clientProvidedS3Key); // NOT from client
      expect(sfnInput.bucketName).toBe("test-media-bucket"); // From env var
    });
  });

  describe("TDD #3: Successful analysis start", () => {
    it("should start analysis successfully for owned episode", async () => {
      const episodeId = "episode-123";
      const userId = "user-123";
      const childId = "child-789";
      const s3Key = "videos/episode-123.webm";

      // Mock: Episode exists
      mockSend.mockResolvedValueOnce({
        Item: {
          episodeId: { S: episodeId },
          childId: { S: childId },
          videoS3Key: { S: s3Key },
        },
      });

      // Mock: Child belongs to user
      mockSend.mockResolvedValueOnce({
        Item: {
          childId: { S: childId },
          userId: { S: userId },
        },
      });

      // Mock: Step Functions start
      mockSend.mockResolvedValueOnce({
        executionArn: "arn:aws:states:us-east-1:123456789012:execution:test:exec-123",
      });

      // Mock: DynamoDB update
      mockSend.mockResolvedValueOnce({});

      const event = createMockEvent(episodeId, userId, {});

      const result = await handler(event);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.episodeId).toBe(episodeId);
      expect(body.status).toBe("analyzing");
      expect(body.executionArn).toBeDefined();
    });
  });
});
