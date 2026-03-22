import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChildService } from "../child-service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

// Mock dependencies
vi.mock("../../lib/dynamodb.js");
vi.mock("../../lib/authorization.js");
vi.mock("../../lib/transact-delete.js");

const mockDocClient = {
  send: vi.fn(),
};

const mockGetOwnedChild = vi.fn();
const mockTransactDeleteItems = vi.fn();

vi.mocked(await import("../../lib/dynamodb.js")).docClient = mockDocClient as any;
vi.mocked(await import("../../lib/dynamodb.js")).TableNames = {
  CHILDREN: "Children",
  TIC_CARDS: "TicCards",
  EPISODES: "Episodes",
  AI_LABELS: "AILabels",
  MEDICATION_CARDS: "MedicationCards",
  MEDICATION_LOGS: "MedicationLogs",
  LIFE_EVENTS: "LifeEvents",
  USERS: "Users",
  CHECK_INS: "CheckIns",
  WEEKLY_REPORTS: "WeeklyReports",
  SHARE_TOKENS: "ShareTokens",
};
vi.mocked(await import("../../lib/authorization.js")).getOwnedChild =
  mockGetOwnedChild;
vi.mocked(await import("../../lib/transact-delete.js")).transactDeleteItems =
  mockTransactDeleteItems;

describe("ChildService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactDeleteItems.mockResolvedValue(undefined);
  });

  describe("deleteChildCascade", () => {
    const userId = "user-123";
    const childId = "child-456";

    it("should soft-delete child first, then physically delete related data", async () => {
      mockGetOwnedChild.mockResolvedValue({
        childId,
        userId,
        displayName: "Test Child",
        birthYearMonth: "2020-01",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      mockDocClient.send
        // Phase 1: Soft-delete (UpdateCommand)
        .mockResolvedValueOnce({})
        // Phase 2a: TicCards query
        .mockResolvedValueOnce({
          Items: [{ cardId: "card-1", childId }, { cardId: "card-2", childId }],
        })
        // Phase 2b: Episodes query
        .mockResolvedValueOnce({
          Items: [{ episodeId: "episode-1", childId }],
        })
        // AILabels query for episode-1
        .mockResolvedValueOnce({
          Items: [
            { episodeId: "episode-1", version: 1 },
            { episodeId: "episode-1", version: 2 },
          ],
        })
        // Phase 2c: MedicationCards query
        .mockResolvedValueOnce({
          Items: [{ medicationId: "med-1", childId }],
        })
        // MedicationLogs query for med-1
        .mockResolvedValueOnce({
          Items: [{ logId: "log-1", medicationId: "med-1" }],
        })
        // Phase 2d: LifeEvents query
        .mockResolvedValueOnce({
          Items: [{ eventId: "event-1", childId }],
        })
        // Phase 3: Child physical delete
        .mockResolvedValueOnce({});

      await ChildService.deleteChildCascade(childId, userId);

      // Verify authorization was checked
      expect(mockGetOwnedChild).toHaveBeenCalledWith(childId, userId);

      // First DynamoDB call should be soft-delete (UpdateCommand with deletedAt)
      const firstCall = mockDocClient.send.mock.calls[0][0];
      expect(firstCall.input.UpdateExpression).toContain("deletedAt");

      // Last DynamoDB call should be physical child delete
      const lastCall = mockDocClient.send.mock.calls[mockDocClient.send.mock.calls.length - 1][0];
      expect(lastCall.input.TableName).toBe("Children");
      expect(lastCall.input.Key).toEqual({ childId });

      // transactDeleteItems should have been called for each entity group
      expect(mockTransactDeleteItems).toHaveBeenCalledTimes(4);

      // TicCards batch
      expect(mockTransactDeleteItems).toHaveBeenCalledWith([
        { tableName: "TicCards", key: { cardId: "card-1" } },
        { tableName: "TicCards", key: { cardId: "card-2" } },
      ]);

      // Episodes + AILabels batch
      expect(mockTransactDeleteItems).toHaveBeenCalledWith([
        { tableName: "AILabels", key: { episodeId: "episode-1", version: 1 } },
        { tableName: "AILabels", key: { episodeId: "episode-1", version: 2 } },
        { tableName: "Episodes", key: { episodeId: "episode-1" } },
      ]);

      // Medications + Logs batch
      expect(mockTransactDeleteItems).toHaveBeenCalledWith([
        { tableName: "MedicationLogs", key: { logId: "log-1" } },
        { tableName: "MedicationCards", key: { medicationId: "med-1" } },
      ]);

      // LifeEvents batch
      expect(mockTransactDeleteItems).toHaveBeenCalledWith([
        { tableName: "LifeEvents", key: { eventId: "event-1" } },
      ]);
    });

    it("should throw ForbiddenError if user does not own the child", async () => {
      mockGetOwnedChild.mockRejectedValue(
        new ForbiddenError("Not your child"),
      );

      await expect(
        ChildService.deleteChildCascade(childId, userId),
      ).rejects.toThrow(ForbiddenError);

      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it("should throw NotFoundError if child does not exist", async () => {
      mockGetOwnedChild.mockRejectedValue(
        new NotFoundError("Child not found"),
      );

      await expect(
        ChildService.deleteChildCascade(childId, userId),
      ).rejects.toThrow(NotFoundError);

      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it("should handle empty related data gracefully", async () => {
      mockGetOwnedChild.mockResolvedValue({
        childId,
        userId,
        displayName: "Test Child",
        birthYearMonth: "2020-01",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      mockDocClient.send
        // Phase 1: Soft-delete
        .mockResolvedValueOnce({})
        // Phase 2: All queries return empty
        .mockResolvedValueOnce({ Items: [] }) // TicCards
        .mockResolvedValueOnce({ Items: [] }) // Episodes
        .mockResolvedValueOnce({ Items: [] }) // MedicationCards
        .mockResolvedValueOnce({ Items: [] }) // LifeEvents
        // Phase 3: Child physical delete
        .mockResolvedValueOnce({});

      await ChildService.deleteChildCascade(childId, userId);

      // Soft-delete + 4 queries + child physical delete = 6 DynamoDB calls
      expect(mockDocClient.send).toHaveBeenCalledTimes(6);

      // transactDeleteItems called 4 times with empty arrays
      expect(mockTransactDeleteItems).toHaveBeenCalledTimes(4);
      for (const call of mockTransactDeleteItems.mock.calls) {
        expect(call[0]).toEqual([]);
      }

      // Last call should still be child physical deletion
      const calls = mockDocClient.send.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.input.TableName).toBe("Children");
    });
  });
});
