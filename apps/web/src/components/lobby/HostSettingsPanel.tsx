"use client";

import React, { useState } from "react";
import type { Match } from "../../types/api";
import { updateMatchSettings, cancelMatch, ApiError } from "../../lib/api/matches";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface HostSettingsPanelProps {
  match: Match;
  activeCount: number;
  accessToken: string;
  onSettingsUpdated: (updated: Match) => void;
  onMatchCancelled: (cancelled: Match) => void;
}

export function HostSettingsPanel({
  match,
  activeCount,
  accessToken,
  onSettingsUpdated,
  onMatchCancelled,
}: HostSettingsPanelProps) {
  const [maxPlayers, setMaxPlayers] = useState(match.maxPlayers);
  const [hunterCount, setHunterCount] = useState(match.hunterCount);
  const [durationSeconds, setDurationSeconds] = useState(match.matchDurationSeconds);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const minAllowedPlayers = Math.max(8, activeCount);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (maxPlayers < minAllowedPlayers) {
      setSaveError(
        `Cannot reduce max players (${maxPlayers}) below current active participants (${activeCount})`
      );
      return;
    }

    if (hunterCount >= maxPlayers) {
      setSaveError("Hunters count must be strictly less than max players");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateMatchSettings(accessToken, match.id, {
        maxPlayers,
        hunterCount,
        matchDurationSeconds: durationSeconds,
      });

      onSettingsUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError("Failed to update settings. Please check constraints and try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmCancel() {
    setCancelError(null);
    setIsCancelling(true);

    try {
      const cancelled = await cancelMatch(accessToken, match.id);
      setShowCancelModal(false);
      onMatchCancelled(cancelled);
    } catch (err) {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError("Failed to cancel match lobby.");
      }
    } finally {
      setIsCancelling(false);
    }
  }

  const isLobby = match.status === "LOBBY";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              HOST CONTROLS
            </span>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Lobby Configuration
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Modify match parameters or cancel the session. Capacity floor is enforced against current active occupancy.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-4">
          <Alert type="success" title="Settings Saved">
            Lobby configuration updated successfully.
          </Alert>
        </div>
      )}

      {saveError && (
        <div className="mb-4">
          <Alert type="error" title="Update Failed">
            {saveError}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="host-max-players"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Capacity (8–12)
            </label>
            <select
              id="host-max-players"
              aria-label="Capacity (8–12)"
              disabled={!isLobby || isSaving}
              value={maxPlayers}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxPlayers(val);
                if (hunterCount >= val) {
                  setHunterCount(Math.min(val - 1, 3));
                }
              }}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
            >
              {[8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n} disabled={n < minAllowedPlayers}>
                  {n} Players {n < minAllowedPlayers ? `(below current ${activeCount})` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              Minimum: {minAllowedPlayers} based on active roster
            </p>
          </div>

          <div>
            <label
              htmlFor="host-hunter-count"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Hunters (2–3)
            </label>
            <select
              id="host-hunter-count"
              aria-label="Hunters (2–3)"
              disabled={!isLobby || isSaving}
              value={hunterCount}
              onChange={(e) => setHunterCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
            >
              {[2, 3]
                .filter((h) => h < maxPlayers)
                .map((h) => (
                  <option key={h} value={h}>
                    {h} Hunters
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              Must be strictly less than capacity
            </p>
          </div>

          <div>
            <label
              htmlFor="host-match-duration"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Duration (20–30 min)
            </label>
            <select
              id="host-match-duration"
              aria-label="Duration (20–30 min)"
              disabled={!isLobby || isSaving}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
            >
              <option value={1200}>20 Minutes (1,200s)</option>
              <option value={1500}>25 Minutes (1,500s — Standard)</option>
              <option value={1800}>30 Minutes (1,800s)</option>
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              Excludes 5m prep and 45s head start
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            disabled={!isLobby}
            className="w-full sm:w-auto font-semibold"
          >
            Save Lobby Settings
          </Button>

          <Button
            type="button"
            variant="danger"
            disabled={!isLobby}
            onClick={() => setShowCancelModal(true)}
            className="w-full sm:w-auto"
          >
            Cancel Match
          </Button>
        </div>
      </form>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Cancel Match Lobby?
                </h3>
                <p className="text-xs text-zinc-500">Action is irreversible</p>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              Cancelling this match will terminate the lobby immediately. All participants will be notified and the invite code will be permanently invalidated.
            </p>

            {cancelError && (
              <div className="mb-4">
                <Alert type="error" title="Cancellation Failed">
                  {cancelError}
                </Alert>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isCancelling}
                onClick={() => setShowCancelModal(false)}
              >
                Keep Lobby
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isCancelling}
                onClick={handleConfirmCancel}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
