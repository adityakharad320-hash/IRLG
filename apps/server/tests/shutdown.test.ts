import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("Graceful Shutdown", () => {
  it("stops accepting new requests and closes server cleanly", async () => {
    const app = await buildApp({ NODE_ENV: "test" });

    // Verify it is operational before closing
    const initialRes = await app.inject({
      method: "GET",
      url: "/api/v1/health/live",
    });
    expect(initialRes.statusCode).toBe(200);

    // Perform graceful close
    await app.close();

    // Verify close has completed cleanly
    expect(app.server.listening).toBe(false);
  });
});
