import { describe, it, expect } from "vitest";
import { validateEnv } from "../src/config/env.js";
import { parseCorsOrigins, loadConfig } from "../src/config/index.js";

describe("Configuration & Environment Validation", () => {
  it("applies defaults for minimal valid environment", () => {
    const env = validateEnv({});
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.API_PREFIX).toBe("/api/v1");
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
  });

  it("coerces string PORT to integer", () => {
    const env = validateEnv({ PORT: "8080" });
    expect(env.PORT).toBe(8080);
  });

  it("throws validation error for invalid PORT value", () => {
    expect(() => validateEnv({ PORT: "not-a-number" })).toThrow(/Invalid environment configuration/);
    expect(() => validateEnv({ PORT: "99999" })).toThrow(/Invalid environment configuration/);
    expect(() => validateEnv({ PORT: "0" })).toThrow(/Invalid environment configuration/);
  });

  it("throws validation error for invalid NODE_ENV", () => {
    expect(() => validateEnv({ NODE_ENV: "staging" })).toThrow(/Invalid environment configuration/);
  });

  it("throws validation error for invalid SUPABASE_URL", () => {
    expect(() => validateEnv({ SUPABASE_URL: "not-a-valid-url" })).toThrow(
      /SUPABASE_URL must be a valid URL/
    );
  });

  it("accepts valid SUPABASE_URL and trims whitespace", () => {
    const env = validateEnv({
      SUPABASE_URL: "https://xyzcompany.supabase.co ",
    });
    expect(env.SUPABASE_URL).toBe("https://xyzcompany.supabase.co");
  });

  it("parses single and multiple CORS origins correctly", () => {
    expect(parseCorsOrigins("http://localhost:3000")).toBe("http://localhost:3000");
    expect(parseCorsOrigins("http://localhost:3000, https://irlg.gg")).toEqual([
      "http://localhost:3000",
      "https://irlg.gg",
    ]);
  });

  it("correctly identifies unconfigured Supabase in loadConfig", () => {
    const cfg = loadConfig({
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });
    expect(cfg.supabase.isConfigured).toBe(false);
  });
});
