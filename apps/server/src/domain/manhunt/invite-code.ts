import crypto from "node:crypto";
import { MANHUNT_CONFIG } from "./constants.js";

const INVITE_CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Generates a cryptographically secure, 6-character uppercase alphanumeric invite code.
 */
export function generateInviteCode(): string {
  const chars = MANHUNT_CONFIG.INVITE_CODE_CHARS;
  const charsLength = chars.length;
  let code = "";

  for (let i = 0; i < MANHUNT_CONFIG.INVITE_CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, charsLength);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Validates that an invite code conforms to the 6-character uppercase alphanumeric format.
 */
export function isValidInviteCodeFormat(code: string): boolean {
  if (typeof code !== "string") {
    return false;
  }
  return INVITE_CODE_REGEX.test(code.trim().toUpperCase());
}
