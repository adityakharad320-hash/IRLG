import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

/**
 * Validates and sanitizes a redirection path to prevent open redirect vulnerabilities.
 * Only safe, relative application paths on the current origin are allowed.
 * Rejects external URLs, protocol-relative URLs (//), backslash tricks (/\ or \),
 * authority/userinfo tricks (@), control characters, and malformed paths.
 */
export function getSafeRedirectPath(rawPath: string | null | undefined): string {
  if (!rawPath || typeof rawPath !== "string") {
    return "/dashboard";
  }

  const trimmed = rawPath.trim();

  // Must begin with a single forward slash
  if (!trimmed.startsWith("/")) {
    return "/dashboard";
  }

  // Reject protocol-relative URLs (//)
  if (trimmed.startsWith("//")) {
    return "/dashboard";
  }

  // Reject backslash characters (/\ or \ anywhere in path) which some parsers normalize to /
  if (trimmed.includes("\\")) {
    return "/dashboard";
  }

  // Reject @ character which can denote userinfo/authority in URL parsing
  if (trimmed.includes("@")) {
    return "/dashboard";
  }

  // Reject ASCII control characters
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return "/dashboard";
  }

  try {
    // Parse against a fixed dummy origin to verify it remains strictly on that origin
    const dummyOrigin = "http://localhost";
    const parsed = new URL(trimmed, dummyOrigin);

    if (parsed.origin !== dummyOrigin) {
      return "/dashboard";
    }

    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return "/dashboard";
    }

    // Return the sanitized relative path including query and hash if present
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");
  const safeNext = getSafeRedirectPath(rawNext);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectUrl = new URL(safeNext, requestUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }

    const loginErrorUrl = new URL("/login", requestUrl.origin);
    loginErrorUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginErrorUrl);
  }

  // If no code is present, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
