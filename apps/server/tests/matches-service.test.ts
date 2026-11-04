import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseMatchService,
  type MatchRow,
  type MatchParticipantRow,
} from "../src/services/match.service.js";
import { loadConfig } from "../src/config/index.js";

function createMockConfig(isConfigured = true) {
  const config = loadConfig();
  if (!isConfigured) {
    config.supabase.isConfigured = false;
    config.supabase.url = "";
    config.supabase.serviceRoleKey = "";
  } else {
    config.supabase.isConfigured = true;
    config.supabase.url = "https://mock-supabase.co";
    config.supabase.serviceRoleKey = "mock-service-role-key";
  }
  return config;
}

describe("SupabaseMatchService (Domain & Service Layer)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws serviceUnavailable if Supabase is unconfigured", async () => {
    const service = new SupabaseMatchService(createMockConfig(false));

    await expect(
      service.createMatch("host-1", {
        maxPlayers: 12,
        hunterCount: 2,
        matchDurationSeconds: 1500,
      })
    ).rejects.toThrow("Database service is not configured");
  });

  describe("createMatch", () => {
    it("creates a match with host participant and canonical defaults via atomic RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-uuid-1",
        host_user_id: "host-uuid-1",
        invite_code: "ABC123",
        status: "LOBBY",
        max_players: 12,
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

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-uuid-1",
        match_id: "match-uuid-1",
        user_id: "host-uuid-1",
        gameplay_role: null,
        participation_status: "JOINED",
        is_host: true,
        joined_at: new Date().toISOString(),
        ready_at: null,
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: { match: mockMatchRow, participant: mockParticipantRow },
          error: null,
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.createMatch("host-uuid-1", {
        maxPlayers: 12,
        hunterCount: 2,
        matchDurationSeconds: 1500,
      });

      expect(result.match.id).toBe("match-uuid-1");
      expect(result.match.hostUserId).toBe("host-uuid-1");
      expect(result.match.status).toBe("LOBBY");
      expect(result.match.maxPlayers).toBe(12);
      expect(result.match.hunterCount).toBe(2);
      expect(result.match.preparationDurationSeconds).toBe(300);
      expect(result.match.runnerHeadStartSeconds).toBe(45);
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0].userId).toBe("host-uuid-1");
      expect(result.participants[0].isHost).toBe(true);
      expect(result.participants[0].gameplayRole).toBeNull();
      expect(result.participants[0].participationStatus).toBe("JOINED");
    });

    it("retries and recovers when an invite code collision occurs", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-uuid-2",
        host_user_id: "host-uuid-2",
        invite_code: "XYZ789",
        status: "LOBBY",
        max_players: 10,
        hunter_count: 2,
        match_duration_seconds: 1200,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        cancelled_at: null,
      };

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-uuid-2",
        match_id: "match-uuid-2",
        user_id: "host-uuid-2",
        gameplay_role: null,
        participation_status: "JOINED",
        is_host: true,
        joined_at: new Date().toISOString(),
        ready_at: null,
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let attempt = 0;
      const mockClient = {
        rpc: vi.fn().mockImplementation(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({
              data: null,
              error: { code: "23505", message: "duplicate key value violates unique constraint on invite_code" },
            });
          }
          return Promise.resolve({
            data: { match: mockMatchRow, participant: mockParticipantRow },
            error: null,
          });
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.createMatch("host-uuid-2", {
        maxPlayers: 10,
        hunterCount: 2,
        matchDurationSeconds: 1200,
      });

      expect(attempt).toBe(2);
      expect(result.match.id).toBe("match-uuid-2");
    });
  });

  describe("getMatchById", () => {
    it("allows the host to retrieve match details and participants", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "LOBBY",
        max_players: 12,
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
          id: "part-1",
          match_id: "match-1",
          user_id: "host-1",
          gameplay_role: null,
          participation_status: "JOINED",
          is_host: true,
          joined_at: new Date().toISOString(),
          ready_at: null,
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
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
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.getMatchById("host-1", "match-1");
      expect(result.match.id).toBe("match-1");
      expect(result.participants).toHaveLength(1);
    });

    it("allows a participant to retrieve match details and roster", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "LOBBY",
        max_players: 12,
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
          id: "part-1",
          match_id: "match-1",
          user_id: "host-1",
          gameplay_role: null,
          participation_status: "JOINED",
          is_host: true,
          joined_at: new Date().toISOString(),
          ready_at: null,
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "part-2",
          match_id: "match-1",
          user_id: "player-2",
          gameplay_role: null,
          participation_status: "JOINED",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: null,
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
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
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.getMatchById("player-2", "match-1");
      expect(result.match.id).toBe("match-1");
      expect(result.participants).toHaveLength(2);
    });

    it("denies access with 403 Forbidden to an unauthorized user", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "LOBBY",
        max_players: 12,
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
          id: "part-1",
          match_id: "match-1",
          user_id: "host-1",
          gameplay_role: null,
          participation_status: "JOINED",
          is_host: true,
          joined_at: new Date().toISOString(),
          ready_at: null,
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
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
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(service.getMatchById("outsider-user", "match-1")).rejects.toThrow(
        "Access denied: You are not a participant in this match"
      );
    });

    it("masks other players' gameplay roles from participants during active match", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-active",
        host_user_id: "host-user",
        invite_code: "ACT001",
        status: "ACTIVE",
        max_players: 8,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        cancelled_at: null,
      };

      const mockParticipants: MatchParticipantRow[] = [
        {
          id: "p1",
          match_id: "match-active",
          user_id: "hunter-1",
          gameplay_role: "HUNTER",
          participation_status: "ACTIVE",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "p2",
          match_id: "match-active",
          user_id: "runner-1",
          gameplay_role: "RUNNER",
          participation_status: "ACTIVE",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
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
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      // runner-1 requests match details
      const result = await service.getMatchById("runner-1", "match-active");

      const myRecord = result.participants.find((p) => p.userId === "runner-1");
      const otherRecord = result.participants.find((p) => p.userId === "hunter-1");

      // Runner sees their own role
      expect(myRecord?.gameplayRole).toBe("RUNNER");
      // Other player's role is masked to null
      expect(otherRecord?.gameplayRole).toBeNull();
    });

    it("allows participants to see all roles when match is COMPLETED", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-done",
        host_user_id: "host-user",
        invite_code: "DONE01",
        status: "COMPLETED",
        max_players: 8,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: "RUNNERS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        cancelled_at: null,
      };

      const mockParticipants: MatchParticipantRow[] = [
        {
          id: "p1",
          match_id: "match-done",
          user_id: "hunter-1",
          gameplay_role: "HUNTER",
          participation_status: "ACTIVE",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "p2",
          match_id: "match-done",
          user_id: "runner-1",
          gameplay_role: "RUNNER",
          participation_status: "ACTIVE",
          is_host: false,
          joined_at: new Date().toISOString(),
          ready_at: new Date().toISOString(),
          caught_at: null,
          disconnected_at: null,
          withdrawn_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
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
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.getMatchById("runner-1", "match-done");

      const p1 = result.participants.find((p) => p.userId === "hunter-1");
      const p2 = result.participants.find((p) => p.userId === "runner-1");

      expect(p1?.gameplayRole).toBe("HUNTER");
      expect(p2?.gameplayRole).toBe("RUNNER");
    });
  });

  describe("cancelMatch", () => {
    it("allows the host to cancel a match in LOBBY status atomically", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "LOBBY",
        max_players: 12,
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

      const mockCancelledRow = { ...mockMatchRow, status: "CANCELLED", cancelled_at: new Date().toISOString() };

      const mockClient = {
        from: vi.fn(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockCancelledRow, error: null }),
                  }),
                }),
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.cancelMatch("host-1", "match-1");
      expect(result.status).toBe("CANCELLED");
      expect(result.cancelledAt).toBeDefined();
    });

    it("rejects non-host cancellation with 403 Forbidden", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "LOBBY",
        max_players: 12,
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

      const mockClient = {
        from: vi.fn(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(service.cancelMatch("not-host", "match-1")).rejects.toThrow(
        "Only the match host can cancel this match"
      );
    });

    it("rejects cancellation of an already COMPLETED match with 400 Bad Request", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "TEST01",
        status: "COMPLETED",
        max_players: 12,
        hunter_count: 2,
        match_duration_seconds: 1500,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: "RUNNERS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        cancelled_at: null,
      };

      const mockClient = {
        from: vi.fn(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockMatchRow, error: null }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(service.cancelMatch("host-1", "match-1")).rejects.toThrow(
        "Invalid match lifecycle transition from 'COMPLETED' to 'CANCELLED'"
      );
    });
  });

  describe("getMatchByInviteCode", () => {
    it("returns safe non-sensitive match metadata when match is in LOBBY", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "match-1", status: "LOBBY", max_players: 10 },
                error: null,
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const lookup = await service.getMatchByInviteCode("user-1", "ABC123");
      expect(lookup.matchId).toBe("match-1");
      expect(lookup.status).toBe("LOBBY");
      expect(lookup.maxPlayers).toBe(10);
    });

    it("rejects invite lookup if match has already started", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "match-1", status: "ACTIVE", max_players: 10 },
                error: null,
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(service.getMatchByInviteCode("user-1", "ABC123")).rejects.toThrow(
        "Invite code is no longer valid"
      );
    });
  });

  describe("joinMatch", () => {
    it("joins a match via atomic RPC join_manhunt_match_tx with row locking", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-join-1",
        match_id: "match-1",
        user_id: "joining-user-1",
        gameplay_role: null,
        participation_status: "JOINED",
        is_host: false,
        joined_at: new Date().toISOString(),
        ready_at: null,
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "match-1", status: "LOBBY", max_players: 12 },
                error: null,
              }),
            }),
          }),
        })),
        rpc: vi.fn().mockResolvedValue({
          data: mockParticipantRow,
          error: null,
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.joinMatch("joining-user-1", {
        inviteCode: "ABC123",
        asSpectator: false,
      });

      expect(result.id).toBe("part-join-1");
      expect(result.userId).toBe("joining-user-1");
      expect(result.isHost).toBe(false);
      expect(result.participationStatus).toBe("JOINED");
    });

    it("rejects join when lobby is full (concurrency protection)", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "match-1", status: "LOBBY", max_players: 12 },
                error: null,
              }),
            }),
          }),
        })),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0003", message: "MATCH_FULL" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.joinMatch("user-extra", { inviteCode: "ABC123", asSpectator: false })
      ).rejects.toThrow("Match lobby is full");
    });

    it("rejects duplicate participant join with 409 Conflict", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "match-1", status: "LOBBY", max_players: 12 },
                error: null,
              }),
            }),
          }),
        })),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.joinMatch("user-duplicate", { inviteCode: "ABC123", asSpectator: false })
      ).rejects.toThrow("User is already a participant in this match");
    });

    it("allows a player to join when previous lobby participant withdrew (slot freed)", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-new",
        match_id: "match-1",
        user_id: "new-player",
        gameplay_role: null,
        participation_status: "JOINED",
        is_host: false,
        joined_at: new Date().toISOString(),
        ready_at: null,
        caught_at: null,
        disconnected_at: null,
        withdrawn_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "match-1", status: "LOBBY", max_players: 8 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "match_participants") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({ count: 7, error: null }),
                }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockParticipantRow, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.joinMatch("new-player", {
        inviteCode: "ABC123",
        asSpectator: false,
      });

      expect(result.id).toBe("part-new");
      expect(result.userId).toBe("new-player");
      expect(result.participationStatus).toBe("JOINED");
    });
  });

  describe("updateReadiness", () => {
    it("updates participant readiness to READY via atomic RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-1",
        match_id: "match-1",
        user_id: "player-1",
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
      };

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: mockParticipantRow,
          error: null,
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.updateReadiness("player-1", "match-1", { status: "READY" });

      expect(result.id).toBe("part-1");
      expect(result.participationStatus).toBe("READY");
      expect(mockClient.rpc).toHaveBeenCalledWith("update_participant_readiness_tx", {
        p_match_id: "match-1",
        p_user_id: "player-1",
        p_new_status: "READY",
      });
    });

    it("rejects readiness toggle if participant is a spectator", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0005", message: "SPECTATOR_CANNOT_READY" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateReadiness("spectator-1", "match-1", { status: "READY" })
      ).rejects.toThrow("Spectators cannot toggle readiness");
    });

    it("rejects readiness toggle if match is not in LOBBY", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "MATCH_NOT_IN_LOBBY" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateReadiness("player-1", "match-1", { status: "READY" })
      ).rejects.toThrow("Cannot change readiness outside of LOBBY");
    });

    it("serializes against cancellation and rejects readiness when match was cancelled concurrently", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      // Simulate match row serialized for update, seeing CANCELLED after cancellation commits
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0001", message: "MATCH_NOT_IN_LOBBY" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateReadiness("player-1", "match-1", { status: "READY" })
      ).rejects.toThrow("Cannot change readiness outside of LOBBY");
    });

    it("updates participant readiness via fallback query path when RPC is unavailable", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockParticipantRow: MatchParticipantRow = {
        id: "part-1",
        match_id: "match-1",
        user_id: "player-1",
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
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "match-1", status: "LOBBY" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "match_participants") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "part-1",
                        match_id: "match-1",
                        user_id: "player-1",
                        participation_status: "JOINED",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: mockParticipantRow,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.updateReadiness("player-1", "match-1", { status: "READY" });

      expect(result.id).toBe("part-1");
      expect(result.participationStatus).toBe("READY");
    });
  });

  describe("updateSettings", () => {
    it("updates match settings via atomic RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockMatchRow: MatchRow = {
        id: "match-1",
        host_user_id: "host-1",
        invite_code: "MATCH1",
        status: "LOBBY",
        max_players: 10,
        hunter_count: 2,
        match_duration_seconds: 1800,
        preparation_duration_seconds: 300,
        runner_head_start_seconds: 45,
        winner: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        cancelled_at: null,
      };

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: mockMatchRow,
          error: null,
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.updateSettings("host-1", "match-1", {
        maxPlayers: 10,
        matchDurationSeconds: 1800,
      });

      expect(result.maxPlayers).toBe(10);
      expect(result.matchDurationSeconds).toBe(1800);
      expect(mockClient.rpc).toHaveBeenCalledWith("update_match_settings_tx", {
        p_match_id: "match-1",
        p_user_id: "host-1",
        p_max_players: 10,
        p_hunter_count: null,
        p_match_duration_seconds: 1800,
      });
    });

    it("rejects settings update from non-host", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0008", message: "NOT_HOST" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("non-host", "match-1", { maxPlayers: 10 })
      ).rejects.toThrow("Only the match host can update lobby settings");
    });

    it("rejects settings update if maxPlayers is reduced below active occupancy", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0009", message: "CAPACITY_BELOW_OCCUPANCY" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { maxPlayers: 8 })
      ).rejects.toThrow("Cannot reduce maxPlayers below current active participant count");
    });

    it("rejects settings update when maxPlayers is out of bounds via RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0011", message: "MAX_PLAYERS_OUT_OF_BOUNDS" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { maxPlayers: 15 })
      ).rejects.toThrow("maxPlayers must be between 8 and 12");
    });

    it("rejects settings update when hunterCount is out of bounds via RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0012", message: "HUNTER_COUNT_OUT_OF_BOUNDS" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { hunterCount: 5 })
      ).rejects.toThrow("hunterCount must be between 2 and 3");
    });

    it("rejects settings update when duration is out of bounds via RPC", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "P0013", message: "DURATION_OUT_OF_BOUNDS" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { matchDurationSeconds: 600 })
      ).rejects.toThrow("matchDurationSeconds must be between 1200 and 1800");
    });

    it("enforces bounds and hunterCount < maxPlayers in fallback path", async () => {
      const config = createMockConfig(true);
      const service = new SupabaseMatchService(config);

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "match-1",
                      host_user_id: "host-1",
                      status: "LOBBY",
                      max_players: 12,
                      hunter_count: 2,
                      match_duration_seconds: 1500,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { maxPlayers: 15 })
      ).rejects.toThrow("maxPlayers must be between 8 and 12");

      await expect(
        service.updateSettings("host-1", "match-1", { hunterCount: 1 })
      ).rejects.toThrow("hunterCount must be between 2 and 3");

      await expect(
        service.updateSettings("host-1", "match-1", { matchDurationSeconds: 600 })
      ).rejects.toThrow("matchDurationSeconds must be between 1200 and 1800");
    });
  });

  describe("Production Fail-Closed RPC Policy", () => {
    function createProductionConfig() {
      const config = createMockConfig(true);
      config.nodeEnv = "production";
      return config;
    }

    it("createMatch fails closed in production when RPC returns PGRST202", async () => {
      const service = new SupabaseMatchService(createProductionConfig());
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST202", message: "function create_manhunt_match_tx not found" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.createMatch("host-1", { maxPlayers: 12, hunterCount: 2, matchDurationSeconds: 1500 })
      ).rejects.toThrow("Atomic database procedure create_manhunt_match_tx is missing");
    });

    it("joinMatch fails closed in production when RPC returns PGRST202", async () => {
      const service = new SupabaseMatchService(createProductionConfig());
      vi.spyOn(service, "getMatchByInviteCode").mockResolvedValue({
        matchId: "match-1",
        status: "LOBBY",
        maxPlayers: 12,
      });

      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST202", message: "function join_manhunt_match_tx not found" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.joinMatch("user-1", { inviteCode: "ABC123" })
      ).rejects.toThrow("Atomic database procedure join_manhunt_match_tx is missing");
    });

    it("updateReadiness fails closed in production when RPC returns PGRST202", async () => {
      const service = new SupabaseMatchService(createProductionConfig());
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST202", message: "function update_participant_readiness_tx not found" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateReadiness("user-1", "match-1", { status: "READY" })
      ).rejects.toThrow("Atomic database procedure update_participant_readiness_tx is missing");
    });

    it("updateSettings fails closed in production when RPC returns PGRST202", async () => {
      const service = new SupabaseMatchService(createProductionConfig());
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST202", message: "function update_match_settings_tx not found" },
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.updateSettings("host-1", "match-1", { maxPlayers: 10 })
      ).rejects.toThrow("Atomic database procedure update_match_settings_tx is missing");
    });
  });
});
