// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  getApiBaseUrl,
} from "../src/lib/api/users";
import type { CurrentUserResponse, UserProfile } from "../src/types/api";

describe("Backend Profile API Integration (Fastify)", () => {
  const originalFetch = global.fetch;
  const mockToken = "mock-supabase-jwt-token";
  const originalApiEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiEnv;
    }
  });

  describe("API Base URL Configuration", () => {
    it("defaults to localhost:4000/api/v1 if unset", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getApiBaseUrl()).toBe("http://localhost:4000/api/v1");
    });

    it("trims trailing slashes from configured URL", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.irlg.gg/api/v1///";
      expect(getApiBaseUrl()).toBe("https://api.irlg.gg/api/v1");
    });
  });

  describe("fetchCurrentUserProfile (GET /api/v1/users/me)", () => {
    it("attaches Supabase access token in Authorization Bearer header", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const mockSuccessData: CurrentUserResponse = {
        user: { id: "user-123", email: "runner@irlg.gg", role: "authenticated" },
        profile: {
          id: "user-123",
          displayName: "GhostRunner",
          avatarUrl: null,
          createdAt: "2026-11-04T00:00:00Z",
          updatedAt: "2026-11-04T00:00:00Z",
        },
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockSuccessData }),
      });
      global.fetch = fetchMock;

      const result = await fetchCurrentUserProfile(mockToken);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:4000/api/v1/users/me");
      expect(options.method).toBe("GET");
      expect(options.headers.Authorization).toBe(`Bearer ${mockToken}`);
      expect(result).toEqual(mockSuccessData);
    });

    it("throws ApiError when backend returns 401 Unauthorized", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid authorization token",
          },
        }),
      });

      await expect(fetchCurrentUserProfile("expired-token")).rejects.toThrow(
        "Missing or invalid authorization token"
      );
    });

    it("handles network failure gracefully", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(fetchCurrentUserProfile(mockToken)).rejects.toThrow(
        /Failed to connect to backend server: ECONNREFUSED/
      );
    });
  });

  describe("updateCurrentUserProfile (PATCH /api/v1/users/me)", () => {
    it("sends sanitized JSON payload and updates profile", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const updatedProfile: UserProfile = {
        id: "user-123",
        displayName: "SpeedDemon",
        avatarUrl: "https://irlg.gg/avatar.png",
        createdAt: "2026-11-04T00:00:00Z",
        updatedAt: "2026-11-04T01:00:00Z",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { profile: updatedProfile } }),
      });
      global.fetch = fetchMock;

      const result = await updateCurrentUserProfile(mockToken, {
        displayName: "SpeedDemon",
        avatarUrl: "https://irlg.gg/avatar.png",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("http://localhost:4000/api/v1/users/me");
      expect(options.method).toBe("PATCH");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers.Authorization).toBe(`Bearer ${mockToken}`);
      expect(JSON.parse(options.body)).toEqual({
        displayName: "SpeedDemon",
        avatarUrl: "https://irlg.gg/avatar.png",
      });
      expect(result).toEqual(updatedProfile);
    });

    it("throws ApiError when backend rejects invalid profile inputs", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Display name must be between 2 and 50 characters",
          },
        }),
      });

      await expect(
        updateCurrentUserProfile(mockToken, { displayName: "x" })
      ).rejects.toThrow("Display name must be between 2 and 50 characters");
    });
  });
});
