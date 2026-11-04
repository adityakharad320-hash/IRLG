import type { ParticipantStatus, GameplayRole } from "./constants.js";
import { AppError } from "../../utils/errors.js";

/**
 * Permitted participant transitions in Classic Manhunt v1.0
 */
export const ALLOWED_PARTICIPANT_TRANSITIONS: Record<ParticipantStatus, readonly ParticipantStatus[]> = {
  JOINED: ["READY", "SPECTATING", "WITHDRAWN", "DISCONNECTED"],
  READY: ["JOINED", "ACTIVE", "SPECTATING", "WITHDRAWN", "DISCONNECTED"],
  ACTIVE: ["CAUGHT", "DISCONNECTED", "WITHDRAWN"],
  CAUGHT: ["DISCONNECTED", "WITHDRAWN"], // CAUGHT cannot return to ACTIVE
  DISCONNECTED: ["ACTIVE", "READY", "JOINED", "CAUGHT", "WITHDRAWN"], // Reconnects back to prior state or withdraws
  WITHDRAWN: [], // Terminal: A withdrawn player cannot rejoin the match
  SPECTATING: ["WITHDRAWN", "DISCONNECTED"],
};

/**
 * Checks whether a participant transition is permitted.
 */
export function canTransitionParticipant(
  current: ParticipantStatus,
  target: ParticipantStatus,
  role?: GameplayRole | null
): boolean {
  if (current === target) {
    return false;
  }

  // Explicit rule: CAUGHT can never return to ACTIVE
  if (current === "CAUGHT" && target === "ACTIVE") {
    return false;
  }

  // Explicit rule: WITHDRAWN is terminal in active match
  if (current === "WITHDRAWN") {
    return false;
  }

  // Explicit rule: SPECTATING cannot receive gameplay role
  if (target === "SPECTATING" && role != null) {
    return false;
  }

  const allowed = ALLOWED_PARTICIPANT_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

/**
 * Asserts that a participant transition is valid, throwing an AppError.badRequest if disallowed.
 */
export function assertValidParticipantTransition(
  current: ParticipantStatus,
  target: ParticipantStatus,
  role?: GameplayRole | null
): void {
  if (!canTransitionParticipant(current, target, role)) {
    if (current === "CAUGHT" && target === "ACTIVE") {
      throw AppError.badRequest("A caught player cannot return to active status");
    }
    if (current === "WITHDRAWN") {
      throw AppError.badRequest("A withdrawn player cannot rejoin the match");
    }
    if (target === "SPECTATING" && role != null) {
      throw AppError.badRequest("Spectators cannot have an assigned gameplay role");
    }
    throw AppError.badRequest(
      `Invalid participant status transition from '${current}' to '${target}'`
    );
  }
}
