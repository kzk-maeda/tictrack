import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "../handler";
import type { APIGatewayProxyEvent } from "aws-lambda";

// Mock AWS SDK
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  QueryCommand: vi.fn(),
  GetCommand: vi.fn(),
  PutCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  BatchGetCommand: vi.fn(),
}));

// Mock environment variables
process.env.CHILDREN_TABLE = "Children";
process.env.EPISODES_TABLE = "Episodes";
process.env.TIC_CARDS_TABLE = "TicCards";
process.env.MEDICATION_CARDS_TABLE = "MedicationCards";
process.env.MEDICATION_LOGS_TABLE = "MedicationLogs";
process.env.LIFE_EVENTS_TABLE = "LifeEvents";
process.env.AI_LABELS_TABLE = "AILabels";
process.env.DEMO_USER_ID = "demo-user-123";

/**
 * Helper: Create mock API Gateway event
 */
function createMockEvent(
  method: string,
  path: string,
  body?: unknown
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path: `/dev${path}`,
    headers: {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    queryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      protocol: "HTTP/1.1",
      httpMethod: method,
      path: `/dev${path}`,
      stage: "dev",
      requestId: "test-request-id",
      requestTime: "01/Jan/2026:00:00:00 +0000",
      requestTimeEpoch: 1704067200000,
      identity: {
        sourceIp: "127.0.0.1",
        userAgent: "test-agent",
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        accessKey: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
        clientCert: null,
      },
      authorizer: null,
      resourceId: "test-resource",
      resourcePath: path,
    },
    resource: path,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
  };
}

describe("Demo API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /demo/children", () => {
    it("should return demo user's children without authentication", async () => {
      const { docClient } = await import("../lib/dynamodb.js");
      const mockSend = vi.fn().mockResolvedValue({
        Items: [
          {
            childId: "child-123",
            userId: "demo-user-123",
            displayName: "Adam",
            birthYearMonth: "2018-04",
          },
        ],
      });
      vi.spyOn(docClient, "send").mockImplementation(mockSend);

      const event = createMockEvent("GET", "/demo/children");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].displayName).toBe("Adam");
    });

    it("should use DEMO_USER_ID from environment", async () => {
      const { docClient } = await import("../lib/dynamodb.js");
      const mockSend = vi.fn().mockResolvedValue({
        Items: [],
      });
      vi.spyOn(docClient, "send").mockImplementation(mockSend);

      const event = createMockEvent("GET", "/demo/children");
      const response = await handler(event);

      // Should succeed (using demo user ID from environment)
      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe("GET /demo/children/:childId/episodes", () => {
    it("should return demo child's episodes", async () => {
      const { docClient } = await import("../lib/dynamodb.js");
      const mockSend = vi
        .fn()
        // First call: verifyChildOwnership - get child
        .mockResolvedValueOnce({
          Item: {
            childId: "child-123",
            userId: "demo-user-123",
            displayName: "Adam",
          },
        })
        // Second call: query episodes
        .mockResolvedValueOnce({
          Items: [
            {
              episodeId: "episode-123",
              childId: "child-123",
              recordType: "quick_log",
              occurredAt: "2026-02-15T19:30:00Z",
            },
          ],
        });
      vi.spyOn(docClient, "send").mockImplementation(mockSend);

      const event = createMockEvent("GET", "/demo/children/child-123/episodes");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].episodeId).toBe("episode-123");
    });
  });

  describe("GET /demo/children/:childId/dashboard", () => {
    it("should return demo dashboard data", async () => {
      const { docClient } = await import("../lib/dynamodb.js");
      const mockSend = vi
        .fn()
        // First call: verifyChildOwnership - get child
        .mockResolvedValueOnce({
          Item: {
            childId: "child-123",
            userId: "demo-user-123",
            displayName: "Adam",
          },
        })
        // Second call: query episodes
        .mockResolvedValueOnce({
          Items: [
            {
              episodeId: "episode-123",
              childId: "child-123",
              recordType: "quick_log",
              occurredAt: "2026-02-15T19:30:00Z",
              type: "motor",
              severity: 2,
              ticCardId: "card-123",
            },
          ],
        })
        // Third call: batchGet tic cards
        .mockResolvedValueOnce({
          Responses: {
            TicCards: [
              {
                cardId: "card-123",
                childId: "child-123",
                type: "motor",
                label: "Eye blinking",
              },
            ],
          },
        });
      vi.spyOn(docClient, "send").mockImplementation(mockSend);

      const event = createMockEvent("GET", "/demo/children/child-123/dashboard");
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("basicStats");
      expect(body.basicStats.totalEpisodes).toBe(1);
    });
  });

  describe("Demo API - Mutation Rejection", () => {
    it("should reject POST requests with 403", async () => {
      const event = createMockEvent("POST", "/demo/children", {
        displayName: "Test",
        birthYearMonth: "2020-01",
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.detail).toContain("not allowed");
    });

    it("should reject PUT requests with 403", async () => {
      const event = createMockEvent("PUT", "/demo/children/child-123", {
        displayName: "Updated",
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.detail).toContain("not allowed");
    });

    it("should reject DELETE requests with 403", async () => {
      const event = createMockEvent("DELETE", "/demo/children/child-123");
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.detail).toContain("not allowed");
    });
  });

  describe("Demo User ID Validation", () => {
    it("should return 500 if DEMO_USER_ID is not set", async () => {
      const originalDemoUserId = process.env.DEMO_USER_ID;
      delete process.env.DEMO_USER_ID;

      const event = createMockEvent("GET", "/demo/children");
      const response = await handler(event);

      // Should fail with 500 error when DEMO_USER_ID is not configured
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Internal Server Error");

      process.env.DEMO_USER_ID = originalDemoUserId;
    });
  });
});
