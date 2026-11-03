import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("Server Bootstrap & Lifecycle", () => {
  it("builds the Fastify instance successfully", async () => {
    const app = await buildApp({ NODE_ENV: "test" });
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe("function");
    await app.close();
  });

  it("assigns and reflects x-request-id on requests", async () => {
    const app = await buildApp({ NODE_ENV: "test" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/live",
    });

    expect(response.headers["x-request-id"]).toBeDefined();
    expect(typeof response.headers["x-request-id"]).toBe("string");
    await app.close();
  });

  it("shuts down gracefully on app.close()", async () => {
    const app = await buildApp({ NODE_ENV: "test" });
    await expect(app.close()).resolves.toBeUndefined();
  });
});
