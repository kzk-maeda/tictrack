// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDynamoDBMock } from "../../__tests__/helpers/dynamodb-mock.js";

const { send } = createDynamoDBMock();

// Mock environment variable
process.env.CHILDREN_TABLE = "Children";

const { verifyChildOwnership, getOwnedChild } = await import("../authorization.js");

describe("Authorization Module", () => {
  const userId = "user-123";
  const childId = "child-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyChildOwnership", () => {
    it("should pass when child belongs to user", async () => {
      // Mock: Child exists and belongs to user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId,
          displayName: "Test Child",
        },
      });

      // Should not throw
      await expect(verifyChildOwnership(childId, userId)).resolves.toBeUndefined();
    });

    it("should throw NotFoundError when child does not exist", async () => {
      // Mock: Child not found
      send.mockResolvedValueOnce({
        Item: undefined,
      });

      await expect(verifyChildOwnership(childId, userId)).rejects.toThrow("Child not found");
    });

    it("should throw ForbiddenError when child belongs to different user", async () => {
      const differentUserId = "different-user-999";

      // Mock: Child exists but belongs to different user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: differentUserId,
          displayName: "Test Child",
        },
      });

      await expect(verifyChildOwnership(childId, userId)).rejects.toThrow(
        "Access denied to this child"
      );
    });

    it("should throw ForbiddenError with 403 status code", async () => {
      const differentUserId = "different-user-999";

      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: differentUserId,
          displayName: "Test Child",
        },
      });

      try {
        await verifyChildOwnership(childId, userId);
        expect.fail("Should have thrown ForbiddenError");
      } catch (error: any) {
        expect(error.statusCode).toBe(403);
      }
    });

    it("should throw NotFoundError with 404 status code", async () => {
      send.mockResolvedValueOnce({
        Item: undefined,
      });

      try {
        await verifyChildOwnership(childId, userId);
        expect.fail("Should have thrown NotFoundError");
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe("getOwnedChild", () => {
    it("should return child when it belongs to user", async () => {
      const mockChild = {
        childId,
        userId,
        displayName: "Test Child",
        birthYear: 2020,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // Mock: Child exists and belongs to user
      send.mockResolvedValueOnce({
        Item: mockChild,
      });

      const result = await getOwnedChild(childId, userId);

      expect(result).toEqual(mockChild);
      expect(result.childId).toBe(childId);
      expect(result.userId).toBe(userId);
      expect(result.displayName).toBe("Test Child");
    });

    it("should throw NotFoundError when child does not exist", async () => {
      // Mock: Child not found
      send.mockResolvedValueOnce({
        Item: undefined,
      });

      await expect(getOwnedChild(childId, userId)).rejects.toThrow("Child not found");
    });

    it("should throw ForbiddenError when child belongs to different user", async () => {
      const differentUserId = "different-user-999";

      // Mock: Child exists but belongs to different user
      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: differentUserId,
          displayName: "Test Child",
        },
      });

      await expect(getOwnedChild(childId, userId)).rejects.toThrow(
        "Access denied to this child"
      );
    });

    it("should throw ForbiddenError with 403 status code", async () => {
      const differentUserId = "different-user-999";

      send.mockResolvedValueOnce({
        Item: {
          childId,
          userId: differentUserId,
          displayName: "Test Child",
        },
      });

      try {
        await getOwnedChild(childId, userId);
        expect.fail("Should have thrown ForbiddenError");
      } catch (error: any) {
        expect(error.statusCode).toBe(403);
      }
    });

    it("should throw NotFoundError with 404 status code", async () => {
      send.mockResolvedValueOnce({
        Item: undefined,
      });

      try {
        await getOwnedChild(childId, userId);
        expect.fail("Should have thrown NotFoundError");
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
      }
    });
  });
});
