import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Amplify auth
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => "mock-auth-token",
      },
    },
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Import after mocks are set up
import { apiClient } from "../api";

describe("API Client - Demo Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      headers: new Headers(),
    });
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe("Demo mode detection", () => {
    it("should use /demo prefix when isDemoMode is true", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await apiClient("/children");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/demo/children"),
        expect.any(Object)
      );
    });

    it("should not use /demo prefix when isDemoMode is false", async () => {
      mockLocalStorage.setItem("isDemoMode", "false");

      await apiClient("/children");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining("/demo/children"),
        expect.any(Object)
      );
    });

    it("should not use /demo prefix when isDemoMode is not set", async () => {
      await apiClient("/children");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining("/demo/children"),
        expect.any(Object)
      );
    });
  });

  describe("Demo mode authentication", () => {
    it("should not include Authorization header in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await apiClient("/children");

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1]?.headers || {};
      expect(headers).not.toHaveProperty("Authorization");
    });
  });

  describe("Demo mode mutation blocking", () => {
    it("should block POST requests in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await expect(
        apiClient("/children", {
          method: "POST",
          body: { displayName: "Test" },
        })
      ).rejects.toThrow("Mutations are not allowed in demo mode");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should block PUT requests in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await expect(
        apiClient("/children/child-123", {
          method: "PUT",
          body: { displayName: "Updated" },
        })
      ).rejects.toThrow("Mutations are not allowed in demo mode");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should block DELETE requests in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await expect(
        apiClient("/children/child-123", { method: "DELETE" })
      ).rejects.toThrow("Mutations are not allowed in demo mode");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should allow GET requests in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await apiClient("/children");

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should allow mutations when not in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "false");

      // Should successfully call the API (mocked auth succeeds)
      await apiClient("/children", { method: "POST", body: {} });

      // Should have called fetch (not blocked by demo mode)
      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining("/demo"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "mock-auth-token",
          }),
        })
      );
    });
  });

  describe("Demo mode URL construction", () => {
    it("should construct correct URL with /demo prefix", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await apiClient("/children/child-123/episodes");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/demo/children/child-123/episodes");
    });

    it("should handle query parameters correctly in demo mode", async () => {
      mockLocalStorage.setItem("isDemoMode", "true");

      await apiClient("/children?limit=10");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/demo/children?limit=10");
    });
  });
});
