import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildApp } from "../src/app.js";
import { AppError } from "../src/utils/errors.js";

describe("Error Handling & Validation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ NODE_ENV: "test" });

    // Test routes for simulating error conditions
    app.get("/test/bad-request", async () => {
      throw AppError.badRequest("Invalid input parameters", [{ field: "tagId", message: "Required" }]);
    });

    app.get("/test/unauthorized", async () => {
      throw AppError.unauthorized("Authentication token expired");
    });

    app.get("/test/forbidden", async () => {
      throw AppError.forbidden("Player is not part of this session");
    });

    app.get("/test/server-error", async () => {
      throw new Error("Simulated database failure");
    });

    app.post("/test/zod-validation", async (request) => {
      const schema = z.object({
        gameId: z.string().min(3),
        maxPlayers: z.number().int().min(2),
      });
      const parsed = schema.parse(request.body);
      return { success: true, data: parsed };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("handles 404 for nonexistent routes with consistent error structure", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/unknown-endpoint",
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Route GET /api/v1/unknown-endpoint not found");
    expect(body.error.requestId).toBeDefined();
  });

  it("handles 400 Bad Request with details", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/bad-request",
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Invalid input parameters");
    expect(body.error.details).toEqual([{ field: "tagId", message: "Required" }]);
  });

  it("handles 401 Unauthorized", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/unauthorized",
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("handles 403 Forbidden", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/forbidden",
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("handles unhandled server errors with 500 without leaking stack trace", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/server-error",
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.requestId).toBeDefined();
    expect(body.error.stack).toBeUndefined();
  });

  it("handles Zod validation errors with 400 and formatted issues", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/test/zod-validation",
      payload: {
        gameId: "ab", // too short
        maxPlayers: 1, // too small
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeInstanceOf(Array);
    expect(body.error.details.length).toBeGreaterThanOrEqual(2);
  });
});
