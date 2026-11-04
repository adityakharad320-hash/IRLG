import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignRoles,
  type CandidatePlayer,
} from "../src/domain/manhunt/role-manager.js";
import {
  SupabaseMatchService,
  type MatchRow,
  type MatchParticipantRow,
} from "../src/services/match.service.js";
import { loadConfig } from "../src/config/index.js";

function createMockConfig() {
  const config = loadConfig();
  config.supabase.isConfigured = true;
  config.supabase.url = "https://mock-supabase.co";
  config.supabase.serviceRoleKey = "mock-service-role-key";
  return config;
}

describe("Milestone 9: Secure Role Assignment", () => {
  describe("Domain Layer: assignRoles & Randomness", () => {
    it("assigns the exact configured number of Hunters and remainder as Runners", () => {
      const players: CandidatePlayer[] = Array.from({ length: 8 }, (_, i) => ({
        userId: `user-${i + 1}`,
        isSpectator: false,
      }));

      const assignments = assignRoles(players, 2);
      expect(assignments).toHaveLength(8);

      const hunters = assignments.filter((a) => a.role === "HUNTER");
      const runners = assignments.filter((a) => a.role === "RUNNER");

      expect(hunters).toHaveLength(2);
      expect(runners).toHaveLength(6);
    });

    it("assigns 3 hunters for 10-player match when configured", () => {
      const players: CandidatePlayer[] = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i + 1}`,
        isSpectator: false,
      }));

      const assignments = assignRoles(players, 3);
      expect(assignments.filter((a) => a.role === "HUNTER")).toHaveLength(3);
      expect(assignments.filter((a) => a.role === "RUNNER")).toHaveLength(7);
    });

    it("treats the host as a normal player without automatic gameplay role advantage", () => {
      const players: CandidatePlayer[] = [
        { userId: "host-user", isSpectator: false },
        ...Array.from({ length: 7 }, (_, i) => ({
          userId: `player-${i + 1}`,
          isSpectator: false,
        })),
      ];

      // Run multiple iterations: host can be either HUNTER or RUNNER
      const hostRoles = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const assignments = assignRoles(players, 2);
        const hostAssignment = assignments.find((a) => a.userId === "host-user");
        expect(hostAssignment).toBeDefined();
        expect(["HUNTER", "RUNNER"]).toContain(hostAssignment!.role);
        hostRoles.add(hostAssignment!.role!);
      }

      // Host must have had both roles across iterations (demonstrating normal player status)
      expect(hostRoles.has("HUNTER")).toBe(true);
      expect(hostRoles.has("RUNNER")).toBe(true);
    });

    it("excludes spectators and withdrawn participants from receiving gameplay roles", () => {
      const players: CandidatePlayer[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          userId: `active-${i + 1}`,
          isSpectator: false,
        })),
        { userId: "spectator-1", isSpectator: true },
        { userId: "withdrawn-1", isSpectator: false, isWithdrawn: true },
      ];

      const assignments = assignRoles(players, 2);
      expect(assignments).toHaveLength(10);

      const spec = assignments.find((a) => a.userId === "spectator-1");
      const withdr = assignments.find((a) => a.userId === "withdrawn-1");

      expect(spec?.role).toBeNull();
      expect(withdr?.role).toBeNull();

      const activeHunters = assignments.filter((a) => a.role === "HUNTER");
      const activeRunners = assignments.filter((a) => a.role === "RUNNER");

      expect(activeHunters).toHaveLength(2);
      expect(activeRunners).toHaveLength(6);
    });

    it("rejects duplicate participant user IDs", () => {
      const playersWithDuplicate: CandidatePlayer[] = [
        ...Array.from({ length: 7 }, (_, i) => ({
          userId: `user-${i + 1}`,
          isSpectator: false,
        })),
        { userId: "user-1", isSpectator: false }, // Duplicate of user-1
      ];

      expect(() => assignRoles(playersWithDuplicate, 2)).toThrow(
        "Duplicate participant detected: user-1"
      );
    });

    it("demonstrates cryptographic randomness and uniform role distribution", () => {
      const players: CandidatePlayer[] = Array.from({ length: 8 }, (_, i) => ({
        userId: `user-${i + 1}`,
        isSpectator: false,
      }));

      const hunterCounts = new Map<string, number>();
      for (const p of players) {
        hunterCounts.set(p.userId, 0);
      }

      const iterations = 400;
      for (let i = 0; i < iterations; i++) {
        const assignments = assignRoles(players, 2);
        for (const a of assignments) {
          if (a.role === "HUNTER") {
            hunterCounts.set(a.userId, hunterCounts.get(a.userId)! + 1);
          }
        }
      }

      // Expected probability is 2/8 = 25% = 100 times per player
      // Verify every player was selected as hunter a reasonable number of times
      for (const [userId, count] of hunterCounts.entries()) {
        expect(count, `User ${userId} was never picked or picked disproportionately`).toBeGreaterThan(40);
        expect(count).toBeLessThan(160);
      }
    });
  });

  describe("Service Layer: startPreparation & Idempotency", () => {
    let service: SupabaseMatchService;

    beforeEach(() => {
      vi.restoreAllMocks();
      service = new SupabaseMatchService(createMockConfig());
    });

    it("transitions match to PREPARING and stores roles atomically via RPC", async () => {
      const mockMatchRow: MatchRow = {
        id: "match-m9-1",
        host_user_id: "host-1",
        invite_code: "PREP01",
        status: "LOBBY",
        max_players: 8,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        cancelled_at: null,
      };

      const mockParticipants: MatchParticipantRow[] = [
        {
          id: "p-host",
          match_id: "match-m9-1",
          user_id: "host-1",
          gameplay_role: null,
          participation_status: "READY",
          is_host: true,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `p-${i + 2}`,
          match_id: "match-m9-1",
          user_id: `user-${i + 2}`,
          gameplay_role: null,
          participation_status: "READY",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      ];

      const updatedPrepMatch: MatchRow = {
        ...mockMatchRow,
        status: "PREPARING",
        preparation_started_at: new Date().toISOString(),
      };

      let currentStatus = "LOBBY";

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() =>
                    Promise.resolve({
                      data: currentStatus === "LOBBY" ? mockMatchRow : updatedPrepMatch,
                      error: null,
                    })
                  ),
                }),
              }),
            };
          }
          if (table === "match_participants") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockImplementation(() => {
          currentStatus = "PREPARING";
          return Promise.resolve({
            data: { match: updatedPrepMatch, assigned_count: 8 },
            error: null,
          });
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.startPreparation("host-1", "match-m9-1");

      expect(mockClient.rpc).toHaveBeenCalledWith("start_match_preparation_tx", {
        p_match_id: "match-m9-1",
        p_host_user_id: "host-1",
        p_assignments: expect.any(Array),
      });

      expect(result.match.status).toBe("PREPARING");
      expect(result.participants).toHaveLength(8);
    });

    it("is strictly idempotent: repeated requests do not reshuffle roles or fail", async () => {
      const alreadyPrepMatch: MatchRow = {
        id: "match-prep-idemp",
        host_user_id: "host-1",
        invite_code: "IDMP01",
        status: "PREPARING",
        max_players: 8,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        preparation_started_at: new Date().toISOString(),
      };

      const mockParticipants: MatchParticipantRow[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        match_id: "match-prep-idemp",
        user_id: `user-${i + 1}`,
        gameplay_role: null,
        participation_status: "ACTIVE",
        is_host: i === 0,
        joined_at: new Date().toISOString(),
        ready_at: new Date().toISOString(),
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: alreadyPrepMatch, error: null }),
                }),
              }),
            };
          }
          if (table === "match_participants") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn(),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      // Call startPreparation twice
      const firstCall = await service.startPreparation("host-1", "match-prep-idemp");
      const secondCall = await service.startPreparation("host-1", "match-prep-idemp");

      expect(firstCall.match.status).toBe("PREPARING");
      expect(secondCall.match.status).toBe("PREPARING");
      // RPC must not have been called because match was already in PREPARING
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it("handles concurrent startPreparation requests safely", async () => {
      const mockMatchRow: MatchRow = {
        id: "match-concurrent",
        host_user_id: "host-1",
        invite_code: "CONC01",
        status: "LOBBY",
        max_players: 8,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        cancelled_at: null,
      };

      const mockParticipants: MatchParticipantRow[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        match_id: "match-concurrent",
        user_id: `user-${i + 1}`,
        gameplay_role: null,
        participation_status: "READY",
        is_host: i === 0,
        joined_at: new Date().toISOString(),
        ready_at: new Date().toISOString(),
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const prepMatchRow: MatchRow = {
        ...mockMatchRow,
        status: "PREPARING",
        preparation_started_at: new Date().toISOString(),
      };

      let matchState = mockMatchRow;

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() =>
                    Promise.resolve({ data: matchState, error: null })
                  ),
                }),
              }),
            };
          }
          if (table === "match_participants") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockImplementation(() => {
          matchState = prepMatchRow;
          return Promise.resolve({
            data: { match: prepMatchRow, assigned_count: 8 },
            error: null,
          });
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      // Fire 3 simultaneous requests
      const [res1, res2, res3] = await Promise.all([
        service.startPreparation("host-1", "match-concurrent"),
        service.startPreparation("host-1", "match-concurrent"),
        service.startPreparation("host-1", "match-concurrent"),
      ]);

      expect(res1.match.status).toBe("PREPARING");
      expect(res2.match.status).toBe("PREPARING");
      expect(res3.match.status).toBe("PREPARING");
    });
  });
});
