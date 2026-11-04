import { describe, it, expect } from "vitest";
import {
  generateInviteCode,
  isValidInviteCodeFormat,
} from "../src/domain/manhunt/invite-code.js";

describe("Invite Code Generation & Validation", () => {
  it("generates a 6-character uppercase alphanumeric code", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("produces unique codes with high entropy over multiple iterations", () => {
    const generated = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
      expect(isValidInviteCodeFormat(code)).toBe(true);
      generated.add(code);
    }

    // High entropy check: In 100 codes, collisions should be virtually 0
    expect(generated.size).toBe(iterations);
  });

  it("validates correct invite code format", () => {
    expect(isValidInviteCodeFormat("ABC123")).toBe(true);
    expect(isValidInviteCodeFormat("XYZ987")).toBe(true);
    expect(isValidInviteCodeFormat("abc123")).toBe(true); // normalizes to uppercase
    expect(isValidInviteCodeFormat("  ABC123  ")).toBe(true); // trims whitespace
  });

  it("rejects invalid invite code formats", () => {
    expect(isValidInviteCodeFormat("ABC12")).toBe(false); // too short
    expect(isValidInviteCodeFormat("ABC1234")).toBe(false); // too long
    expect(isValidInviteCodeFormat("AB-123")).toBe(false); // special character
    expect(isValidInviteCodeFormat("")).toBe(false);
    expect(isValidInviteCodeFormat(null as unknown as string)).toBe(false);
    expect(isValidInviteCodeFormat(undefined as unknown as string)).toBe(false);
  });
});
