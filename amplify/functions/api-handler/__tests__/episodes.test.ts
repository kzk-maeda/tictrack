// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDynamoDBMock } from "./helpers/dynamodb-mock.js";
import { createMockEvent } from "./helpers/event-factory.js";

const { send } = createDynamoDBMock();

const { handler } = await import("../handler.js");

describe("Episodes", () => {
  const childId = "01HXYZ1234567890ABCDEFGHIJ";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /children/{childId}/episodes", () => {
    it("creates quick_log episode with ULID episodeId and ISO occurredAt (TDD #5, #6)", async () => {
      // GetItem: Check child ownership
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      // GetItem: Verify tic card belongs to this child
      send.mockResolvedValueOnce({
        Item: { cardId: "01HXYZ0001", childId },
      });
      // PutItem: Create episode
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/episodes`,
        body: {
          recordType: "quick_log",
          ticCardId: "01HXYZ0001",
          occurredAt: "2026-03-06T14:30:00Z",
          context: "homework",
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.episodeId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(body.childId).toBe(childId);
      expect(body.recordType).toBe("quick_log");
      expect(body.ticCardId).toBe("01HXYZ0001");
      expect(body.occurredAt).toBe("2026-03-06T14:30:00Z");
      expect(body.labelStatus).toBe("confirmed");
      expect(body.createdAt).toBeDefined();
    });

    it("returns 400 for invalid occurredAt format", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/episodes`,
        body: {
          recordType: "quick_log",
          occurredAt: "2026-03-06",
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/ISO 8601/);
    });

    it("returns 403 when accessing another user's child", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "other-user-id-456" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/episodes`,
        body: {
          recordType: "quick_log",
          occurredAt: "2026-03-06T14:30:00Z",
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });
  });

  describe("GET /children/{childId}/episodes", () => {
    it("returns episodes in occurredAt order with date range filter (TDD #7)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const mockEpisodes = [
        {
          episodeId: "01HXYZ0001",
          childId,
          recordType: "quick_log",
          ticCardId: "card1",
          occurredAt: "2026-03-06T14:30:00Z",
          labelStatus: "confirmed",
        },
        {
          episodeId: "01HXYZ0002",
          childId,
          recordType: "quick_log",
          ticCardId: "card2",
          occurredAt: "2026-03-05T10:00:00Z",
          labelStatus: "confirmed",
        },
      ];

      send.mockResolvedValueOnce({ Items: mockEpisodes });

      const event = {
        ...createMockEvent({
          method: "GET",
          path: `/children/${childId}/episodes`,
        }),
        queryStringParameters: {
          from: "2026-03-05T00:00:00Z",
          to: "2026-03-07T00:00:00Z",
        },
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(2);
      expect(body[0].episodeId).toBe("01HXYZ0001");

      const queryCall = send.mock.calls[1][0];
      expect(queryCall.input.IndexName).toBe("childId-occurredAt-index");
      expect(queryCall.input.KeyConditionExpression).toContain("occurredAt");
      expect(queryCall.input.KeyConditionExpression).toContain("BETWEEN");
    });

    it("returns empty array when child has no episodes", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({ Items: [] });

      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/episodes`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual([]);
    });
  });

  describe("Cross-child isolation (TDD #9)", () => {
    it("prevents tic card from child A being used in episode for child B", async () => {
      const childIdA = "01HXYZA";
      const childIdB = "01HXYZB";
      const ticCardFromA = "01HXYZ_CARD_A";

      send.mockResolvedValueOnce({
        Item: { childId: childIdB, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({
        Item: { cardId: ticCardFromA, childId: childIdA },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childIdB}/episodes`,
        body: {
          recordType: "quick_log",
          ticCardId: ticCardFromA,
          occurredAt: "2026-03-06T14:30:00Z",
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.status).toBe(403);
    });
  });
});
