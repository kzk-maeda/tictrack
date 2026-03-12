// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDynamoDBMock } from "./helpers/dynamodb-mock.js";
import { createMockEvent } from "./helpers/event-factory.js";

// Set up environment variables for table names
process.env.USERS_TABLE = "Users";
process.env.CHILDREN_TABLE = "Children";
process.env.TIC_CARDS_TABLE = "TicCards";
process.env.MEDICATION_CARDS_TABLE = "MedicationCards";
process.env.EPISODES_TABLE = "Episodes";
process.env.MEDICATION_LOGS_TABLE = "MedicationLogs";
process.env.AI_LABELS_TABLE = "AILabels";
process.env.CHECK_INS_TABLE = "CheckIns";
process.env.WEEKLY_REPORTS_TABLE = "WeeklyReports";
process.env.SHARE_TOKENS_TABLE = "ShareTokens";
process.env.LIFE_EVENTS_TABLE = "LifeEvents";

const { send } = createDynamoDBMock();

const { handler } = await import("../handler.js");

describe("Children CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /children", () => {
    it("returns childId in ULID format (TDD #4)", async () => {
      send.mockResolvedValueOnce({}); // PutItem success

      const event = createMockEvent({
        method: "POST",
        path: "/children",
        body: { displayName: "タロウ", birthYearMonth: "2020-05" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.childId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(body.displayName).toBe("タロウ");
      expect(body.userId).toBe("test-user-id-123");
      expect(body.birthYearMonth).toBe("2020-05");
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it("returns 400 for empty displayName (TDD #10)", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/children",
        body: { displayName: "", birthYearMonth: "2020-05" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe(400);
      expect(body.detail).toMatch(/displayName/);
    });

    it("returns 400 for invalid birthYearMonth format (TDD #11)", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/children",
        body: { displayName: "タロウ", birthYearMonth: "2020/05" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe(400);
      expect(body.detail).toMatch(/birthYearMonth/);
    });

    it("returns 400 when request body is missing", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/children",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe("GET /children", () => {
    it("returns only current user's children (TDD #5)", async () => {
      const mockChildren = [
        {
          childId: "01HXYZ1234567890ABCDEFGHIJ",
          userId: "test-user-id-123",
          displayName: "タロウ",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
        {
          childId: "01HXYZ1234567890ABCDEFGHIK",
          userId: "test-user-id-123",
          displayName: "ハナコ",
          birthYearMonth: "2022-01",
          createdAt: "2026-03-02T10:00:00Z",
          updatedAt: "2026-03-02T10:00:00Z",
        },
      ];

      send.mockResolvedValueOnce({ Items: mockChildren });

      const event = createMockEvent({
        method: "GET",
        path: "/children",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(2);
      expect(body[0].displayName).toBe("タロウ");
      expect(body[1].displayName).toBe("ハナコ");

      // Verify query used userId-index GSI
      const queryCall = send.mock.calls[0][0];
      expect(queryCall.input.IndexName).toBe("userId-index");
      expect(queryCall.input.KeyConditionExpression).toContain("userId");
    });

    it("returns empty array when user has no children", async () => {
      send.mockResolvedValueOnce({ Items: [] });

      const event = createMockEvent({
        method: "GET",
        path: "/children",
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual([]);
    });
  });

  describe("PUT /children/{childId}", () => {
    const childId = "01HXYZ1234567890ABCDEFGHIJ";

    it("updates displayName successfully (TDD #6)", async () => {
      // GetItem returns existing child owned by current user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: "test-user-id-123",
          displayName: "タロウ",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
      });
      // UpdateItem success
      send.mockResolvedValueOnce({
        Attributes: {
          childId,
          userId: "test-user-id-123",
          displayName: "タロウ更新",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-06T10:00:00Z",
        },
      });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}`,
        body: { displayName: "タロウ更新" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.displayName).toBe("タロウ更新");
    });

    it("returns 403 when accessing another user's child (TDD #9)", async () => {
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: "other-user-id-456",
          displayName: "他人の子",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
      });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}`,
        body: { displayName: "乗っ取り" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.status).toBe(403);
    });

    it("returns 404 when child does not exist", async () => {
      send.mockResolvedValueOnce({ Item: undefined });

      const event = createMockEvent({
        method: "PUT",
        path: `/children/${childId}`,
        body: { displayName: "存在しない" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe("DELETE /children/{childId}", () => {
    const childId = "01HXYZ1234567890ABCDEFGHIJ";

    it("deletes child successfully (TDD #7)", async () => {
      // GetItem returns existing child owned by current user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: "test-user-id-123",
          displayName: "タロウ",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
      });
      // Query TicCards (empty)
      send.mockResolvedValueOnce({ Items: [] });
      // Query Episodes (empty)
      send.mockResolvedValueOnce({ Items: [] });
      // Query MedicationCards (empty)
      send.mockResolvedValueOnce({ Items: [] });
      // Query LifeEvents (empty)
      send.mockResolvedValueOnce({ Items: [] });
      // DeleteItem for child
      send.mockResolvedValueOnce({});

      const event = createMockEvent({
        method: "DELETE",
        path: `/children/${childId}`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });

    it("returns 403 when deleting another user's child", async () => {
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: "other-user-id-456",
          displayName: "他人の子",
          birthYearMonth: "2020-05",
          createdAt: "2026-03-01T10:00:00Z",
          updatedAt: "2026-03-01T10:00:00Z",
        },
      });

      const event = createMockEvent({
        method: "DELETE",
        path: `/children/${childId}`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });

    it("returns 404 when child does not exist", async () => {
      send.mockResolvedValueOnce({ Item: undefined });

      const event = createMockEvent({
        method: "DELETE",
        path: `/children/${childId}`,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });
});
