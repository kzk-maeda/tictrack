// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDynamoDBMock } from "./helpers/dynamodb-mock.js";
import { createMockEvent } from "./helpers/event-factory.js";

const { send } = createDynamoDBMock();

const { handler } = await import("../handler.js");

describe("TicCards CRUD", () => {
  const childId = "01HXYZ1234567890ABCDEFGHIJ";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /children/{childId}/tic-cards", () => {
    it("returns cardId in ULID format with label, type, severity (TDD #1)", async () => {
      // GetItem: Check child ownership
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      // PutItem: Create tic card
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          label: "首振り",
          type: "motor",
          description: "左右に首を振る動作",
          severity: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.cardId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(body.label).toBe("首振り");
      expect(body.type).toBe("motor");
      expect(body.severity).toBe(2);
      expect(body.isActive).toBe(true);
      expect(body.createdAt).toBeDefined();
    });

    it("returns 400 for invalid type", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: { label: "test", type: "invalid", severity: 2 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/motor.*vocal/);
    });

    it("returns 400 for severity 0 (TDD #10)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: { label: "test", type: "motor", severity: 0 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/1, 2, or 3/);
    });

    it("returns 400 for severity 4 (TDD #10)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: { label: "test", type: "motor", severity: 4 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it("returns 403 when accessing another user's child", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "other-user-id-456" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: { label: "test", type: "motor", severity: 2 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });
  });

  describe("GET /children/{childId}/tic-cards", () => {
    it("returns only specified child's tic cards (TDD #2)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const mockCards = [
        {
          cardId: "01HXYZ0001",
          childId,
          label: "首振り",
          type: "motor",
          severity: 2,
          isActive: true,
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
        {
          cardId: "01HXYZ0002",
          childId,
          label: "咳払い",
          type: "vocal",
          severity: 1,
          isActive: true,
          createdAt: "2026-03-02T10:00:00Z",
          updatedAt: "2026-03-02T10:00:00Z",
        },
      ];

      send.mockResolvedValueOnce({ Items: mockCards });

      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/tic-cards`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(2);
      expect(body[0].label).toBe("首振り");
      expect(body[1].label).toBe("咳払い");

      const queryCall = send.mock.calls[1][0];
      expect(queryCall.input.IndexName).toBe("childId-index");
    });

    it("returns empty array when child has no tic cards", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({ Items: [] });

      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/tic-cards`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual([]);
    });
  });

  describe("PUT /children/{childId}/tic-cards/{cardId}", () => {
    const cardId = "01HXYZ0001";

    it("updates label and severity successfully (TDD #3)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({
        Item: {
          cardId,
          childId,
          label: "首振り",
          type: "motor",
          severity: 2,
          isActive: true,
        },
      });
      send.mockResolvedValueOnce({
        Attributes: {
          cardId,
          childId,
          label: "首振り更新",
          type: "motor",
          severity: 3,
          isActive: true,
        },
      });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}/tic-cards/${cardId}`,
        body: { label: "首振り更新", severity: 3 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.label).toBe("首振り更新");
      expect(body.severity).toBe(3);
    });

    it("returns 404 when card does not exist", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({ Item: undefined });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}/tic-cards/${cardId}`,
        body: { label: "updated" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe("DELETE /children/{childId}/tic-cards/{cardId}", () => {
    const cardId = "01HXYZ0001";

    it("deletes tic card successfully (TDD #4)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({
        Item: { cardId, childId, label: "首振り" },
      });
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "DELETE",
        path: `/children/${childId}/tic-cards/${cardId}`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });

    it("returns 404 when card does not exist", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({ Item: undefined });

      const event = createMockEvent({
        method: "DELETE",
        path: `/children/${childId}/tic-cards/${cardId}`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });
});
