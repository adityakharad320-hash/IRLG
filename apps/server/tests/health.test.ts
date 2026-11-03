import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("Health Endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      NODE_ENV: "test",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/health/live", () => {
    it("returns 200 OK and confirms process is alive", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/health/live",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("ok");
      expect(typeof body.uptime).toBe("number");
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof body.timestamp).toBe("string");
      expect(body.version).toBe("0.1.0");
    });
  });

  describe("GET /api/v1/health/ready", () => {
    it("reports not_ready with 503 when Supabase is not configured", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/health/ready",
      });

      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe("not_ready");
      expect(body.services).toBeDefined();
      expect(body.services.database).toBeDefined();
      expect(body.services.database.status).toBe("unconfigured");
      expect(body.services.database.message).toContain("not configured");
    });
  });
});
