import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { SupabaseAuthService, type IAuthService } from "../src/auth/supabase-auth.js";
import { createAuthHook, requireRole } from "../src/hooks/authenticate.js";
import { loadConfig } from "../src/config/index.js";
import type { AuthUser } from "../src/types/index.js";

describe("Authentication & Authorization Hooks", () => {
  let app: FastifyInstance;

  const mockAuthService: IAuthService = {
    async verifyToken(token: string): Promise<AuthUser> {
      if (token === "valid-player-token") {
        return {
          id: "user-123",
          email: "player@irlg.gg",
          role: "player",
        };
      }
      if (token === "valid-admin-token") {
        return {
          id: "admin-456",
          email: "admin@irlg.gg",
          role: "admin",
        };
      }
      throw new Error("Invalid token");
    },
  };

  beforeAll(async () => {
    app = await buildApp({ NODE_ENV: "test" });

    const authHook = createAuthHook(mockAuthService);
    const adminOnly = requireRole(["admin"]);

    app.get("/test/protected", { preHandler: [authHook] }, async (request) => {
      return { success: true, user: request.user };
    });

    app.get("/test/admin-only", { preHandler: [authHook, adminOnly] }, async (request) => {
      return { success: true, user: request.user };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("throws unauthorized when SupabaseAuthService is called without environment configuration", async () => {
    const config = loadConfig({
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });
    const authService = new SupabaseAuthService(config);

    await expect(authService.verifyToken("any-token")).rejects.toThrow(
      /Authentication service is not configured/
    );
  });

  it("rejects requests missing the Authorization header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Missing Authorization header");
  });

  it("rejects requests with malformed Authorization header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: {
        authorization: "Basic 123456",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.message).toContain("Expected 'Bearer <token>'");
  });

  it("rejects requests with Bearer keyword but empty token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: {
        authorization: "Bearer   ",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.message).toContain("Expected 'Bearer <token>'");
  });

  it("authenticates valid token and attaches user to request context", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/protected",
      headers: {
        authorization: "Bearer valid-player-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe("user-123");
    expect(body.user.email).toBe("player@irlg.gg");
    expect(body.user.role).toBe("player");
  });

  it("forbids access when role is insufficient", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/admin-only",
      headers: {
        authorization: "Bearer valid-player-token",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("grants access when role matches requirement", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/admin-only",
      headers: {
        authorization: "Bearer valid-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe("admin");
  });
});
