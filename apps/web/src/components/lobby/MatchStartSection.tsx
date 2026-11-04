"use client";

import React, { useState } from "react";
import type { Match, MatchParticipant } from "../../types/api";
import { startMatchPreparation, ApiError } from "../../lib/api/matches";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface MatchStartSectionProps {
  match: Match;
  participants: MatchParticipant[];
  isHost: boolean;
  accessToken: string;
  onPreparationStarted: (match: Match, participants: MatchParticipant[]) => void;
}

export function MatchStartSection({
  match,
  participants,
  isHost,
  accessToken,
  onPreparationStarted,
}: MatchStartSectionProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeParticipants = participants.filter(
    (p) => !["SPECTATING", "WITHDRAWN"].includes(p.participationStatus)
  );

  const readyParticipants = activeParticipants.filter(
    (p) => p.participationStatus === "READY"
  );

  const hasMinPlayers = activeParticipants.length >= 8;
  const hasValidOccupancy = activeParticipants.length <= match.maxPlayers;
  const allReady = activeParticipants.length > 0 && readyParticipants.length === activeParticipants.length;
  const hasValidHunterCount = match.hunterCount < activeParticipants.length;

  const isEligibleToStart = hasMinPlayers && hasValidOccupancy && allReady && hasValidHunterCount;

  const handleStartMatch = async () => {
    if (!isHost || !isEligibleToStart || isStarting) return;

    setIsStarting(true);
    setErrorMessage(null);

    try {
      const data = await startMatchPreparation(accessToken, match.id);
      onPreparationStarted(data.match, data.participants);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to start match preparation. Please check connection and retry.");
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      data-testid="match-start-section"
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Match Start Readiness
            {isEligibleToStart ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                Ready to Start
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                Awaiting Eligibility
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            All players must be ready and minimum occupancy satisfied before the host can launch preparation.
          </p>
        </div>

        {isHost && (
          <Button
            data-testid="start-match-btn"
            variant="primary"
            disabled={!isEligibleToStart || isStarting}
            isLoading={isStarting}
            onClick={() => void handleStartMatch()}
            className={`w-full sm:w-auto px-6 py-2.5 font-bold shadow-md ${
              isEligibleToStart
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                : "opacity-60 cursor-not-allowed"
            }`}
          >
            {isStarting ? "Starting Preparation..." : "Start Match Preparation"}
          </Button>
        )}
      </div>

      {errorMessage && (
        <div className="mb-4">
          <Alert type="error" title="Start Failed">
            {errorMessage}
          </Alert>
        </div>
      )}

      {/* Eligibility Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
              hasMinPlayers
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
            }`}
          >
            {hasMinPlayers ? "✓" : "✗"}
          </span>
          <span className="text-zinc-700 dark:text-zinc-300">
            Player Count: <strong>{activeParticipants.length}</strong> / 8 minimum required
            {!hasMinPlayers && (
              <span className="text-red-500 ml-1">({8 - activeParticipants.length} more needed)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
              allReady
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
            }`}
          >
            {allReady ? "✓" : "✗"}
          </span>
          <span className="text-zinc-700 dark:text-zinc-300">
            Player Readiness: <strong>{readyParticipants.length}</strong> / {activeParticipants.length} ready
            {!allReady && (
              <span className="text-red-500 ml-1">
                ({activeParticipants.length - readyParticipants.length} not ready)
              </span>
            )}
          </span>
        </div>
      </div>

      {!isHost && !isEligibleToStart && (
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl text-xs text-zinc-600 dark:text-zinc-400">
          Waiting for all players to set status to <strong>READY</strong>. The host will launch the match once requirements are fulfilled.
        </div>
      )}
    </div>
  );
}
