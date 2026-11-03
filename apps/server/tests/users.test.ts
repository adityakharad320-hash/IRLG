import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { IAuthService } from "../src/auth/supabase-auth.js";
import type { IProfileService } from "../src/services/profile.service.js";
import { SupabaseProfileService } from "../src/services/profile.service.js";
import { loadConfig } from "../src/config/index.js";
import type { AuthUser, UserProfile, UpdateProfileInput } from "../src/types/index.js";

describe("User Profile & Identity Integration", () => {
  let app: FastifyInstance;

  // In-memory mock profile storage for unit/isolated testing
  const mockProfiles = new Map<string, UserProfile>();

  const mockAuthService: IAuthService = {
    async verifyToken(token: string): Promise<AuthUser> {
      if (token === "token-player-1") {
        return {
          id: "11111111-1111-1111-1111-111111111111",
          email: "player1@irlg.gg",
          role: "authenticated",
          metadata: { display_name: "ShadowRunner" },
        };
      }
      if (token === "token-player-2") {
        return {
          id: "22222222-2222-2222-2222-222222222222",
          email: "player2@irlg.gg",
          role: "authenticated",
        };
      }
      throw new Error("Invalid token");
    },
  };

  const mockProfileService: IProfileService = {
    async getProfileById(userId: string): Promise<UserProfile | null> {
      return mockProfiles.get(userId) ?? null;
    },
    async ensureProfile(user: AuthUser): Promise<UserProfile> {
      const existing = mockProfiles.get(user.id);
      if (existing) return existing;

      const newProfile: UserProfile = {
        id: user.id,
        displayName: (user.metadata?.display_name as string) || user.email?.split("@")[0] || "Player",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockProfiles.set(user.id, newProfile);
      return newProfile;
    },
    async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
      const existing = mockProfiles.get(userId);
      if (!existing) {
        throw new Error("Profile not found");
      }
      const updated: UserProfile = {
        ...existing,
        displayName: data.displayName ?? existing.displayName,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
        updatedAt: new Date().toISOString(),
      };
      mockProfiles.set(userId, updated);
      return updated;
    },
  };

  beforeAll(async () => {
    app = await buildApp(
      { NODE_ENV: "test" },
      undefined,
      {
        authService: mockAuthService,
        profileService: mockProfileService,
      }
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/users/me", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid token with 401", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("creates and returns profile for authenticated user on first access", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer token-player-1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBe("11111111-1111-1111-1111-111111111111");
      expect(body.data.user.email).toBe("player1@irlg.gg");
      expect(body.data.profile.displayName).toBe("ShadowRunner");
      expect(body.data.profile.id).toBe("11111111-1111-1111-1111-111111111111");
    });

    it("derives fallback display name from email when metadata is absent", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer token-player-2",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.profile.displayName).toBe("player2");
    });
  });

  describe("PATCH /api/v1/users/me", () => {
    it("rejects update requests without authentication", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/me",
        payload: { displayName: "NewName" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("validates display name length constraint (min 2, max 50)", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer token-player-1",
        },
        payload: { displayName: "a" }, // too short
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
    });

    it("validates avatarUrl must be a valid URL", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer token-player-1",
        },
        payload: { avatarUrl: "not-a-valid-url" },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("updates permitted fields for the authenticated user only", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/me",
        headers: {
          authorization: "Bearer token-player-1",
        },
        payload: {
          displayName: "GhostHunter",
          avatarUrl: "https://irlg.gg/avatars/hunter.png",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.profile.displayName).toBe("GhostHunter");
      expect(body.data.profile.avatarUrl).toBe("https://irlg.gg/avatars/hunter.png");

      // Verify player-2 profile remained unchanged
      const player2Profile = mockProfiles.get("22222222-2222-2222-2222-222222222222");
      expect(player2Profile?.displayName).toBe("player2");
    });
  });

  describe("SupabaseProfileService Configuration", () => {
    it("fails safely when accessed without configured Supabase credentials", async () => {
      const unconfiguredConfig = loadConfig({
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      });
      const service = new SupabaseProfileService(unconfiguredConfig);

      await expect(service.getProfileById("any-user-id")).rejects.toThrow(
        /Database service is not configured/
      );
    });
  });
});
