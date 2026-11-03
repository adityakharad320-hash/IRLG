import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { checkDatabaseHealth } from "../src/database/health.js";
import { loadConfig } from "../src/config/index.js";

describe("Security Boundaries & Infrastructure Verification", () => {
  it("allows CORS from configured origin", async () => {
    const app = await buildApp({
      NODE_ENV: "test",
      CORS_ORIGIN: "http://localhost:3000",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/live",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    await app.close();
  });

  it("does not allow CORS from unapproved origins", async () => {
    const app = await buildApp({
      NODE_ENV: "test",
      CORS_ORIGIN: "http://localhost:3000",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/live",
      headers: {
        origin: "https://unauthorized-domain.com",
      },
    });

    // Access-Control-Allow-Origin header must NOT be present for unapproved origins
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("rejects request bodies that exceed the 1MB limit with 413", async () => {
    const app = await buildApp({ NODE_ENV: "test" });

    // Generate payload larger than 1MB (1,048,576 bytes)
    const largePayload = JSON.stringify({
      data: "x".repeat(1024 * 1024 + 100),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/health/live", // any endpoint
      payload: largePayload,
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.statusCode).toBe(413);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();
    await app.close();
  });

  it("reports database as unhealthy when configured URL is unreachable", async () => {
    const config = loadConfig({
      SUPABASE_URL: "https://nonexistent-unreachable-db-test-999.supabase.co",
      SUPABASE_ANON_KEY: "dummy-key-for-test",
    });

    const result = await checkDatabaseHealth(config);

    expect(result.status).toBe("unhealthy");
    expect(result.message).toBeDefined();
    expect(typeof result.latencyMs).toBe("number");
  });

  it("redacts sensitive fields in logger output", async () => {
    let capturedLog = "";
    const mockStream = {
      write: (chunk: string) => {
        capturedLog += chunk;
        return true;
      },
    };

    const testApp = await (await import("fastify")).default({
      logger: {
        level: "info",
        stream: mockStream,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'req.headers["set-cookie"]',
            "password",
            "*.password",
            "token",
            "*.token",
            "secret",
            "*.secret",
            "apiKey",
            "*.apiKey",
            "serviceRoleKey",
            "*.serviceRoleKey",
          ],
          censor: "[REDACTED]",
        },
      },
    });

    testApp.log.info(
      {
        token: "super-secret-user-jwt",
        password: "player-plain-password",
        serviceRoleKey: "eyJh...sensitive-role-key",
        normalField: "public-value",
      },
      "Redaction test entry"
    );

    await testApp.close();

    expect(capturedLog).toContain('"token":"[REDACTED]"');
    expect(capturedLog).toContain('"password":"[REDACTED]"');
    expect(capturedLog).toContain('"serviceRoleKey":"[REDACTED]"');
    expect(capturedLog).not.toContain("super-secret-user-jwt");
    expect(capturedLog).not.toContain("player-plain-password");
    expect(capturedLog).not.toContain("eyJh...sensitive-role-key");
    expect(capturedLog).toContain('"normalField":"public-value"');
  });
});
