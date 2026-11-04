// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, getSafeRedirectPath } from "../src/app/auth/callback/route";

// Mock createClient from Supabase server helper
vi.mock("../src/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "../src/lib/supabase/server";

describe("Auth Callback Security & Open Redirect Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSafeRedirectPath (Redirect Path Sanitization)", () => {
    it("allows safe application relative path '/dashboard'", () => {
      expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    });

    it("allows safe application relative path '/matches/example-id'", () => {
      expect(getSafeRedirectPath("/matches/example-id")).toBe("/matches/example-id");
    });

    it("allows safe relative paths with query parameters and hash", () => {
      expect(getSafeRedirectPath("/matches/match-123?tab=roster#readiness")).toBe(
        "/matches/match-123?tab=roster#readiness"
      );
    });

    it("rejects protocol-relative URL '//attacker.com' and defaults to '/dashboard'", () => {
      expect(getSafeRedirectPath("//attacker.com")).toBe("/dashboard");
    });

    it("rejects absolute external URL 'https://attacker.com' and defaults to '/dashboard'", () => {
      expect(getSafeRedirectPath("https://attacker.com")).toBe("/dashboard");
    });

    it("rejects backslash trick '/\\attacker.com' and defaults to '/dashboard'", () => {
      expect(getSafeRedirectPath("/\\attacker.com")).toBe("/dashboard");
    });

    it("rejects backslash trick '/\\\\attacker.com' and defaults to '/dashboard'", () => {
      expect(getSafeRedirectPath("/\\\\attacker.com")).toBe("/dashboard");
    });

    it("rejects userinfo / authority trick '/@attacker.com' and defaults to '/dashboard'", () => {
      expect(getSafeRedirectPath("/@attacker.com")).toBe("/dashboard");
    });

    it("handles missing next (null, undefined, empty) safely by defaulting to '/dashboard'", () => {
      expect(getSafeRedirectPath(null)).toBe("/dashboard");
      expect(getSafeRedirectPath(undefined)).toBe("/dashboard");
      expect(getSafeRedirectPath("")).toBe("/dashboard");
      expect(getSafeRedirectPath("   ")).toBe("/dashboard");
    });

    it("rejects javascript: or data: pseudoprotocols", () => {
      expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectPath("data:text/html,<h1>XSS</h1>")).toBe("/dashboard");
    });
  });

  describe("GET /auth/callback Route Handler", () => {
    it("successfully exchanges code and redirects to validated '/dashboard'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=/dashboard");
      const response = await GET(request);

      expect(mockExchangeCode).toHaveBeenCalledWith("valid-code");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("successfully exchanges code and redirects to validated '/matches/example-id'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=/matches/example-id");
      const response = await GET(request);

      expect(mockExchangeCode).toHaveBeenCalledWith("valid-code");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/matches/example-id");
    });

    it("neutralizes '//attacker.com' redirect and redirects to '/dashboard'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=//attacker.com");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("neutralizes 'https://attacker.com' redirect and redirects to '/dashboard'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=https://attacker.com");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("neutralizes '/\\attacker.com' redirect and redirects to '/dashboard'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=/\\attacker.com");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("handles missing 'next' parameter by safely defaulting to '/dashboard'", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("ignores arbitrary X-Forwarded-Host header and remains on request origin", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=valid-code&next=/dashboard", {
        headers: {
          "x-forwarded-host": "malicious-phishing-host.com",
        },
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
      expect(response.headers.get("location")).not.toContain("malicious-phishing-host.com");
    });

    it("redirects to /login with error query param when exchangeCodeForSession fails", async () => {
      const mockExchangeCode = vi.fn().mockResolvedValue({
        data: {},
        error: { message: "Invalid PKCE authorization code" },
      });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const request = new Request("http://localhost:3000/auth/callback?code=expired-code");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login?error=Invalid+PKCE+authorization+code");
    });

    it("redirects to /login when code is missing entirely", async () => {
      const request = new Request("http://localhost:3000/auth/callback");
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });
  });
});
