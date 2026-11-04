"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Match, GameplayRole } from "../../types/api";
import { fetchMyRole, fetchMatchTiming, advanceMatchPhase, ApiError } from "../../lib/api/matches";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface MatchCountdownViewProps {
  match: Match;
  currentUserId?: string;
  isHost: boolean;
  accessToken: string;
  onMatchUpdated: (updated: Match) => void;
}

export function MatchCountdownView({
  match,
  isHost,
  accessToken,
  onMatchUpdated,
}: MatchCountdownViewProps) {
  const [role, setRole] = useState<GameplayRole | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    match.runnerHeadStartSeconds ?? 45
  );
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch caller's private role
  useEffect(() => {
    let ignore = false;
    async function loadRole() {
      if (!accessToken || !match.id) return;
      try {
        const data = await fetchMyRole(accessToken, match.id);
        if (!ignore) {
          setRole(data.role);
        }
      } catch {
        // Fallback to null role
      }
    }
    void loadRole();
    return () => {
      ignore = true;
    };
  }, [accessToken, match.id]);

  // 2. Fetch canonical timing from backend
  const syncTiming = useCallback(async () => {
    if (!accessToken || !match.id) return;
    try {
      const data = await fetchMatchTiming(accessToken, match.id);
      if (data.status !== "COUNTDOWN") {
        onMatchUpdated({ ...match, status: data.status });
      }
      if (data.phaseRemainingSeconds !== null) {
        setRemainingSeconds(data.phaseRemainingSeconds);
      }
    } catch {
      // Graceful local fallback
    }
  }, [accessToken, match, onMatchUpdated]);

  useEffect(() => {
    let ignore = false;
    async function initTiming() {
      if (!accessToken || !match.id) return;
      try {
        const data = await fetchMatchTiming(accessToken, match.id);
        if (!ignore) {
          if (data.status !== "COUNTDOWN") {
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

  // 3. 1-second interval ticker for countdown
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

  // 4. Host manual advance to Active once head-start finishes
  const handleAdvanceToActive = async () => {
    if (!isHost || isAdvancing) return;

    setIsAdvancing(true);
    setAdvanceError(null);

    try {
      const updatedMatch = await advanceMatchPhase(accessToken, match.id, "ACTIVE");
      onMatchUpdated(updatedMatch);
    } catch (err) {
      if (err instanceof ApiError) {
        setAdvanceError(err.message);
      } else {
        setAdvanceError("Failed to transition match to active. Please retry.");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const isHunter = role === "HUNTER";
  const isRunner = role === "RUNNER";

  return (
    <div
      data-testid="match-countdown-view"
      className="max-w-3xl mx-auto space-y-6 text-center py-6"
    >
      {/* Dynamic Status Banner */}
      {isHunter && (
        <div
          data-testid="hunter-countdown-banner"
          className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-6 text-white shadow-xl shadow-red-950/40 animate-pulse"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600/40 text-red-300 border border-red-500/40 mb-3">
            ⚠️ Attention Hunters
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-red-300 mb-2">
            HOLD YOUR POSITION!
          </h2>
          <p className="text-sm md:text-base text-zinc-300 max-w-lg mx-auto">
            Runners have a <strong>45-second head start</strong> to escape the staging area. You are
            locked in place. Do NOT cross the perimeter until the countdown finishes!
          </p>
        </div>
      )}

      {isRunner && (
        <div
          data-testid="runner-countdown-banner"
          className="bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl p-6 text-white shadow-xl shadow-emerald-950/40 animate-pulse"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 mb-3">
            ⚡ Runner Head Start
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-emerald-300 mb-2">
            RUN! DISPERSE INTO THE ZONE!
          </h2>
          <p className="text-sm md:text-base text-zinc-300 max-w-lg mx-auto">
            You have a <strong>45-second head start</strong>. The Hunters are frozen in place. Use
            this time to scatter, find cover, and establish hiding spots!
          </p>
        </div>
      )}

      {!isHunter && !isRunner && (
        <div className="bg-purple-950/60 border border-purple-500/50 rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-black text-purple-300 mb-2">
            Runner Head Start in Progress
          </h2>
          <p className="text-sm text-zinc-300">
            Runners are dispersing into the field. Hunters will be released when the countdown hits zero.
          </p>
        </div>
      )}

      {/* Large Countdown Display */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
        <div className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold mb-2">
          {isHunter ? "Hunter Release Countdown" : "Head Start Time Remaining"}
        </div>
        <div
          data-testid="head-start-timer"
          className={`text-7xl md:text-8xl font-black font-mono tracking-tight my-4 ${
            remainingSeconds <= 5
              ? "text-red-500 animate-bounce"
              : isHunter
              ? "text-red-400"
              : isRunner
              ? "text-emerald-400"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {remainingSeconds}s
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          {remainingSeconds > 0
            ? "Server-authoritative timer synchronized with backend engine."
            : "Head start complete! Transitioning to active match..."}
        </div>
      </div>

      {/* Host Advance Action if Countdown Reached 0 */}
      {isHost && remainingSeconds === 0 && (
        <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
            45-second head start complete. If the match has not auto-transitioned, click to start:
          </p>
          <Button
            data-testid="release-hunters-btn"
            variant="primary"
            disabled={isAdvancing}
            isLoading={isAdvancing}
            onClick={() => void handleAdvanceToActive()}
            className="px-6 py-2.5 font-bold bg-emerald-600 hover:bg-emerald-500"
          >
            Release Hunters & Start Match
          </Button>
        </div>
      )}

      {advanceError && (
        <Alert type="error" title="Start Failed">
          {advanceError}
        </Alert>
      )}
    </div>
  );
}
