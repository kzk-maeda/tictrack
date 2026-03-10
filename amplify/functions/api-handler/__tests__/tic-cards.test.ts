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
    it("creates card with symptomId (TDD #1)", async () => {
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
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_eye_blinking",
          description: "頻繁に起こる",
          severity: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.cardId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(body.type).toBe("motor");
      expect(body.complexity).toBe("simple");
      expect(body.symptomId).toBe("motor_simple_eye_blinking");
      expect(body.severity).toBe(2);
      expect(body.isActive).toBe(true);
      expect(body.createdAt).toBeDefined();
    });

    it("creates card with customSymptom", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "complex",
          customSymptom: "独特の首の動き",
          severity: 3,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.customSymptom).toBe("独特の首の動き");
      expect(body.complexity).toBe("complex");
    });

    it("creates card with legacy label for backward compatibility", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          label: "首振り",
          type: "motor",
          complexity: "simple",
          severity: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.label).toBe("首振り");
    });

    it("returns 400 for invalid type", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "invalid",
          complexity: "simple",
          symptomId: "test",
          severity: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/motor.*vocal/);
    });

    it("returns 400 for invalid complexity", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "invalid",
          symptomId: "test",
          severity: 2,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/simple.*complex/);
    });

    it("returns 400 for severity 0 (TDD #10)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "simple",
          symptomId: "test",
          severity: 0,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/between 1 and 5/);
    });

    it("returns 400 for severity 6 (now 1-5 scale)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "simple",
          symptomId: "test",
          severity: 6,
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 when missing symptom identification", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "simple",
          severity: 2,
          // No symptomId, customSymptom, or label
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.detail).toMatch(/symptomId.*customSymptom.*label/);
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

    it("handles empty label field gracefully", async () => {
      send
        .mockResolvedValueOnce({
          Item: { childId, userId: "test-user-id-123" },
        })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "POST",
        path: `/children/${childId}/tic-cards`,
        body: {
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_eye_blinking",
          severity: 2,
          label: "", // Empty label should be ignored
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.symptomId).toBe("motor_simple_eye_blinking");
      expect(body.label).toBeUndefined(); // Empty label should not be stored
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
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_head_shaking",
          severity: 2,
          isActive: true,
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
        {
          cardId: "01HXYZ0002",
          childId,
          type: "vocal",
          complexity: "simple",
          customSymptom: "咳払い",
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
      expect(body[0].symptomId).toBe("motor_simple_head_shaking");
      expect(body[0].complexity).toBe("simple");
      expect(body[1].customSymptom).toBe("咳払い");

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

    it("updates complexity and severity successfully (TDD #3)", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({
        Item: {
          cardId,
          childId,
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_eye_blinking",
          severity: 2,
          isActive: true,
        },
      });
      send.mockResolvedValueOnce({
        Attributes: {
          cardId,
          childId,
          type: "motor",
          complexity: "complex",
          symptomId: "motor_simple_eye_blinking",
          severity: 4,
          isActive: true,
        },
      });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}/tic-cards/${cardId}`,
        body: { complexity: "complex", severity: 4 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.complexity).toBe("complex");
      expect(body.severity).toBe(4);
    });

    it("updates symptomId successfully", async () => {
      send.mockResolvedValueOnce({
        Item: { childId, userId: "test-user-id-123" },
      });
      send.mockResolvedValueOnce({
        Item: {
          cardId,
          childId,
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_eye_blinking",
          severity: 2,
          isActive: true,
        },
      });
      send.mockResolvedValueOnce({
        Attributes: {
          cardId,
          childId,
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_head_shaking",
          severity: 2,
          isActive: true,
        },
      });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}/tic-cards/${cardId}`,
        body: { symptomId: "motor_simple_head_shaking" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.symptomId).toBe("motor_simple_head_shaking");
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
        Item: {
          cardId,
          childId,
          type: "motor",
          complexity: "simple",
          symptomId: "motor_simple_eye_blinking",
        },
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
