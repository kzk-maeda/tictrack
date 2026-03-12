import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChildService } from "../child-service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

// Mock dependencies
vi.mock("../../lib/dynamodb.js");
vi.mock("../../lib/authorization.js");

const mockDocClient = {
  send: vi.fn(),
};

const mockGetOwnedChild = vi.fn();

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

describe("ChildService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteChildCascade", () => {
    const userId = "user-123";
    const childId = "child-456";

    it("should delete child and all related data in correct order", async () => {
      // Setup: authorization passes
      mockGetOwnedChild.mockResolvedValue({
        childId,
        userId,
        displayName: "Test Child",
        birthYearMonth: "2020-01",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      });

      // Setup: mock data exists for cascade deletion
      mockDocClient.send
        // TicCards query
        .mockResolvedValueOnce({
          Items: [
            { cardId: "card-1", childId },
            { cardId: "card-2", childId },
          ],
        })
        // TicCard delete 1
        .mockResolvedValueOnce({})
        // TicCard delete 2
        .mockResolvedValueOnce({})
        // Episodes query
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
        // AILabel delete 1
        .mockResolvedValueOnce({})
        // AILabel delete 2
        .mockResolvedValueOnce({})
        // Episode delete
        .mockResolvedValueOnce({})
        // MedicationCards query
        .mockResolvedValueOnce({
          Items: [{ medicationId: "med-1", childId }],
        })
        // MedicationLogs query for med-1
        .mockResolvedValueOnce({
          Items: [{ logId: "log-1", medicationId: "med-1" }],
        })
        // MedicationLog delete
        .mockResolvedValueOnce({})
        // MedicationCard delete
        .mockResolvedValueOnce({})
        // LifeEvents query
        .mockResolvedValueOnce({
          Items: [{ eventId: "event-1", childId }],
        })
        // LifeEvent delete
        .mockResolvedValueOnce({})
        // Child delete
        .mockResolvedValueOnce({});

      await ChildService.deleteChildCascade(childId, userId);

      // Verify authorization was checked
      expect(mockGetOwnedChild).toHaveBeenCalledWith(childId, userId);

      // Verify DynamoDB calls happened in correct order
      const calls = mockDocClient.send.mock.calls;

      // Should have 15 calls total:
      // 1 TicCards query + 2 TicCard deletes
      // 1 Episodes query + 1 AILabels query + 2 AILabel deletes + 1 Episode delete
      // 1 MedicationCards query + 1 MedicationLogs query + 1 Log delete + 1 Card delete
      // 1 LifeEvents query + 1 LifeEvent delete
      // 1 Child delete
      expect(calls).toHaveLength(15);

      // Verify child was deleted last
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.input.TableName).toBe("Children");
      expect(lastCall.input.Key).toEqual({ childId });
    });

    it("should throw ForbiddenError if user does not own the child", async () => {
      mockGetOwnedChild.mockRejectedValue(
        new ForbiddenError("Not your child")
      );

      await expect(
        ChildService.deleteChildCascade(childId, userId)
      ).rejects.toThrow(ForbiddenError);

      // Should not attempt any deletions
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it("should throw NotFoundError if child does not exist", async () => {
      mockGetOwnedChild.mockRejectedValue(new NotFoundError("Child not found"));

      await expect(
        ChildService.deleteChildCascade(childId, userId)
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

      // All queries return empty results
      mockDocClient.send
        .mockResolvedValueOnce({ Items: [] }) // TicCards
        .mockResolvedValueOnce({ Items: [] }) // Episodes
        .mockResolvedValueOnce({ Items: [] }) // MedicationCards
        .mockResolvedValueOnce({ Items: [] }) // LifeEvents
        .mockResolvedValueOnce({}); // Child delete

      await ChildService.deleteChildCascade(childId, userId);

      // Should only have 5 calls (4 queries + 1 child delete)
      expect(mockDocClient.send).toHaveBeenCalledTimes(5);

      // Last call should still be child deletion
      const calls = mockDocClient.send.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.input.TableName).toBe("Children");
    });
  });
});
