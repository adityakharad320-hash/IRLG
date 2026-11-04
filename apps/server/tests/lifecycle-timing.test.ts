import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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

describe("Milestone 9: Match Lifecycle, Head Start & Timing", () => {
  let service: SupabaseMatchService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SupabaseMatchService(createMockConfig());
  });

  const mockMatchId = "match-timing-99";

  describe("Start Eligibility Validation", () => {
    it("rejects match start if eligible player count is below minimum (8)", async () => {
      const mockMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "ELIG01",
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

      // Only 5 participants
      const mockParticipants: MatchParticipantRow[] = Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i + 1}`,
        match_id: mockMatchId,
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

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatch, error: null }),
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

      await expect(service.startPreparation("host-1", mockMatchId)).rejects.toThrow(
        "Minimum of 8 eligible active players required, but found 5"
      );
    });

    it("rejects match start if not all active players are READY", async () => {
      const mockMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "ELIG02",
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

      // 8 participants, but 2 are only JOINED (not READY)
      const mockParticipants: MatchParticipantRow[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        match_id: mockMatchId,
        user_id: `user-${i + 1}`,
        gameplay_role: null,
        participation_status: i < 6 ? "READY" : "JOINED",
        is_host: i === 0,
        joined_at: new Date().toISOString(),
        ready_at: i < 6 ? new Date().toISOString() : null,
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatch, error: null }),
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

      await expect(service.startPreparation("host-1", mockMatchId)).rejects.toThrow(
        "All eligible active players must be READY (2 player(s) not ready)"
      );
    });

    it("rejects non-host caller from starting preparation", async () => {
      const mockMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "ELIG03",
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

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockMatch, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(service.startPreparation("not-the-host", mockMatchId)).rejects.toThrow(
        "Access denied: Only the match host can start match preparation"
      );
    });
  });

  describe("Runner Head Start & Hunter Release Timing", () => {
    it("prohibits advancing to ACTIVE before the 45-second Runner head start has elapsed", async () => {
      // Countdown started 20 seconds ago (< 45s required)
      const countdownStartedAt = new Date(Date.now() - 20 * 1000).toISOString();

      const mockCountdownMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "HEAD01",
        status: "COUNTDOWN",
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
        countdown_started_at: countdownStartedAt,
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockCountdownMatch, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      await expect(
        service.advanceMatchPhase("host-1", mockMatchId, "ACTIVE")
      ).rejects.toThrow("Runner head-start period is in progress. Hunters cannot be released before 45 seconds have elapsed");
    });

    it("allows transitioning to ACTIVE once the 45-second Runner head start completes", async () => {
      // Countdown started 50 seconds ago (>= 45s required)
      const countdownStartedAt = new Date(Date.now() - 50 * 1000).toISOString();

      const mockCountdownMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "HEAD02",
        status: "COUNTDOWN",
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
        countdown_started_at: countdownStartedAt,
      };

      const activeMatchRow: MatchRow = {
        ...mockCountdownMatch,
        status: "ACTIVE",
        started_at: new Date().toISOString(),
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockCountdownMatch, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: activeMatchRow, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const result = await service.advanceMatchPhase("host-1", mockMatchId, "ACTIVE");
      expect(result.status).toBe("ACTIVE");
      expect(result.startedAt).toBeDefined();
    });
  });

  describe("Timing Recovery & Auto-Advance", () => {
    it("returns canonical remaining seconds for reconnection recovery", async () => {
      // Preparation started 100 seconds ago (out of 300s -> ~200s remaining)
      const prepStartedAt = new Date(Date.now() - 100 * 1000).toISOString();

      const mockPrepMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "RECV01",
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
        preparation_started_at: prepStartedAt,
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockPrepMatch, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const timing = await service.getMatchTiming("host-1", mockMatchId);

      expect(timing.status).toBe("PREPARING");
      expect(timing.preparationDurationSeconds).toBe(300);
      expect(timing.runnerHeadStartSeconds).toBe(45);
      // Approximately 200 seconds remaining
      expect(timing.phaseRemainingSeconds).toBeGreaterThanOrEqual(198);
      expect(timing.phaseRemainingSeconds).toBeLessThanOrEqual(201);
    });

    it("auto-advances expired PREPARING phase (>= 300s) to COUNTDOWN", async () => {
      // Preparation started 350 seconds ago (exceeded 300s)
      const prepStartedAt = new Date(Date.now() - 350 * 1000).toISOString();

      const mockExpiredPrepMatch: MatchRow = {
        id: mockMatchId,
        host_user_id: "host-1",
        invite_code: "AUTO01",
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
        preparation_started_at: prepStartedAt,
      };

      const advancedToCountdown: MatchRow = {
        ...mockExpiredPrepMatch,
        status: "COUNTDOWN",
        countdown_started_at: new Date().toISOString(),
      };

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "matches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockExpiredPrepMatch, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: advancedToCountdown, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

      const timing = await service.getMatchTiming("host-1", mockMatchId);
      expect(timing.status).toBe("COUNTDOWN");
      expect(timing.phaseRemainingSeconds).toBeLessThanOrEqual(45);
    });
  });
});
