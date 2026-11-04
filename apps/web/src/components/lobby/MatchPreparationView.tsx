"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Match, MatchParticipant, GameplayRole } from "../../types/api";
import { fetchMyRole, fetchMatchTiming, advanceMatchPhase, ApiError } from "../../lib/api/matches";
import { RoleRevealCard } from "./RoleRevealCard";
import { LobbyRoster } from "./LobbyRoster";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface MatchPreparationViewProps {
  match: Match;
  participants: MatchParticipant[];
  currentUserId?: string;
  isHost: boolean;
  accessToken: string;
  onMatchUpdated: (updated: Match) => void;
}

export function MatchPreparationView({
  match,
  participants,
  currentUserId,
  isHost,
  accessToken,
  onMatchUpdated,
}: MatchPreparationViewProps) {
  const [role, setRole] = useState<GameplayRole | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    match.preparationDurationSeconds ?? 300
  );
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch private role assignment securely
  useEffect(() => {
    let ignore = false;

    async function loadRole() {
      if (!accessToken || !match.id) return;
      try {
        const data = await fetchMyRole(accessToken, match.id);
        if (!ignore) {
          setRole(data.role);
          setIsSpectator(Boolean(data.isSpectator));
          setRoleError(null);
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiError) {
            setRoleError(err.message);
          } else {
            setRoleError("Failed to retrieve assigned role. Please refresh.");
          }
        }
      } finally {
        if (!ignore) {
          setIsLoadingRole(false);
        }
      }
    }

    void loadRole();

    return () => {
      ignore = true;
    };
  }, [accessToken, match.id]);

  // 2. Fetch canonical timing from server
  const syncTiming = useCallback(async () => {
    if (!accessToken || !match.id) return;
    try {
      const data = await fetchMatchTiming(accessToken, match.id);
      if (data.status !== "PREPARING") {
        onMatchUpdated({ ...match, status: data.status });
      }
      if (data.phaseRemainingSeconds !== null) {
        setRemainingSeconds(data.phaseRemainingSeconds);
      }
    } catch {
      // Graceful fallback to local countdown
    }
  }, [accessToken, match, onMatchUpdated]);

  useEffect(() => {
    let ignore = false;
    async function initTiming() {
      if (!accessToken || !match.id) return;
      try {
        const data = await fetchMatchTiming(accessToken, match.id);
        if (!ignore) {
          if (data.status !== "PREPARING") {
            onMatchUpdated({ ...match, status: data.status });
          }
          if (data.phaseRemainingSeconds !== null) {
            setRemainingSeconds(data.phaseRemainingSeconds);
          }
        }
      } catch {
        // Fallback
      }
    }
    void initTiming();
    return () => {
      ignore = true;
    };
  }, [accessToken, match, onMatchUpdated]);

  // 3. Local countdown timer synced with server
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          void syncTiming();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [syncTiming]);

  // 4. Host manual advance to Countdown (Runner Head Start)
  const handleAdvanceToCountdown = async () => {
    if (!isHost || isAdvancing) return;

    setIsAdvancing(true);
    setAdvanceError(null);

    try {
      const updatedMatch = await advanceMatchPhase(accessToken, match.id, "COUNTDOWN");
      onMatchUpdated(updatedMatch);
    } catch (err) {
      if (err instanceof ApiError) {
        setAdvanceError(err.message);
      } else {
        setAdvanceError("Failed to advance to countdown. Please retry.");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div data-testid="match-preparation-view" className="space-y-6">
      {/* Preparation Phase Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Phase 1: Match Preparation
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              Preparation & Strategy Window
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Memorize your role and objectives. Review starting areas and ready your equipment.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-5 py-3">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                Prep Time Remaining
              </div>
              <div
                data-testid="prep-timer"
                className="text-3xl font-mono font-black text-zinc-900 dark:text-zinc-100"
              >
                {formatTime(remainingSeconds)}
              </div>
            </div>
          </div>
        </div>

        {isHost && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Host Control: You can advance to the 45-second Runner head start once players are ready.
            </div>
            <Button
              data-testid="advance-to-countdown-btn"
              variant="primary"
              disabled={isAdvancing}
              isLoading={isAdvancing}
              onClick={() => void handleAdvanceToCountdown()}
              className="w-full sm:w-auto px-5 py-2 font-bold"
            >
              {isAdvancing ? "Starting Countdown..." : "Begin Runner Head Start (Countdown)"}
            </Button>
          </div>
        )}

        {advanceError && (
          <div className="mt-4">
            <Alert type="error" title="Advance Failed">
              {advanceError}
            </Alert>
          </div>
        )}
      </div>

      {roleError && (
        <Alert type="error" title="Role Retrieval Issue">
          {roleError}
        </Alert>
      )}

      {/* Role Reveal Card */}
      <RoleRevealCard role={role} isSpectator={isSpectator} isLoading={isLoadingRole} />

      {/* Participant Roster with Roles Strictly Hidden */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Match Roster ({participants.length} Players)
          </h3>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Roles Classified
          </span>
        </div>
        <LobbyRoster
          participants={participants}
          currentUserId={currentUserId}
          maxPlayers={match.maxPlayers}
        />
      </div>
    </div>
  );
}
