"use client";

import React, { useState } from "react";
import type { MatchParticipant } from "../../types/api";
import { updateReadiness, ApiError } from "../../lib/api/matches";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface LobbyReadinessToggleProps {
  participant: MatchParticipant | undefined;
  accessToken: string;
  isLobby: boolean;
  onReadinessUpdated: (updated: MatchParticipant) => void;
}

export function LobbyReadinessToggle({
  participant,
  accessToken,
  isLobby,
  onReadinessUpdated,
}: LobbyReadinessToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!participant) {
    return null;
  }

  const isSpectator = participant.participationStatus === "SPECTATING";
  const isReady = participant.participationStatus === "READY";

  if (isSpectator) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          You joined as a <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">Spectator</strong>. Spectators do not consume active player slots and are not required to toggle readiness.
        </p>
      </div>
    );
  }

  async function handleToggleReadiness() {
    if (!participant || !isLobby) return;

    setError(null);
    setIsLoading(true);

    const nextStatus = isReady ? "JOINED" : "READY";

    try {
      const updated = await updateReadiness(
        accessToken,
        participant.matchId,
        nextStatus
      );
      onReadinessUpdated(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update readiness. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Player Readiness
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {isReady
              ? "You are marked READY. When all players are ready, the host can begin the match."
              : "Mark yourself READY when you are set to start Classic Manhunt."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={isReady ? "secondary" : "primary"}
            isLoading={isLoading}
            disabled={!isLobby}
            onClick={handleToggleReadiness}
            className="w-full sm:w-auto px-6 font-semibold"
          >
            {isReady ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Mark Not Ready
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                I&apos;m Ready
              </span>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert type="error" title="Readiness Update Failed">
            {error}
          </Alert>
        </div>
      )}
    </div>
  );
}
