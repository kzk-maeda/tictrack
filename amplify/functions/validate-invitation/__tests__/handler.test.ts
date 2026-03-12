import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PreSignUpTriggerEvent, Context } from "aws-lambda";

// Create mock functions
const mockSend = vi.fn();

// Mock Context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "validate-invitation",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:validate-invitation",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/validate-invitation",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Mock AWS SDK
vi.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: class {
      constructor() {
        return {};
      }
    },
  };
});

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  GetCommand: class {
    constructor(public params: unknown) {}
  },
  UpdateCommand: class {
    constructor(public params: unknown) {}
  },
}));

// Import handler after mocks are set up
const { handler } = await import("../handler");

describe("validate-invitation Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVITATIONS_TABLE = "Invitations";
  });

  const createEvent = (
    email: string,
    invitationCode?: string
  ): PreSignUpTriggerEvent => ({
    version: "1",
    region: "us-east-1",
    userPoolId: "us-east-1_TEST",
    userName: "test-user",
    callerContext: {
      awsSdkVersion: "3.0.0",
      clientId: "test-client",
    },
    triggerSource: "PreSignUp_SignUp",
    request: {
      userAttributes: {
        email,
      },
      validationData: invitationCode
        ? { invitationCode }
        : undefined,
    },
    response: {
      autoConfirmUser: false,
      autoVerifyEmail: false,
      autoVerifyPhone: false,
    },
  });

  describe("Valid invitation", () => {
    it("should allow signup with valid invitation code", async () => {
      const event = createEvent("test@example.com", "VALID123");

      // Mock DynamoDB GetCommand response
      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "VALID123",
          email: "test@example.com",
          used: false,
          createdAt: "2026-03-10T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
      });

      // Mock DynamoDB UpdateCommand response
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event, mockContext, () => {});

      expect(result).toEqual(event);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("should allow signup when email matches invitation", async () => {
      const event = createEvent("specific@example.com", "INVITE456");

      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "INVITE456",
          email: "specific@example.com",
          used: false,
          createdAt: "2026-03-10T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
      });

      mockSend.mockResolvedValueOnce({});

      const result = await handler(event, mockContext, () => {});

      expect(result).toEqual(event);
    });

    it("should allow signup when invitation has no email restriction", async () => {
      const event = createEvent("any@example.com", "OPEN789");

      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "OPEN789",
          // No email field = open invitation
          used: false,
          createdAt: "2026-03-10T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
      });

      mockSend.mockResolvedValueOnce({});

      const result = await handler(event, mockContext, () => {});

      expect(result).toEqual(event);
    });
  });

  describe("Invalid invitation", () => {
    it("should reject signup when invitation code is missing", async () => {
      const event = createEvent("test@example.com");

      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "Invitation code is required"
      );

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should reject signup when invitation code does not exist", async () => {
      const event = createEvent("test@example.com", "NOTFOUND");

      mockSend.mockResolvedValueOnce({
        // No Item returned
      });

      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "Invalid invitation code"
      );
    });

    it("should reject signup when invitation is already used", async () => {
      const event = createEvent("test@example.com", "USED123");

      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "USED123",
          email: "test@example.com",
          used: true,
          usedBy: "another-user",
          usedAt: "2026-03-01T00:00:00Z",
          createdAt: "2026-02-10T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
      });

      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "Invitation code has already been used"
      );
    });

    it("should reject signup when invitation is expired", async () => {
      const event = createEvent("test@example.com", "EXPIRED123");

      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "EXPIRED123",
          email: "test@example.com",
          used: false,
          createdAt: "2025-01-01T00:00:00Z",
          expiresAt: "2025-12-31T23:59:59Z", // Past date
        },
      });

      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "Invitation code has expired"
      );
    });

    it("should reject signup when email does not match invitation", async () => {
      const event = createEvent("wrong@example.com", "SPECIFIC123");

      mockSend.mockResolvedValueOnce({
        Item: {
          invitationCode: "SPECIFIC123",
          email: "correct@example.com",
          used: false,
          createdAt: "2026-03-10T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
      });

      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "This invitation is for a different email address"
      );
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors gracefully", async () => {
      const event = createEvent("test@example.com", "ERROR123");

      mockSend.mockRejectedValueOnce(
        new Error("DynamoDB connection error")
      );

      // Handler re-throws original error for better debugging
      await expect(handler(event, mockContext, () => {})).rejects.toThrow(
        "DynamoDB connection error"
      );
    });
  });
});
