import type { MatchStatus } from "./constants.js";
import { AppError } from "../../utils/errors.js";

/**
 * Authoritative Classic Manhunt v1.0 Lifecycle Transition Rules
 *
 * LOBBY -> PREPARING, CANCELLED
 * PREPARING -> COUNTDOWN, CANCELLED
 * COUNTDOWN -> ACTIVE, CANCELLED
 * ACTIVE -> PAUSED, COMPLETED
 * PAUSED -> ACTIVE, CANCELLED
 * COMPLETED -> RESULTS
 * CANCELLED -> RESULTS
 * All others rejected.
 */
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  LOBBY: ["PREPARING", "CANCELLED"],
  PREPARING: ["COUNTDOWN", "CANCELLED"],
  COUNTDOWN: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: ["RESULTS"],
  CANCELLED: ["RESULTS"],
  RESULTS: [],
};

/**
 * Checks if a match transition from current status to target status is permitted.
 */
export function canTransitionMatch(current: MatchStatus, target: MatchStatus): boolean {
  if (current === target) {
    return false;
  }
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

/**
 * Asserts that a match transition is valid, throwing an AppError.badRequest if disallowed.
 */
export function assertValidMatchTransition(current: MatchStatus, target: MatchStatus): void {
  if (!canTransitionMatch(current, target)) {
    throw AppError.badRequest(
      `Invalid match lifecycle transition from '${current}' to '${target}'`
    );
  }
}
