import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchHub } from "../src/components/dashboard/MatchHub";
import { LobbyHeader } from "../src/components/lobby/LobbyHeader";
import { LobbyRoster } from "../src/components/lobby/LobbyRoster";
import { LobbyReadinessToggle } from "../src/components/lobby/LobbyReadinessToggle";
import { HostSettingsPanel } from "../src/components/lobby/HostSettingsPanel";
import { LobbyView } from "../src/components/lobby/LobbyView";
import type { Match, MatchParticipant } from "../src/types/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateMatch = vi.fn();
const mockJoinMatch = vi.fn();
const mockFetchMatch = vi.fn();
const mockUpdateReadiness = vi.fn();
const mockUpdateMatchSettings = vi.fn();
const mockCancelMatch = vi.fn();

vi.mock("../src/lib/api/matches", () => ({
  createMatch: (...args: unknown[]) => mockCreateMatch(...args),
  joinMatch: (...args: unknown[]) => mockJoinMatch(...args),
  fetchMatch: (...args: unknown[]) => mockFetchMatch(...args),
  updateReadiness: (...args: unknown[]) => mockUpdateReadiness(...args),
  updateMatchSettings: (...args: unknown[]) => mockUpdateMatchSettings(...args),
  cancelMatch: (...args: unknown[]) => mockCancelMatch(...args),
  ApiError: class extends Error {
    constructor(
      msg: string,
      public statusCode: number = 400
    ) {
      super(msg);
    }
  },
}));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-host-1",
      email: "host@irlg.gg",
    },
    session: { access_token: "mock-access-token" },
    profile: { displayName: "ShadowHost" },
  }),
}));

const mockMatch: Match = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  hostUserId: "user-host-1",
  inviteCode: "ABC123",
  status: "LOBBY",
  maxPlayers: 12,
  hunterCount: 2,
  matchDurationSeconds: 1500,
  preparationDurationSeconds: 300,
  runnerHeadStartSeconds: 45,
  winner: null,
  createdAt: "2026-11-04T00:00:00Z",
  updatedAt: "2026-11-04T00:00:00Z",
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
};

const mockParticipants: MatchParticipant[] = [
  {
    id: "part-1",
    matchId: mockMatch.id,
    userId: "user-host-1",
    displayName: "ShadowHost",
    gameplayRole: null,
    participationStatus: "JOINED",
    isHost: true,
    joinedAt: "2026-11-04T00:00:00Z",
    readyAt: null,
    caughtAt: null,
    disconnectedAt: null,
    withdrawnAt: null,
    createdAt: "2026-11-04T00:00:00Z",
    updatedAt: "2026-11-04T00:00:00Z",
  },
  {
    id: "part-2",
    matchId: mockMatch.id,
    userId: "user-player-2",
    displayName: "GhostRunner",
    gameplayRole: null,
    participationStatus: "READY",
    isHost: false,
    joinedAt: "2026-11-04T00:01:00Z",
    readyAt: "2026-11-04T00:02:00Z",
    caughtAt: null,
    disconnectedAt: null,
    withdrawnAt: null,
    createdAt: "2026-11-04T00:01:00Z",
    updatedAt: "2026-11-04T00:02:00Z",
  },
];

