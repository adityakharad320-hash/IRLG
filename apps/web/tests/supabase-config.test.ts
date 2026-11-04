import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient as createBrowserClient, isSupabaseConfigured } from "../src/lib/supabase/client";

describe("Supabase Client Configuration & Security Boundaries", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports unconfigured when environment variables are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports unconfigured when placeholder values are used", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";

    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports configured when valid public variables are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://itjuiufwpobmjxqfpiva.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "valid-anon-key-string";

    expect(isSupabaseConfigured()).toBe(true);
  });

  it("initializes browser client without throwing even when env vars are absent", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => createBrowserClient()).not.toThrow();
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("never exposes service-role keys in public frontend environment", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
