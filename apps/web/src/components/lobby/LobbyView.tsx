"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { fetchMatch, ApiError } from "../../lib/api/matches";
import type { Match, MatchParticipant } from "../../types/api";
import { useMatchRealtime } from "../../hooks/useMatchRealtime";
import { LobbyHeader } from "./LobbyHeader";
import { LobbyRoster } from "./LobbyRoster";
import { LobbyReadinessToggle } from "./LobbyReadinessToggle";
import { HostSettingsPanel } from "./HostSettingsPanel";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

interface LobbyViewProps {
  matchId: string;
}

export function LobbyView({ matchId }: LobbyViewProps) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;

  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load with cleanup to prevent cascading unmounted renders
  useEffect(() => {
    let ignore = false;

    async function fetchLobby() {
      if (!accessToken) return;
      try {
        const data = await fetchMatch(accessToken, matchId);
        if (!ignore) {
          setMatch(data.match);
          setParticipants(data.participants);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiError) {
            if (err.statusCode === 403) {
              setError("You are not authorized to view this match lobby.");
            } else if (err.statusCode === 404) {
              setError("Match not found or invalid match identifier.");
            } else {
              setError(err.message);
            }
          } else {
            setError("Failed to load match lobby details. Please try refreshing.");
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchLobby();

    return () => {
      ignore = true;
    };
  }, [accessToken, matchId]);

  // Background refresh callback for Realtime and manual retry
  const loadCanonicalState = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await fetchMatch(accessToken, matchId);
      setMatch(data.match);
      setParticipants(data.participants);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setError("You are not authorized to view this match lobby.");
        } else if (err.statusCode === 404) {
          setError("Match not found or invalid match identifier.");
        }
      }
    }
  }, [accessToken, matchId]);

  // Realtime hook: notifications strictly trigger canonical state refetch
  const { connectionState, refreshNow } = useMatchRealtime({
    matchId,
    accessToken: accessToken ?? null,
    onRefresh: loadCanonicalState,
    enabled: Boolean(accessToken && match?.status === "LOBBY"),
  });

  const currentParticipant = participants.find((p) => p.userId === user?.id);
  const isHost = match ? match.hostUserId === user?.id : false;
  const isLobby = match?.status === "LOBBY";
  const isCancelled = match?.status === "CANCELLED";

  const activeParticipants = participants.filter(
    (p) => !["SPECTATING", "WITHDRAWN"].includes(p.participationStatus)
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Match Lobby Unavailable
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            {error || "Unable to find the requested match session."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => void loadCanonicalState()}>
              Retry
            </Button>
            <Link href="/dashboard">
              <Button variant="primary">Return to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Cancellation Notice Banner */}
      {isCancelled && (
        <div className="mb-6">
          <Alert type="error" title="Match Cancelled">
            This match lobby was cancelled by the host. New participants cannot join and gameplay has terminated.
            <div className="mt-3">
              <Link href="/dashboard">
                <Button variant="secondary" className="text-xs py-1.5 px-3">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </Alert>
        </div>
      )}

      {/* Main Lobby Header */}
      <LobbyHeader
        match={match}
        activeCount={activeParticipants.length}
        connectionState={connectionState}
        onManualRefresh={refreshNow}
      />

      {/* Readiness Controls for Current Player */}
      {isLobby && (
        <LobbyReadinessToggle
          participant={currentParticipant}
          accessToken={session?.access_token ?? ""}
          isLobby={isLobby}
          onReadinessUpdated={(updated) => {
            setParticipants((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
          }}
        />
      )}

      {/* Host Controls */}
      {isHost && isLobby && (
        <HostSettingsPanel
          key={`${match.id}-${match.updatedAt}`}
          match={match}
          activeCount={activeParticipants.length}
          accessToken={session?.access_token ?? ""}
          onSettingsUpdated={(updated) => setMatch(updated)}
          onMatchCancelled={(cancelled) => setMatch(cancelled)}
        />
      )}

      {/* Participant Roster */}
      <LobbyRoster
        participants={participants}
        currentUserId={user?.id}
        maxPlayers={match.maxPlayers}
      />

      <div className="mt-8 text-center">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