describe("Lobby UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MatchHub (Dashboard Integration)", () => {
    it("creates a match with selected settings and redirects to lobby", async () => {
      mockCreateMatch.mockResolvedValue({
        match: mockMatch,
        participants: [mockParticipants[0]],
      });

      render(<MatchHub />);

      expect(screen.getByText("Classic Manhunt Multiplayer")).toBeDefined();
      expect(screen.getByText("Create Match Lobby")).toBeDefined();
      expect(screen.getByText("Join with Invite Code")).toBeDefined();

      const createBtn = screen.getByRole("button", { name: /Create Manhunt Match/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(mockCreateMatch).toHaveBeenCalledWith("mock-access-token", {
          maxPlayers: 12,
          hunterCount: 2,
          matchDurationSeconds: 1500,
        });
        expect(mockPush).toHaveBeenCalledWith(`/matches/${mockMatch.id}`);
      });
    });

    it("joins a match with validated 6-character code and redirects", async () => {
      mockJoinMatch.mockResolvedValue({
        id: "part-3",
        matchId: mockMatch.id,
        userId: "user-host-1",
        participationStatus: "JOINED",
      });

      render(<MatchHub />);

      const codeInput = screen.getByPlaceholderText(/e\.g\. ABC123/i);
      fireEvent.change(codeInput, { target: { value: "xyz789" } });

      const joinBtn = screen.getByRole("button", { name: /Join Match Lobby/i });
      fireEvent.click(joinBtn);

      await waitFor(() => {
        expect(mockJoinMatch).toHaveBeenCalledWith("mock-access-token", {
          inviteCode: "XYZ789",
          asSpectator: false,
        });
        expect(mockPush).toHaveBeenCalledWith(`/matches/${mockMatch.id}`);
      });
    });
  });

  describe("LobbyHeader", () => {
    it("displays invite code, capacity, hunters, duration, and status", () => {
      render(
        <LobbyHeader
          match={mockMatch}
          activeCount={2}
          connectionState="connected"
        />
      );

      expect(screen.getByTestId("invite-code-display").textContent).toBe("ABC123");
      expect(screen.getByText("2 / 12")).toBeDefined();
      expect(screen.getByText("Live Realtime")).toBeDefined();
    });

    it("copies invite code to clipboard on copy click", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(
        <LobbyHeader
          match={mockMatch}
          activeCount={2}
          connectionState="connected"
        />
      );

      const copyBtn = screen.getByRole("button", { name: /Copy invite code/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith("ABC123");
      expect(await screen.findByText(/Copied!/i)).toBeDefined();
    });
  });

  describe("LobbyRoster", () => {
    it("renders participants with display names, host badge, and readiness status", () => {
      render(
        <LobbyRoster
          participants={mockParticipants}
          currentUserId="user-host-1"
          maxPlayers={12}
        />
      );

      expect(screen.getByText("ShadowHost")).toBeDefined();
      expect(screen.getByText("GhostRunner")).toBeDefined();
      expect(screen.getByText("HOST")).toBeDefined();
      expect(screen.getByText("YOU")).toBeDefined();
      expect(screen.getByText("READY")).toBeDefined();
      expect(screen.getByText("NOT READY")).toBeDefined();
    });
  });

  describe("LobbyReadinessToggle", () => {
    it("toggles participant from JOINED to READY", async () => {
      const onUpdated = vi.fn();
      mockUpdateReadiness.mockResolvedValue({
        ...mockParticipants[0],
        participationStatus: "READY",
      });

      render(
        <LobbyReadinessToggle
          participant={mockParticipants[0]}
          accessToken="mock-token"
          isLobby={true}
          onReadinessUpdated={onUpdated}
        />
      );

      const readyBtn = screen.getByRole("button", { name: /I'm Ready/i });
      fireEvent.click(readyBtn);

      await waitFor(() => {
        expect(mockUpdateReadiness).toHaveBeenCalledWith(
          "mock-token",
          mockMatch.id,
          "READY"
        );
        expect(onUpdated).toHaveBeenCalled();
      });
    });
  });

  describe("HostSettingsPanel", () => {
    it("submits updated settings when constraints are satisfied", async () => {
      const onUpdated = vi.fn();
      mockUpdateMatchSettings.mockResolvedValue({
        ...mockMatch,
        maxPlayers: 10,
      });

      render(
        <HostSettingsPanel
          match={mockMatch}
          activeCount={2}
          accessToken="mock-token"
          onSettingsUpdated={onUpdated}
          onMatchCancelled={vi.fn()}
        />
      );

      const capacitySelect = screen.getByLabelText(/Capacity/i);
      fireEvent.change(capacitySelect, { target: { value: "10" } });

      const saveBtn = screen.getByRole("button", { name: /Save Lobby Settings/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMatchSettings).toHaveBeenCalledWith(
          "mock-token",
          mockMatch.id,
          expect.objectContaining({ maxPlayers: 10 })
        );
        expect(onUpdated).toHaveBeenCalled();
      });
    });

    it("requires confirmation modal before executing cancellation", async () => {
      const onCancelled = vi.fn();
      mockCancelMatch.mockResolvedValue({
        ...mockMatch,
        status: "CANCELLED",
      });

      render(
        <HostSettingsPanel
          match={mockMatch}
          activeCount={2}
          accessToken="mock-token"
          onSettingsUpdated={vi.fn()}
          onMatchCancelled={onCancelled}
        />
      );

      const cancelBtn = screen.getByRole("button", { name: /Cancel Match/i });
      fireEvent.click(cancelBtn);

      expect(screen.getByText(/Cancel Match Lobby\?/i)).toBeDefined();

      const confirmBtn = screen.getByRole("button", { name: /Confirm Cancellation/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockCancelMatch).toHaveBeenCalledWith("mock-token", mockMatch.id);
        expect(onCancelled).toHaveBeenCalled();
      });
    });
  });

  describe("LobbyView", () => {
    it("fetches match on mount and renders full lobby experience", async () => {
      mockFetchMatch.mockResolvedValue({
        match: mockMatch,
        participants: mockParticipants,
      });

      render(<LobbyView matchId={mockMatch.id} />);

      await waitFor(() => {
        expect(mockFetchMatch).toHaveBeenCalledWith(
          "mock-access-token",
          mockMatch.id
        );
        expect(screen.getByText("Match Lobby")).toBeDefined();
        expect(screen.getByText("ShadowHost")).toBeDefined();
      });
    });

    it("displays cancellation alert when match is cancelled", async () => {
      mockFetchMatch.mockResolvedValue({
        match: { ...mockMatch, status: "CANCELLED" },
        participants: mockParticipants,
      });

      render(<LobbyView matchId={mockMatch.id} />);

      await waitFor(() => {
        expect(screen.getByText("Match Cancelled")).toBeDefined();
        expect(screen.getByText(/This match lobby was cancelled by the host/i)).toBeDefined();
      });
    });
  });
});
