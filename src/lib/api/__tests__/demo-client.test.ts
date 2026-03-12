import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { demoClient } from "../demo-client";
import { ApiError } from "../client";

describe("demoClient", () => {
  const API_ENDPOINT = "https://api.example.com";
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("GET requests", () => {
    it("should add /demo prefix to URL", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await demoClient(API_ENDPOINT, "/children");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/demo/children",
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should NOT include Authorization header", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await demoClient(API_ENDPOINT, "/children");

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });

    it("should include Content-Type header", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await demoClient(API_ENDPOINT, "/children");

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers["Content-Type"]).toBe("application/json");
    });

    it("should return parsed JSON response", async () => {
      const mockData = { id: "123", name: "Test" };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await demoClient(API_ENDPOINT, "/children");

      expect(result).toEqual(mockData);
    });

    it("should handle 204 No Content", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error("No content");
        },
      });

      const result = await demoClient(API_ENDPOINT, "/children/123");

      expect(result).toBeUndefined();
    });
  });

  describe("Mutation requests (POST/PUT/DELETE)", () => {
    it("should throw 403 error for POST requests", async () => {
      await expect(
        demoClient(API_ENDPOINT, "/children", {
          method: "POST",
          body: { name: "Test" },
        })
      ).rejects.toThrow(ApiError);

      await expect(
        demoClient(API_ENDPOINT, "/children", {
          method: "POST",
          body: { name: "Test" },
        })
      ).rejects.toMatchObject({
        status: 403,
        details: expect.objectContaining({
          type: "demo-mode-mutation",
        }),
      });
    });

    it("should throw 403 error for PUT requests", async () => {
      await expect(
        demoClient(API_ENDPOINT, "/children/123", {
          method: "PUT",
          body: { name: "Updated" },
        })
      ).rejects.toThrow(ApiError);
    });

    it("should throw 403 error for DELETE requests", async () => {
      await expect(
        demoClient(API_ENDPOINT, "/children/123", {
          method: "DELETE",
        })
      ).rejects.toThrow(ApiError);
    });

    it("should NOT call fetch for mutations", async () => {
      try {
        await demoClient(API_ENDPOINT, "/children", { method: "POST" });
      } catch (e) {
        // Expected error
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should throw ApiError when response is not ok", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          type: "not-found",
          title: "Not Found",
          status: 404,
          detail: "Resource not found",
        }),
      });

      await expect(demoClient(API_ENDPOINT, "/children/999")).rejects.toThrow(
        ApiError
      );

      await expect(
        demoClient(API_ENDPOINT, "/children/999")
      ).rejects.toMatchObject({
        status: 404,
        details: expect.objectContaining({
          type: "not-found",
        }),
      });
    });

    it("should handle malformed error responses", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(demoClient(API_ENDPOINT, "/children")).rejects.toThrow(
        ApiError
      );
    });
  });
});
