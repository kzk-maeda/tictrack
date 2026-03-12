import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { client, ApiError } from "../client";

// Mock aws-amplify/auth
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn(),
}));

import { fetchAuthSession } from "aws-amplify/auth";

describe("client", () => {
  const API_ENDPOINT = "https://api.example.com";
  const originalFetch = global.fetch;
  const mockToken = "mock-jwt-token";

  beforeEach(() => {
    global.fetch = vi.fn();
    (fetchAuthSession as any).mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => mockToken,
        },
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should include Authorization header with token", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await client(API_ENDPOINT, "/children");

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBe(mockToken);
    });

    it("should fetch auth session before making request", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await client(API_ENDPOINT, "/children");

      expect(fetchAuthSession).toHaveBeenCalled();
    });

    it("should throw error when not authenticated", async () => {
      (fetchAuthSession as any).mockResolvedValue({
        tokens: null,
      });

      await expect(client(API_ENDPOINT, "/children")).rejects.toThrow(
        "Not authenticated"
      );
    });
  });

  describe("Request construction", () => {
    it("should NOT add /demo prefix to URL", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await client(API_ENDPOINT, "/children");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/children",
        expect.any(Object)
      );
    });

    it("should include Content-Type header", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await client(API_ENDPOINT, "/children");

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.headers["Content-Type"]).toBe("application/json");
    });

    it("should use GET method by default", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await client(API_ENDPOINT, "/children");

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.method).toBe("GET");
    });

    it("should support POST requests with body", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "123" }),
      });

      const body = { name: "Test" };
      await client(API_ENDPOINT, "/children", { method: "POST", body });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.method).toBe("POST");
      expect(callArgs.body).toBe(JSON.stringify(body));
    });

    it("should support PUT requests", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "123", name: "Updated" }),
      });

      await client(API_ENDPOINT, "/children/123", {
        method: "PUT",
        body: { name: "Updated" },
      });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.method).toBe("PUT");
    });

    it("should support DELETE requests", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 204,
      });

      await client(API_ENDPOINT, "/children/123", { method: "DELETE" });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      expect(callArgs.method).toBe("DELETE");
    });
  });

  describe("Response handling", () => {
    it("should return parsed JSON response", async () => {
      const mockData = { id: "123", name: "Test" };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await client(API_ENDPOINT, "/children");

      expect(result).toEqual(mockData);
    });

    it("should handle 204 No Content", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await client(API_ENDPOINT, "/children/123", {
        method: "DELETE",
      });

      expect(result).toBeUndefined();
    });

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

      await expect(client(API_ENDPOINT, "/children/999")).rejects.toThrow(
        ApiError
      );

      await expect(client(API_ENDPOINT, "/children/999")).rejects.toMatchObject(
        {
          status: 404,
          details: expect.objectContaining({
            type: "not-found",
          }),
        }
      );
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

      await expect(client(API_ENDPOINT, "/children")).rejects.toThrow(ApiError);

      await expect(client(API_ENDPOINT, "/children")).rejects.toMatchObject({
        status: 500,
        details: expect.objectContaining({
          type: "unknown",
          detail: "Internal Server Error",
        }),
      });
    });
  });
});
