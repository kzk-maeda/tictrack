/**
 * Router Parameter Mapping Tests
 *
 * Focused tests to verify that the router correctly maps URL capture groups
 * to parameter names based on the path context.
 *
 * This prevents regressions where parameters are incorrectly assigned
 * (e.g., assigning eventId to childId, or vice versa).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "../handler";
import type { APIGatewayProxyEvent } from "aws-lambda";

// Mock all dependencies
vi.mock("@aws-sdk/lib-dynamodb");

function createMockEvent(params: {
  method: string;
  path: string;
  userId?: string;
  body?: unknown;
}): APIGatewayProxyEvent {
  return {
    httpMethod: params.method,
    path: params.path,
    body: params.body ? JSON.stringify(params.body) : null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      protocol: "HTTP/1.1",
      httpMethod: params.method,
      path: params.path,
      stage: "dev",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "test-resource",
      resourcePath: params.path,
      identity: {
        sourceIp: "127.0.0.1",
        userAgent: "test",
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
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
      authorizer: {
        claims: {
          sub: params.userId || "test-user-id",
          email: "test@example.com",
        },
      },
    },
    resource: params.path,
  } as APIGatewayProxyEvent;
}

describe("Router Parameter Mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Life Events Routes (eventId only, no childId)", () => {
    it("PUT /life-events/{eventId} should set params.eventId, not params.childId", async () => {
      const event = createMockEvent({
        method: "PUT",
        path: "/dev/life-events/event-123",
        body: { title: "Updated Event" },
      });

      const response = await handler(event);

      // Handler should receive eventId in params
      expect(event.pathParameters).toEqual({ eventId: "event-123" });
      expect(event.pathParameters).not.toHaveProperty("childId");
    });

    it("DELETE /life-events/{eventId} should set params.eventId, not params.childId", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/dev/life-events/event-456",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({ eventId: "event-456" });
      expect(event.pathParameters).not.toHaveProperty("childId");
    });
  });

  describe("Tic Cards Routes (childId + cardId)", () => {
    it("PUT /children/{childId}/tic-cards/{cardId} should set both childId and cardId", async () => {
      const event = createMockEvent({
        method: "PUT",
        path: "/dev/children/child-123/tic-cards/card-456",
        body: { symptomName: "Updated Symptom" },
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-123",
        cardId: "card-456",
      });
      expect(event.pathParameters).not.toHaveProperty("episodeId");
      expect(event.pathParameters).not.toHaveProperty("medicationId");
    });

    it("DELETE /children/{childId}/tic-cards/{cardId} should set both childId and cardId", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/dev/children/child-789/tic-cards/card-101",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-789",
        cardId: "card-101",
      });
    });
  });

  describe("Episodes Routes (childId + episodeId)", () => {
    it("DELETE /children/{childId}/episodes/{episodeId} should set both childId and episodeId", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/dev/children/child-111/episodes/episode-222",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-111",
        episodeId: "episode-222",
      });
      expect(event.pathParameters).not.toHaveProperty("cardId");
      expect(event.pathParameters).not.toHaveProperty("medicationId");
    });

    it("GET /children/{childId}/episodes/{episodeId}/ai-label should set both childId and episodeId", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/dev/children/child-333/episodes/episode-444/ai-label",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-333",
        episodeId: "episode-444",
      });
    });
  });

  describe("Medications Routes (childId + medicationId)", () => {
    it("PUT /children/{childId}/medications/{medicationId} should set both childId and medicationId", async () => {
      const event = createMockEvent({
        method: "PUT",
        path: "/dev/children/child-555/medications/med-666",
        body: { dosage: "10mg" },
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-555",
        medicationId: "med-666",
      });
      expect(event.pathParameters).not.toHaveProperty("cardId");
      expect(event.pathParameters).not.toHaveProperty("logId");
    });

    it("DELETE /children/{childId}/medications/{medicationId} should set both childId and medicationId", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/dev/children/child-777/medications/med-888",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-777",
        medicationId: "med-888",
      });
    });
  });

  describe("Medication Logs Routes (childId + logId)", () => {
    it("DELETE /children/{childId}/medication-logs/{logId} should set both childId and logId", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/dev/children/child-999/medication-logs/log-1010",
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-999",
        logId: "log-1010",
      });
      expect(event.pathParameters).not.toHaveProperty("medicationId");
      expect(event.pathParameters).not.toHaveProperty("cardId");
    });
  });

  describe("Edge Cases", () => {
    it("should not confuse /medications/ with /medication-logs/", async () => {
      const medicationEvent = createMockEvent({
        method: "PUT",
        path: "/dev/children/child-123/medications/med-456",
        body: {},
      });

      await handler(medicationEvent);
      expect(medicationEvent.pathParameters).toEqual({
        childId: "child-123",
        medicationId: "med-456",
      });
      expect(medicationEvent.pathParameters).not.toHaveProperty("logId");

      // Reset
      vi.clearAllMocks();

      const logEvent = createMockEvent({
        method: "DELETE",
        path: "/dev/children/child-789/medication-logs/log-101",
      });

      await handler(logEvent);
      expect(logEvent.pathParameters).toEqual({
        childId: "child-789",
        logId: "log-101",
      });
      expect(logEvent.pathParameters).not.toHaveProperty("medicationId");
    });

    it("should handle single-parameter routes (only childId)", async () => {
      const event = createMockEvent({
        method: "PUT",
        path: "/dev/children/child-single-123",
        body: { displayName: "Updated Name" },
      });

      const response = await handler(event);

      expect(event.pathParameters).toEqual({
        childId: "child-single-123",
      });
      expect(event.pathParameters).not.toHaveProperty("cardId");
      expect(event.pathParameters).not.toHaveProperty("episodeId");
    });
  });
});
