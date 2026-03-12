// @vitest-environment node
/**
 * TDD Test Suite for Dashboard API
 *
 * Test Coverage:
 * 1. GET /children/{childId}/dashboard - リアルタイム集計データ取得
 * 2. Query parameters: start, end (期間指定)
 * 3. Default period: 過去7日間
 * 4. 集計ロジック（report-aggregator のロジック再利用）
 * 5. エラーハンドリング
 */

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

describe("Dashboard API", () => {
  const childId = "child_123";
  const userId = "user_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /children/{childId}/dashboard", () => {
    it("should return dashboard data for default period (last 7 days)", async () => {
      // Setup: Mock child ownership check
      send.mockResolvedValueOnce({
        Item: { childId, userId, displayName: "Test Child" },
      });

      // Setup: Create sample episodes
      const now = new Date();
      const episodes = [
        {
          childId,
          episodeId: "ep1",
          occurredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          type: "motor",
          severity: 2,
          ticCardId: "card1",
        },
        {
          childId,
          episodeId: "ep2",
          occurredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          type: "vocal",
          severity: 1,
          ticCardId: "card2",
        },
        {
          childId,
          episodeId: "ep3",
          occurredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          type: "motor",
          severity: 3,
          ticCardId: "card1",
        },
      ];

      // Mock episodes query
      send.mockResolvedValueOnce({ Items: episodes });

      // Mock tic cards batch get
      send.mockResolvedValueOnce({
        Responses: {
          TicCards: [
            { childId, cardId: "card1", label: "Eye blinking" },
            { childId, cardId: "card2", label: "Throat clearing" },
          ],
        },
      });

      // Execute
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("basicStats");
      expect(body).toHaveProperty("typeDistribution");
      expect(body).toHaveProperty("severityDistribution");
      expect(body).toHaveProperty("timePattern");
      expect(body).toHaveProperty("mostFrequentTics");

      // Basic stats
      expect(body.basicStats.totalEpisodes).toBe(3);
      expect(body.basicStats.recordedDays).toBe(3);

      // Type distribution
      expect(body.typeDistribution.motor).toBe(2);
      expect(body.typeDistribution.vocal).toBe(1);
      expect(body.typeDistribution.both).toBe(0);

      // Severity distribution
      expect(body.severityDistribution["1"]).toBe(1);
      expect(body.severityDistribution["2"]).toBe(1);
      expect(body.severityDistribution["3"]).toBe(1);
    });

    it("should accept custom date range via query parameters", async () => {
      // Mock child ownership check
      send.mockResolvedValueOnce({
        Item: { childId, userId, displayName: "Test Child" },
      });

      // Mock episodes query
      const episodes = [
        {
          childId,
          episodeId: "ep1",
          occurredAt: "2026-03-03T10:00:00Z",
          type: "motor",
          severity: 2,
          ticCardId: "card1",
        },
        {
          childId,
          episodeId: "ep2",
          occurredAt: "2026-03-05T14:00:00Z",
          type: "vocal",
          severity: 1,
          ticCardId: "card2",
        },
      ];

      send.mockResolvedValueOnce({ Items: episodes });

      // Mock tic cards batch get
      send.mockResolvedValueOnce({
        Responses: {
          TicCards: [
            { cardId: "card1", label: "Motor tic" },
            { cardId: "card2", label: "Vocal tic" },
          ],
        },
      });

      // Execute
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
        queryParams: {
          start: "2026-03-01",
          end: "2026-03-07",
        },
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.basicStats.totalEpisodes).toBe(2);
    });

    it("should return empty data when no episodes exist", async () => {
      // Mock child ownership check
      send.mockResolvedValueOnce({
        Item: { childId, userId, displayName: "Test Child" },
      });

      // Mock empty episodes query
      send.mockResolvedValueOnce({ Items: [] });

      // Execute
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.basicStats.totalEpisodes).toBe(0);
      expect(body.basicStats.recordedDays).toBe(0);
      expect(body.basicStats.missingDays).toBe(8); // Default period calculation
    });

    it("should validate date format", async () => {
      // Execute with invalid date format
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
        queryParams: {
          start: "invalid-date",
          end: "2026-03-07",
        },
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.detail).toContain("Invalid date format");
    });

    it("should reject if end date is before start date", async () => {
      // Execute with end < start
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
        queryParams: {
          start: "2026-03-07",
          end: "2026-03-01",
        },
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.detail).toContain("End date must be after start date");
    });

    it("should require authentication", async () => {
      // Execute without auth
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        noAuth: true, // Not authenticated
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(401);
    });

    it("should verify child ownership", async () => {
      // Mock child belongs to different user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: "different_user",
          displayName: "Test Child",
        },
      });

      // Execute
      const event = createMockEvent({
        method: "GET",
        path: `/children/${childId}/dashboard`,
        userId,
      });

      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(403);
    });
  });
});
