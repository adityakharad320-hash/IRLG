// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchStartSection } from "../src/components/lobby/MatchStartSection";
import { RoleRevealCard } from "../src/components/lobby/RoleRevealCard";
import { MatchPreparationView } from "../src/components/lobby/MatchPreparationView";
import { MatchCountdownView } from "../src/components/lobby/MatchCountdownView";
import { MatchActiveView } from "../src/components/lobby/MatchActiveView";
import type { Match, MatchParticipant } from "../src/types/api";
import * as matchesApi from "../src/lib/api/matches";

vi.mock("../src/lib/api/matches", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/api/matches")>(
    "../src/lib/api/matches"
  );
  return {
    ...actual,
    startMatchPreparation: vi.fn(),
    fetchMyRole: vi.fn(),
    fetchMatchTiming: vi.fn(),
    advanceMatchPhase: vi.fn(),
  };
});

describe("Milestone 9 Frontend: Preparation & Role Reveal Experience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseMatch: Match = {
    id: "match-ui-1",
    hostUserId: "host-user",
    inviteCode: "PREP99",
    status: "LOBBY",
    maxPlayers: 8,
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
  };

  describe("MatchStartSection Component", () => {
    it("displays ineligible status and reasons when player count is below minimum (8)", () => {
      // 5 active players (all ready)
      const participants: MatchParticipant[] = Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i + 1}`,
        matchId: "match-ui-1",
        userId: i === 0 ? "host-user" : `user-${i + 1}`,
        gameplayRole: null,
        participationStatus: "READY",
        isHost: i === 0,
        joinedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayName: `Player ${i + 1}`,
      }));

      render(
        <MatchStartSection
          match={baseMatch}
          participants={participants}
          isHost={true}
          accessToken="token-123"
          onPreparationStarted={vi.fn()}
        />
      );

      // Should indicate awaiting eligibility
      expect(screen.getByText("Awaiting Eligibility")).toBeDefined();
      expect(screen.getByText(/3 more needed/)).toBeDefined();

      // Start button should be disabled
      const startBtn = screen.getByTestId("start-match-btn");
      expect(startBtn.hasAttribute("disabled")).toBe(true);
    });

    it("displays ineligible status when not all active players are READY", () => {
      // 8 active players, but 2 are only JOINED
      const participants: MatchParticipant[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        matchId: "match-ui-1",
        userId: i === 0 ? "host-user" : `user-${i + 1}`,
        gameplayRole: null,
        participationStatus: i < 6 ? "READY" : "JOINED",
        isHost: i === 0,
        joinedAt: new Date().toISOString(),
        readyAt: i < 6 ? new Date().toISOString() : null,
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayName: `Player ${i + 1}`,
      }));

      render(
        <MatchStartSection
          match={baseMatch}
          participants={participants}
          isHost={true}
          accessToken="token-123"
          onPreparationStarted={vi.fn()}
        />
      );

      expect(screen.getByText(/2 not ready/)).toBeDefined();
      const startBtn = screen.getByTestId("start-match-btn");
      expect(startBtn.hasAttribute("disabled")).toBe(true);
    });

    it("enables Start Match button for host when 8 players are READY", async () => {
      const participants: MatchParticipant[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        matchId: "match-ui-1",
        userId: i === 0 ? "host-user" : `user-${i + 1}`,
        gameplayRole: null,
        participationStatus: "READY",
        isHost: i === 0,
        joinedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayName: `Player ${i + 1}`,
      }));

      const onStartMock = vi.fn();
      vi.mocked(matchesApi.startMatchPreparation).mockResolvedValue({
        match: { ...baseMatch, status: "PREPARING" },
        participants,
      });

      render(
        <MatchStartSection
          match={baseMatch}
          participants={participants}
          isHost={true}
          accessToken="token-123"
          onPreparationStarted={onStartMock}
        />
      );

      expect(screen.getByText("Ready to Start")).toBeDefined();
      const startBtn = screen.getByTestId("start-match-btn");
      expect(startBtn.hasAttribute("disabled")).toBe(false);

      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(matchesApi.startMatchPreparation).toHaveBeenCalledWith("token-123", "match-ui-1");
        expect(onStartMock).toHaveBeenCalled();
      });
    });
  });

  describe("RoleRevealCard Component", () => {
    it("renders HUNTER role reveal card with 45-second head start notice", () => {
      render(<RoleRevealCard role="HUNTER" />);

      expect(screen.getByText("YOU ARE A HUNTER")).toBeDefined();
      expect(screen.getByText(/45-Second Runner Head Start in Effect/)).toBeDefined();
      expect(screen.getByText(/Strict Role Privacy/)).toBeDefined();
    });

    it("renders RUNNER role reveal card with 45-second head start notice", () => {
      render(<RoleRevealCard role="RUNNER" />);

      expect(screen.getByText("YOU ARE A RUNNER")).toBeDefined();
      expect(screen.getByText(/45-Second Head Start Advantage/)).toBeDefined();
      expect(screen.getByText(/Strict Role Privacy/)).toBeDefined();
    });
  });

  describe("MatchPreparationView Component", () => {
    it("fetches caller's private role and displays preparation countdown", async () => {
      const participants: MatchParticipant[] = Array.from({ length: 8 }, (_, i) => ({
        id: `p-${i + 1}`,
        matchId: "match-ui-1",
        userId: i === 0 ? "host-user" : `user-${i + 1}`,
        gameplayRole: null, // Public roster contains NO roles
        participationStatus: "ACTIVE",
        isHost: i === 0,
        joinedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        caughtAt: null,
        disconnectedAt: null,
        withdrawnAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        displayName: `Player ${i + 1}`,
      }));

      vi.mocked(matchesApi.fetchMyRole).mockResolvedValue({
        matchId: "match-ui-1",
        userId: "host-user",
        role: "HUNTER",
      });

      vi.mocked(matchesApi.fetchMatchTiming).mockResolvedValue({
        matchId: "match-ui-1",
        status: "PREPARING",
        serverTime: new Date().toISOString(),
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        matchDurationSeconds: 1500,
        preparationStartedAt: new Date().toISOString(),
        countdownStartedAt: null,
        startedAt: null,
        phaseRemainingSeconds: 295,
        hunterReleaseRemainingSeconds: null,
        matchRemainingSeconds: 1500,
      });

      render(
        <MatchPreparationView
          match={{ ...baseMatch, status: "PREPARING" }}
          participants={participants}
          currentUserId="host-user"
          isHost={true}
          accessToken="token-123"
          onMatchUpdated={vi.fn()}
        />
      );

      // Verify role is revealed for current user
      await waitFor(() => {
        expect(screen.getByText("YOU ARE A HUNTER")).toBeDefined();
      });

      // Verify timer displays prep window (approx 4:55)
      expect(screen.getByTestId("prep-timer")).toBeDefined();

      // Verify host has button to advance to countdown
      expect(screen.getByTestId("advance-to-countdown-btn")).toBeDefined();

      // Verify roster does NOT leak other players' roles
      expect(screen.getByText("Roles Classified")).toBeDefined();
    });
  });

  describe("MatchCountdownView Component", () => {
    it("renders Runner head start alert for RUNNER", async () => {
      vi.mocked(matchesApi.fetchMyRole).mockResolvedValue({
        matchId: "match-ui-1",
        userId: "user-runner",
        role: "RUNNER",
      });

      vi.mocked(matchesApi.fetchMatchTiming).mockResolvedValue({
        matchId: "match-ui-1",
        status: "COUNTDOWN",
        serverTime: new Date().toISOString(),
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        matchDurationSeconds: 1500,
        preparationStartedAt: new Date().toISOString(),
        countdownStartedAt: new Date().toISOString(),
        startedAt: null,
        phaseRemainingSeconds: 45,
        hunterReleaseRemainingSeconds: 45,
        matchRemainingSeconds: 1500,
      });

      render(
        <MatchCountdownView
          match={{ ...baseMatch, status: "COUNTDOWN" }}
          currentUserId="user-runner"
          isHost={false}
          accessToken="token-123"
          onMatchUpdated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("runner-countdown-banner")).toBeDefined();
        expect(screen.getByText(/RUN! DISPERSE INTO THE ZONE!/)).toBeDefined();
      });

      expect(screen.getByTestId("head-start-timer")).toBeDefined();
    });

    it("renders Hold Position alert for HUNTER during 45s head start", async () => {
      vi.mocked(matchesApi.fetchMyRole).mockResolvedValue({
        matchId: "match-ui-1",
        userId: "user-hunter",
        role: "HUNTER",
      });

      vi.mocked(matchesApi.fetchMatchTiming).mockResolvedValue({
        matchId: "match-ui-1",
        status: "COUNTDOWN",
        serverTime: new Date().toISOString(),
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        matchDurationSeconds: 1500,
        preparationStartedAt: new Date().toISOString(),
        countdownStartedAt: new Date().toISOString(),
        startedAt: null,
        phaseRemainingSeconds: 45,
        hunterReleaseRemainingSeconds: 45,
        matchRemainingSeconds: 1500,
      });

      render(
        <MatchCountdownView
          match={{ ...baseMatch, status: "COUNTDOWN" }}
          currentUserId="user-hunter"
          isHost={false}
          accessToken="token-123"
          onMatchUpdated={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("hunter-countdown-banner")).toBeDefined();
        expect(screen.getByText(/HOLD YOUR POSITION!/)).toBeDefined();
      });
    });
  });

  describe("MatchActiveView Component", () => {
    it("renders active hunt in progress and match duration countdown", async () => {
      vi.mocked(matchesApi.fetchMyRole).mockResolvedValue({
        matchId: "match-ui-1",
        userId: "user-1",
        role: "HUNTER",
      });

      vi.mocked(matchesApi.fetchMatchTiming).mockResolvedValue({
        matchId: "match-ui-1",
        status: "ACTIVE",
        serverTime: new Date().toISOString(),
        preparationDurationSeconds: 300,
        runnerHeadStartSeconds: 45,
        matchDurationSeconds: 1500,
        preparationStartedAt: new Date().toISOString(),
        countdownStartedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        phaseRemainingSeconds: 1480,
        hunterReleaseRemainingSeconds: 0,
        matchRemainingSeconds: 1480,
      });

      render(
        <MatchActiveView
          match={{ ...baseMatch, status: "ACTIVE" }}
          currentUserId="user-1"
          accessToken="token-123"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("HUNT IN PROGRESS")).toBeDefined();
      });
      expect(screen.getByTestId("active-match-timer")).toBeDefined();
    });
  });
});
