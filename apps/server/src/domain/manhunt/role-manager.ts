import crypto from "node:crypto";
import { MANHUNT_CONFIG, type GameplayRole, type MatchStatus } from "./constants.js";
import { AppError } from "../../utils/errors.js";

export interface CandidatePlayer {
  userId: string;
  isSpectator: boolean;
  isWithdrawn?: boolean;
}

export interface PlayerRoleAssignment {
  userId: string;
  role: GameplayRole | null;
}

/**
 * Validates the configured hunter count against match configuration and total players.
 */
export function validateHunterCount(hunterCount: number, eligiblePlayerCount: number): void {
  if (
    !Number.isInteger(hunterCount) ||
    hunterCount < MANHUNT_CONFIG.MIN_HUNTERS ||
    hunterCount > MANHUNT_CONFIG.MAX_HUNTERS
  ) {
    throw AppError.badRequest(
      `Hunter count must be an integer between ${MANHUNT_CONFIG.MIN_HUNTERS} and ${MANHUNT_CONFIG.MAX_HUNTERS}`
    );
  }

  if (hunterCount >= eligiblePlayerCount) {
    throw AppError.badRequest(
      `Hunter count (${hunterCount}) must be strictly less than eligible players (${eligiblePlayerCount}) to allow Runners`
    );
  }

  if (eligiblePlayerCount < MANHUNT_CONFIG.MIN_PLAYERS) {
    throw AppError.badRequest(
      `Cannot assign roles: minimum of ${MANHUNT_CONFIG.MIN_PLAYERS} eligible players required, but found ${eligiblePlayerCount}`
    );
  }
}

/**
 * Performs cryptographically secure Fisher-Yates shuffle.
 */
function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Authoritatively assigns HUNTER and RUNNER roles to eligible players.
 * Spectators and withdrawn players are excluded from role assignment (assigned null).
 * Enforces uniqueness of participant IDs and validates hunter count bounds.
 */
export function assignRoles(
  players: CandidatePlayer[],
  hunterCount: number
): PlayerRoleAssignment[] {
  // Validate participant uniqueness
  const seenUserIds = new Set<string>();
  for (const player of players) {
    if (seenUserIds.has(player.userId)) {
      throw AppError.badRequest(`Duplicate participant detected: ${player.userId}`);
    }
    seenUserIds.add(player.userId);
  }

  const eligiblePlayers = players.filter((p) => !p.isSpectator && !p.isWithdrawn);
  const excludedPlayers = players.filter((p) => p.isSpectator || p.isWithdrawn);

  validateHunterCount(hunterCount, eligiblePlayers.length);

  // Shuffle eligible players securely to pick hunters
  const shuffled = secureShuffle(eligiblePlayers);
  const hunterIds = new Set(shuffled.slice(0, hunterCount).map((p) => p.userId));

  const assignments: PlayerRoleAssignment[] = [];

  for (const player of eligiblePlayers) {
    assignments.push({
      userId: player.userId,
      role: hunterIds.has(player.userId) ? "HUNTER" : "RUNNER",
    });
  }

  for (const excluded of excludedPlayers) {
    assignments.push({
      userId: excluded.userId,
      role: null,
    });
  }

  return assignments;
}

/**
 * Asserts that roles are mutable.
 * Once a match enters ACTIVE, PAUSED, COMPLETED, RESULTS, or CANCELLED, roles are strictly immutable.
 */
export function assertRolesMutable(matchStatus: MatchStatus): void {
  const immutableStatuses: MatchStatus[] = [
    "ACTIVE",
    "PAUSED",
    "COMPLETED",
    "RESULTS",
    "CANCELLED",
  ];

  if (immutableStatuses.includes(matchStatus)) {
    throw AppError.badRequest(
      `Gameplay roles are immutable once the match has progressed to '${matchStatus}'`
    );
  }
}
