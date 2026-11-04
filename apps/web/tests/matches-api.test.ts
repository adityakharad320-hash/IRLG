// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMatch,
  joinMatch,
  fetchMatch,
  updateReadiness,
  updateMatchSettings,
  cancelMatch,
  startMatchPreparation,
  fetchMyRole,
  fetchMatchTiming,
  advanceMatchPhase,
} from "../src/lib/api/matches";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Web Matches API Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createMatch", () => {
    it("calls POST /matches with bearer token and returns match payload", async () => {
      const mockResult = {
        match: {
          id: VALID_UUID,
          hostUserId: "user-1",
          inviteCode: "MATCH1",
          status: "LOBBY",
          maxPlayers: 12,
          hunterCount: 2,
          matchDurationSeconds: 1500,
        },
        participants: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockResult,
        }),
      } as unknown as Response);

      const result = await createMatch("token-123", {
        maxPlayers: 12,
        hunterCount: 2,
      });

      expect(result.match.id).toBe(VALID_UUID);
      expect(result.match.inviteCode).toBe("MATCH1");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/matches"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        })
      );
    });

    it("throws ApiError when server returns validation error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "maxPlayers must be at least 8",
          },
        }),
      } as unknown as Response);

      await expect(
        createMatch("token-123", { maxPlayers: 4 })
      ).rejects.toThrow("maxPlayers must be at least 8");
    });
  });

  describe("joinMatch", () => {
    it("calls POST /matches/join and returns joined participant", async () => {
      const mockParticipant = {
        id: "part-1",
        matchId: VALID_UUID,
        userId: "user-2",
        participationStatus: "JOINED",
        isHost: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockParticipant,
        }),
      } as unknown as Response);

      const result = await joinMatch("token-123", {
        inviteCode: "ABC123",
        asSpectator: false,
      });

      expect(result.id).toBe("part-1");
      expect(result.participationStatus).toBe("JOINED");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/matches/join"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ inviteCode: "ABC123", asSpectator: false }),
        })
      );
    });
  });

  describe("fetchMatch", () => {
    it("calls GET /matches/:matchId and returns canonical match state", async () => {
      const mockData = {
        match: { id: VALID_UUID, status: "LOBBY" },
        participants: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockData,
        }),
      } as unknown as Response);

      const result = await fetchMatch("token-123", VALID_UUID);
      expect(result.match.id).toBe(VALID_UUID);
    });

    it("throws ApiError on 403 Forbidden", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        }),
      } as unknown as Response);

      await expect(fetchMatch("token-123", VALID_UUID)).rejects.toThrow(
        "Access denied"
      );
    });
  });

  describe("updateReadiness", () => {
    it("calls PATCH /matches/:matchId/readiness and returns updated participant", async () => {
      const mockParticipant = {
        id: "part-1",
        matchId: VALID_UUID,
        participationStatus: "READY",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockParticipant,
        }),
      } as unknown as Response);

      const result = await updateReadiness("token-123", VALID_UUID, "READY");
      expect(result.participationStatus).toBe("READY");
    });
  });

  describe("updateMatchSettings", () => {
    it("calls PATCH /matches/:matchId/settings and returns updated match", async () => {
      const mockMatch = {
        id: VALID_UUID,
        maxPlayers: 10,
        hunterCount: 2,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { match: mockMatch },
        }),
      } as unknown as Response);

      const result = await updateMatchSettings("token-123", VALID_UUID, {
        maxPlayers: 10,
      });

      expect(result.maxPlayers).toBe(10);
    });
  });

  describe("cancelMatch", () => {
    it("calls POST /matches/:matchId/cancel and returns cancelled match", async () => {
      const mockMatch = {
        id: VALID_UUID,
        status: "CANCELLED",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { match: mockMatch },
        }),
      } as unknown as Response);

      const result = await cancelMatch("token-123", VALID_UUID);
      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("startMatchPreparation", () => {
    it("calls POST /matches/:matchId/prepare and returns match with participants", async () => {
      const mockResult = {
        match: {
          id: VALID_UUID,
          status: "PREPARING",
          preparationStartedAt: new Date().toISOString(),
        },
        participants: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockResult,
        }),
      } as unknown as Response);

      const result = await startMatchPreparation("token-123", VALID_UUID);
      expect(result.match.status).toBe("PREPARING");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/matches/${VALID_UUID}/prepare`),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("fetchMyRole", () => {
    it("calls GET /matches/:matchId/role and returns private role", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { matchId: VALID_UUID, userId: "user-1", role: "HUNTER" },
        }),
      } as unknown as Response);

      const result = await fetchMyRole("token-123", VALID_UUID);
      expect(result.role).toBe("HUNTER");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/matches/${VALID_UUID}/role`),
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("fetchMatchTiming", () => {
    it("calls GET /matches/:matchId/timing and returns canonical countdown timing", async () => {
      const mockTiming = {
        matchId: VALID_UUID,
        status: "PREPARING",
        serverTime: new Date().toISOString(),
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        matchDurationSeconds: 1500,
        preparationStartedAt: new Date().toISOString(),
        countdownStartedAt: null,
        startedAt: null,
        phaseRemainingSeconds: 290,
        hunterReleaseRemainingSeconds: null,
        matchRemainingSeconds: 1500,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: mockTiming,
        }),
      } as unknown as Response);

      const result = await fetchMatchTiming("token-123", VALID_UUID);
      expect(result.status).toBe("PREPARING");
      expect(result.phaseRemainingSeconds).toBe(290);
    });
  });

  describe("advanceMatchPhase", () => {
    it("calls POST /matches/:matchId/advance with targetStatus", async () => {
      const mockMatch = {
        id: VALID_UUID,
        status: "COUNTDOWN",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { match: mockMatch },
        }),
      } as unknown as Response);

      const result = await advanceMatchPhase("token-123", VALID_UUID, "COUNTDOWN");
      expect(result.status).toBe("COUNTDOWN");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/matches/${VALID_UUID}/advance`),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ targetStatus: "COUNTDOWN" }),
        })
      );
    });
  });
});
