import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../src/app.js";
import type { IAuthService } from "../src/auth/supabase-auth.js";
import type { IMatchService } from "../src/services/match.service.js";
import type { MatchWithParticipants, Match } from "../src/types/index.js";
import { AppError } from "../src/utils/errors.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Matches API Endpoints (/api/v1/matches)", () => {
  let mockAuthService: IAuthService;
  let mockMatchService: IMatchService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAuthService = {
      verifyToken: vi.fn().mockResolvedValue({
        id: "auth-user-1",
        email: "player1@example.com",
        role: "authenticated",
      }),
    };

    mockMatchService = {
      createMatch: vi.fn(),
      getMatchById: vi.fn(),
      cancelMatch: vi.fn(),
      getMatchByInviteCode: vi.fn(),
      joinMatch: vi.fn(),
      updateReadiness: vi.fn(),
      updateSettings: vi.fn(),
    };
  });

  describe("POST /api/v1/matches (Match Creation)", () => {
    it("returns 401 Unauthorized when missing Authorization header", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 VALIDATION_ERROR when settings violate canonical constraints", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      // maxPlayers below 8
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        headers: { authorization: "Bearer valid-token" },
        payload: { maxPlayers: 6 },
      });
      expect(res1.statusCode).toBe(400);
      expect(res1.json().error.code).toBe("VALIDATION_ERROR");

      // maxPlayers above 12
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        headers: { authorization: "Bearer valid-token" },
        payload: { maxPlayers: 15 },
      });
      expect(res2.statusCode).toBe(400);
      expect(res2.json().error.code).toBe("VALIDATION_ERROR");

      // hunterCount below 2 or above 3
      const res3 = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        headers: { authorization: "Bearer valid-token" },
        payload: { hunterCount: 1 },
      });
      expect(res3.statusCode).toBe(400);
      expect(res3.json().error.code).toBe("VALIDATION_ERROR");

      // duration out of bounds (< 1200 or > 1800)
      const res4 = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        headers: { authorization: "Bearer valid-token" },
        payload: { matchDurationSeconds: 600 },
      });
      expect(res4.statusCode).toBe(400);
      expect(res4.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("creates a match successfully and returns 201 Created with canonical data", async () => {
      const expectedResult: MatchWithParticipants = {
        match: {
          id: VALID_UUID,
          hostUserId: "auth-user-1",
          inviteCode: "MATCH1",
          status: "LOBBY",
          maxPlayers: 12,
          hunterCount: 2,
          matchDurationSeconds: 1500,
          preparationDurationSeconds: 300,
          runnerHeadStartSeconds: 45,
          winner: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        },
        participants: [
          {
            id: "part-1",
            matchId: VALID_UUID,
            userId: "auth-user-1",
            gameplayRole: null,
            participationStatus: "JOINED",
            isHost: true,
            joinedAt: new Date().toISOString(),
            readyAt: null,
            caughtAt: null,
            disconnectedAt: null,
            withdrawnAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(mockMatchService.createMatch).mockResolvedValue(expectedResult);

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/matches",
        headers: { authorization: "Bearer valid-token" },
        payload: {
          maxPlayers: 12,
          hunterCount: 2,
          matchDurationSeconds: 1500,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.match.id).toBe(VALID_UUID);
      expect(json.data.match.inviteCode).toBe("MATCH1");
      expect(json.data.participants).toHaveLength(1);
      expect(json.data.participants[0].isHost).toBe(true);
      expect(response.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("GET /api/v1/matches/:matchId (Match Retrieval)", () => {
    it("returns 400 VALIDATION_ERROR for non-UUID matchId parameter", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/matches/invalid-not-uuid",
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 403 Forbidden when requesting user is not host or participant", async () => {
      vi.mocked(mockMatchService.getMatchById).mockRejectedValue(
        AppError.forbidden("Access denied: You are not a participant in this match")
      );

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/matches/${VALID_UUID}`,
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("returns 200 OK with match details for authorized user", async () => {
      const expectedResult: MatchWithParticipants = {
        match: {
          id: VALID_UUID,
          hostUserId: "auth-user-1",
          inviteCode: "MATCH1",
          status: "LOBBY",
          maxPlayers: 10,
          hunterCount: 2,
          matchDurationSeconds: 1200,
          preparationDurationSeconds: 300,
          runnerHeadStartSeconds: 45,
          winner: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
        },
        participants: [],
      };

      vi.mocked(mockMatchService.getMatchById).mockResolvedValue(expectedResult);

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/matches/${VALID_UUID}`,
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().data.match.id).toBe(VALID_UUID);
    });
  });

  describe("POST /api/v1/matches/:matchId/cancel (Match Cancellation)", () => {
    it("returns 403 Forbidden when non-host attempts to cancel match", async () => {
      vi.mocked(mockMatchService.cancelMatch).mockRejectedValue(
        AppError.forbidden("Only the match host can cancel this match")
      );

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/matches/${VALID_UUID}/cancel`,
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("returns 200 OK when host successfully cancels match", async () => {
      const cancelledMatch: Match = {
        id: VALID_UUID,
        hostUserId: "auth-user-1",
        inviteCode: "MATCH1",
        status: "CANCELLED",
        maxPlayers: 12,
        hunterCount: 2,
        matchDurationSeconds: 1500,
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        winner: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        cancelledAt: new Date().toISOString(),
      };

      vi.mocked(mockMatchService.cancelMatch).mockResolvedValue(cancelledMatch);

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/matches/${VALID_UUID}/cancel`,
        headers: { authorization: "Bearer valid-token" },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.match.status).toBe("CANCELLED");
      expect(json.data.match.cancelledAt).toBeDefined();
    });
  });

  describe("POST /api/v1/matches/join (Join Match)", () => {
    it("returns 401 Unauthorized when missing Authorization header", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/matches/join",
        payload: { inviteCode: "ABC123" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 VALIDATION_ERROR for invalid inviteCode format", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/matches/join",
        headers: { authorization: "Bearer valid-token" },
        payload: { inviteCode: "invalid-code-too-long" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 OK with participant data upon successful join", async () => {
      vi.mocked(mockMatchService.joinMatch).mockResolvedValue({
        id: "part-join-1",
        matchId: VALID_UUID,
        userId: "auth-user-1",
        gameplayRole: null,
        participationStatus: "JOINED",
        isHost: false,
        joinedAt: new Date().toISOString(),
        readyAt: null,
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/matches/join",
        headers: { authorization: "Bearer valid-token" },
        payload: { inviteCode: "MATCH1", asSpectator: false },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("part-join-1");
      expect(json.data.participationStatus).toBe("JOINED");
    });
  });

  describe("PATCH /api/v1/matches/:matchId/readiness (Readiness Updates)", () => {
    it("returns 401 Unauthorized when missing Authorization header", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/readiness`,
        payload: { status: "READY" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 VALIDATION_ERROR when status is not READY or JOINED", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/readiness`,
        headers: { authorization: "Bearer valid-token" },
        payload: { status: "ACTIVE" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully toggles caller readiness to READY and returns 200 OK", async () => {
      vi.mocked(mockMatchService.updateReadiness).mockResolvedValue({
        id: "part-1",
        matchId: VALID_UUID,
        userId: "auth-user-1",
        gameplayRole: null,
        participationStatus: "READY",
        isHost: false,
        joinedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/readiness`,
        headers: { authorization: "Bearer valid-token" },
        payload: { status: "READY" },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.participationStatus).toBe("READY");
      expect(mockMatchService.updateReadiness).toHaveBeenCalledWith(
        "auth-user-1",
        VALID_UUID,
        { status: "READY" }
      );
    });

    it("returns 400 INVALID_READINESS_TRANSITION when participant cannot ready", async () => {
      vi.mocked(mockMatchService.updateReadiness).mockRejectedValue(
        AppError.invalidReadinessTransition("Spectators cannot toggle readiness")
      );

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/readiness`,
        headers: { authorization: "Bearer valid-token" },
        payload: { status: "READY" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_READINESS_TRANSITION");
    });
  });

  describe("PATCH /api/v1/matches/:matchId/settings (Host Settings Updates)", () => {
    it("returns 401 Unauthorized when missing Authorization header", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/settings`,
        payload: { maxPlayers: 10 },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 VALIDATION_ERROR when settings violate bounds", async () => {
      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      // maxPlayers < 8
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/settings`,
        headers: { authorization: "Bearer valid-token" },
        payload: { maxPlayers: 5 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 403 NOT_AUTHORIZED when non-host attempts to update settings", async () => {
      vi.mocked(mockMatchService.updateSettings).mockRejectedValue(
        AppError.notAuthorized("Only the match host can update lobby settings")
      );

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/settings`,
        headers: { authorization: "Bearer valid-token" },
        payload: { maxPlayers: 10 },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("NOT_AUTHORIZED");
    });

    it("returns 200 OK when host successfully updates settings", async () => {
      vi.mocked(mockMatchService.updateSettings).mockResolvedValue({
        id: VALID_UUID,
        hostUserId: "auth-user-1",
        inviteCode: "MATCH1",
        status: "LOBBY",
        maxPlayers: 10,
        hunterCount: 2,
        matchDurationSeconds: 1500,
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        winner: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
      });

      const app = await buildApp(
        { NODE_ENV: "test" },
        undefined,
        { authService: mockAuthService, matchService: mockMatchService }
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/matches/${VALID_UUID}/settings`,
        headers: { authorization: "Bearer valid-token" },
        payload: { maxPlayers: 10 },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.match.maxPlayers).toBe(10);
    });
  });
});
