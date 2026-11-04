import { describe, it, expect } from "vitest";
import {
  MANHUNT_CONFIG,
  MATCH_STATUSES,
  canTransitionMatch,
  assertValidMatchTransition,
  canTransitionParticipant,
  assertValidParticipantTransition,
  validateHunterCount,
  assignRoles,
  assertRolesMutable,
  type CandidatePlayer,
} from "../src/domain/manhunt/index.js";
import { AppError } from "../src/utils/errors.js";

describe("Classic Manhunt Domain Rules & State Machines", () => {
  describe("Configuration & Settings Boundaries", () => {
    it("enforces canonical match boundaries", () => {
      expect(MANHUNT_CONFIG.MIN_PLAYERS).toBe(8);
      expect(MANHUNT_CONFIG.MAX_PLAYERS).toBe(12);
      expect(MANHUNT_CONFIG.MIN_HUNTERS).toBe(2);
      expect(MANHUNT_CONFIG.MAX_HUNTERS).toBe(3);
      expect(MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS).toBe(1200); // 20m
      expect(MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS).toBe(1800); // 30m
      expect(MANHUNT_CONFIG.PREPARATION_DURATION_SECONDS).toBe(300); // 5m
      expect(MANHUNT_CONFIG.RUNNER_HEAD_START_SECONDS).toBe(45); // 45s
      expect(MANHUNT_CONFIG.INVITE_CODE_LENGTH).toBe(6);
    });
  });

  describe("Lifecycle State Machine", () => {
    it("allows every approved lifecycle transition", () => {
      // LOBBY -> PREPARING, CANCELLED
      expect(canTransitionMatch("LOBBY", "PREPARING")).toBe(true);
      expect(canTransitionMatch("LOBBY", "CANCELLED")).toBe(true);
      expect(() => assertValidMatchTransition("LOBBY", "PREPARING")).not.toThrow();
      expect(() => assertValidMatchTransition("LOBBY", "CANCELLED")).not.toThrow();

      // PREPARING -> COUNTDOWN, CANCELLED
      expect(canTransitionMatch("PREPARING", "COUNTDOWN")).toBe(true);
      expect(canTransitionMatch("PREPARING", "CANCELLED")).toBe(true);
      expect(() => assertValidMatchTransition("PREPARING", "COUNTDOWN")).not.toThrow();
      expect(() => assertValidMatchTransition("PREPARING", "CANCELLED")).not.toThrow();

      // COUNTDOWN -> ACTIVE, CANCELLED
      expect(canTransitionMatch("COUNTDOWN", "ACTIVE")).toBe(true);
      expect(canTransitionMatch("COUNTDOWN", "CANCELLED")).toBe(true);
      expect(() => assertValidMatchTransition("COUNTDOWN", "ACTIVE")).not.toThrow();
      expect(() => assertValidMatchTransition("COUNTDOWN", "CANCELLED")).not.toThrow();

      // ACTIVE -> PAUSED, COMPLETED
      expect(canTransitionMatch("ACTIVE", "PAUSED")).toBe(true);
      expect(canTransitionMatch("ACTIVE", "COMPLETED")).toBe(true);
      expect(() => assertValidMatchTransition("ACTIVE", "PAUSED")).not.toThrow();
      expect(() => assertValidMatchTransition("ACTIVE", "COMPLETED")).not.toThrow();

      // PAUSED -> ACTIVE, CANCELLED
      expect(canTransitionMatch("PAUSED", "ACTIVE")).toBe(true);
      expect(canTransitionMatch("PAUSED", "CANCELLED")).toBe(true);
      expect(() => assertValidMatchTransition("PAUSED", "ACTIVE")).not.toThrow();
      expect(() => assertValidMatchTransition("PAUSED", "CANCELLED")).not.toThrow();

      // COMPLETED -> RESULTS
      expect(canTransitionMatch("COMPLETED", "RESULTS")).toBe(true);
      expect(() => assertValidMatchTransition("COMPLETED", "RESULTS")).not.toThrow();

      // CANCELLED -> RESULTS
      expect(canTransitionMatch("CANCELLED", "RESULTS")).toBe(true);
      expect(() => assertValidMatchTransition("CANCELLED", "RESULTS")).not.toThrow();
    });

    it("rejects all unauthorized lifecycle transitions", () => {
      // Cannot jump from LOBBY directly to ACTIVE
      expect(canTransitionMatch("LOBBY", "ACTIVE")).toBe(false);
      expect(() => assertValidMatchTransition("LOBBY", "ACTIVE")).toThrow(AppError);

      // Cannot jump backwards from ACTIVE to LOBBY
      expect(canTransitionMatch("ACTIVE", "LOBBY")).toBe(false);
      expect(() => assertValidMatchTransition("ACTIVE", "LOBBY")).toThrow(AppError);

      // ACTIVE cannot transition directly to CANCELLED (must PAUSE first or finish)
      expect(canTransitionMatch("ACTIVE", "CANCELLED")).toBe(false);
      expect(() => assertValidMatchTransition("ACTIVE", "CANCELLED")).toThrow(AppError);

      // COMPLETED cannot be cancelled
      expect(canTransitionMatch("COMPLETED", "CANCELLED")).toBe(false);
      expect(() => assertValidMatchTransition("COMPLETED", "CANCELLED")).toThrow(AppError);

      // Same state transition is rejected
      for (const status of MATCH_STATUSES) {
        expect(canTransitionMatch(status, status)).toBe(false);
      }

      // RESULTS is terminal (no outgoing transitions)
      for (const status of MATCH_STATUSES) {
        expect(canTransitionMatch("RESULTS", status)).toBe(false);
      }
    });
  });

  describe("Participant State Transitions", () => {
    it("allows valid transitions for active players and reconnecting players", () => {
      expect(canTransitionParticipant("JOINED", "READY")).toBe(true);
      expect(canTransitionParticipant("READY", "ACTIVE")).toBe(true);
      expect(canTransitionParticipant("ACTIVE", "CAUGHT")).toBe(true);
      expect(canTransitionParticipant("ACTIVE", "DISCONNECTED")).toBe(true);

      // Disconnected can reconnect to active
      expect(canTransitionParticipant("DISCONNECTED", "ACTIVE")).toBe(true);
    });

    it("strictly prohibits caught runner from returning to active status", () => {
      expect(canTransitionParticipant("CAUGHT", "ACTIVE")).toBe(false);
      expect(() => assertValidParticipantTransition("CAUGHT", "ACTIVE")).toThrow(
        "A caught player cannot return to active status"
      );
    });

    it("prohibits withdrawn participant from transitioning or rejoining", () => {
      expect(canTransitionParticipant("WITHDRAWN", "JOINED")).toBe(false);
      expect(canTransitionParticipant("WITHDRAWN", "ACTIVE")).toBe(false);
      expect(() => assertValidParticipantTransition("WITHDRAWN", "ACTIVE")).toThrow(
        "A withdrawn player cannot rejoin the match"
      );
    });

    it("prohibits spectators from receiving gameplay roles", () => {
      expect(canTransitionParticipant("JOINED", "SPECTATING", "HUNTER")).toBe(false);
      expect(() =>
        assertValidParticipantTransition("JOINED", "SPECTATING", "HUNTER")
      ).toThrow("Spectators cannot have an assigned gameplay role");

      // Without role, spectating is permitted
      expect(canTransitionParticipant("JOINED", "SPECTATING", null)).toBe(true);
    });
  });

  describe("Role Manager", () => {
    it("validates hunter count configuration bounds", () => {
      // Valid bounds
      expect(() => validateHunterCount(2, 8)).not.toThrow();
      expect(() => validateHunterCount(3, 10)).not.toThrow();

      // Invalid hunter count
      expect(() => validateHunterCount(1, 8)).toThrow("Hunter count must be an integer between 2 and 3");
      expect(() => validateHunterCount(4, 12)).toThrow("Hunter count must be an integer between 2 and 3");
      expect(() => validateHunterCount(2.5, 8)).toThrow("Hunter count must be an integer between 2 and 3");

      // Player count below minimum
      expect(() => validateHunterCount(2, 7)).toThrow("minimum of 8 eligible players required");

      // Hunter count exceeds or equals eligible players
      expect(() => validateHunterCount(3, 3)).toThrow("must be strictly less than eligible players");
    });

    it("assigns exact configured number of hunters and remaining as runners", () => {
      const players: CandidatePlayer[] = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i + 1}`,
        isSpectator: false,
      }));

      const assignments = assignRoles(players, 3);
      expect(assignments).toHaveLength(10);

      const hunters = assignments.filter((a) => a.role === "HUNTER");
      const runners = assignments.filter((a) => a.role === "RUNNER");

      expect(hunters).toHaveLength(3);
      expect(runners).toHaveLength(7);

      // Verify all users are accounted for
      const assignedUserIds = new Set(assignments.map((a) => a.userId));
      expect(assignedUserIds.size).toBe(10);
    });

    it("excludes spectators from gameplay role assignments", () => {
      const players: CandidatePlayer[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          userId: `player-${i + 1}`,
          isSpectator: false,
        })),
        { userId: "spectator-1", isSpectator: true },
        { userId: "spectator-2", isSpectator: true },
      ];

      const assignments = assignRoles(players, 2);
      expect(assignments).toHaveLength(10);

      const hunters = assignments.filter((a) => a.role === "HUNTER");
      const runners = assignments.filter((a) => a.role === "RUNNER");
      const spectators = assignments.filter((a) => a.role === null);

      expect(hunters).toHaveLength(2);
      expect(runners).toHaveLength(6);
      expect(spectators).toHaveLength(2);

      const spectatorIds = spectators.map((s) => s.userId);
      expect(spectatorIds).toContain("spectator-1");
      expect(spectatorIds).toContain("spectator-2");
    });

    it("enforces role immutability once match is active or beyond", () => {
      // Roles are mutable in pre-game stages
      expect(() => assertRolesMutable("LOBBY")).not.toThrow();
      expect(() => assertRolesMutable("PREPARING")).not.toThrow();
      expect(() => assertRolesMutable("COUNTDOWN")).not.toThrow();

      // Roles are strictly immutable once active, paused, completed, or cancelled
      expect(() => assertRolesMutable("ACTIVE")).toThrow("Gameplay roles are immutable");
      expect(() => assertRolesMutable("PAUSED")).toThrow("Gameplay roles are immutable");
      expect(() => assertRolesMutable("COMPLETED")).toThrow("Gameplay roles are immutable");
      expect(() => assertRolesMutable("CANCELLED")).toThrow("Gameplay roles are immutable");
      expect(() => assertRolesMutable("RESULTS")).toThrow("Gameplay roles are immutable");
    });
  });
});
