"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Match, GameplayRole } from "../../types/api";
import { fetchMyRole, fetchMatchTiming } from "../../lib/api/matches";

interface MatchActiveViewProps {
  match: Match;
  currentUserId?: string;
  accessToken: string;
}

export function MatchActiveView({
  match,
  accessToken,
}: MatchActiveViewProps) {
  const [role, setRole] = useState<GameplayRole | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    match.matchDurationSeconds ?? 1500
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch caller's private role
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

  // Fetch canonical timing on mount
  useEffect(() => {
    let ignore = false;
    async function initTiming() {
      if (!accessToken || !match.id) return;
      try {
        const data = await fetchMatchTiming(accessToken, match.id);
        if (!ignore && data.matchRemainingSeconds !== null) {
          setRemainingSeconds(data.matchRemainingSeconds);
        }
      } catch {
        // Fallback
      }
    }
    void initTiming();
    return () => {
      ignore = true;
    };
  }, [accessToken, match.id]);

  // Local ticker
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isHunter = role === "HUNTER";
  const isRunner = role === "RUNNER";

  return (
    <div
      data-testid="match-active-view"
      className="max-w-3xl mx-auto space-y-6 text-center py-6"
    >
      <div className="bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Match Live & Active
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
          HUNT IN PROGRESS
        </h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-md mx-auto mb-6">
          Hunters are released! Full tracking and evasion gameplay is now in effect.
        </p>

        {/* User Role Reminder */}
        {role && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-black/40 mb-6 text-sm font-bold">
            <span className="text-zinc-400">Your Role:</span>
            <span className={isHunter ? "text-red-400" : isRunner ? "text-emerald-400" : "text-zinc-300"}>
              {role}
            </span>
          </div>
        )}

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 max-w-sm mx-auto">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-1">
            Match Time Remaining
          </div>
          <div
            data-testid="active-match-timer"
            className="text-5xl md:text-6xl font-mono font-black text-emerald-400"
          >
            {formatTime(remainingSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
