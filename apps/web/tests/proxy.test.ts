// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "../src/lib/supabase/proxy";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";

describe("Proxy Session Management & Route Protection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users attempting to access /dashboard to /login", async () => {
    // Mock getUser returning null user
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(307); // Next.js temporary redirect
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2Fdashboard");
  });

  it("redirects authenticated users attempting to access /login to /dashboard", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "runner@irlg.gg" } },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new NextRequest("http://localhost:3000/login");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("redirects authenticated users attempting to access /signup to /dashboard", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "runner@irlg.gg" } },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new NextRequest("http://localhost:3000/signup");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("permits unauthenticated access to public root /", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    const request = new NextRequest("http://localhost:3000/");
    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("safely redirects /dashboard if Supabase environment is unconfigured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new NextRequest("http://localhost:3000/dashboard");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
  });
});
