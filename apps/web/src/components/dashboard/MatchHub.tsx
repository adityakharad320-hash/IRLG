"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { createMatch, joinMatch, ApiError } from "../../lib/api/matches";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";

export function MatchHub() {
  const router = useRouter();
  const { session } = useAuth();

  // Create Match State
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [hunterCount, setHunterCount] = useState(2);
  const [durationSeconds, setDurationSeconds] = useState(1500);

  // Join Match State
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [asSpectator, setAsSpectator] = useState(false);

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) {
      setCreateError("You must be logged in to create a match");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const result = await createMatch(session.access_token, {
        maxPlayers,
        hunterCount,
        matchDurationSeconds: durationSeconds,
      });

      router.push(`/matches/${result.match.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.message);
      } else {
        setCreateError("Failed to create match lobby. Please try again.");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) {
      setJoinError("You must be logged in to join a match");
      return;
    }

    const trimmedCode = inviteCode.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      setJoinError("Invite code must be exactly 6 characters");
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      const participant = await joinMatch(session.access_token, {
        inviteCode: trimmedCode,
        asSpectator,
      });

      router.push(`/matches/${participant.matchId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setJoinError(err.message);
      } else {
        setJoinError("Failed to join match. Please check the code and try again.");
      }
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Classic Manhunt Multiplayer
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a private match lobby or join an existing session using an invite code.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Match Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Create Match Lobby
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                You will become host and receive a 6-character shareable code.
              </p>
            </div>
          </div>

          {createError && (
            <div className="mb-4">
              <Alert type="error" title="Creation Failed">
                {createError}
              </Alert>
            </div>
          )}

          <form onSubmit={handleCreateMatch} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="max-players-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Max Players (8–12)
                </label>
                <select
                  id="max-players-select"
                  aria-label="Max Players (8–12)"
                  value={maxPlayers}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxPlayers(val);
                    if (hunterCount >= val) {
                      setHunterCount(Math.min(val - 1, 3));
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {[8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} Players
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="hunter-count-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Hunters (2–3)
                </label>
                <select
                  id="hunter-count-select"
                  aria-label="Hunters (2–3)"
                  value={hunterCount}
                  onChange={(e) => setHunterCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {[2, 3]
                    .filter((h) => h < maxPlayers)
                    .map((h) => (
                      <option key={h} value={h}>
                        {h} Hunters
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="duration-select"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Match Duration
              </label>
              <select
                id="duration-select"
                aria-label="Match Duration"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value={1200}>20 Minutes (1,200s)</option>
                <option value={1500}>25 Minutes (1,500s — Standard)</option>
                <option value={1800}>30 Minutes (1,800s)</option>
              </select>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isCreating}
                className="w-full font-semibold"
              >
                Create Manhunt Match
              </Button>
            </div>
          </form>
        </div>

        {/* Join Match Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Join with Invite Code
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enter the 6-character uppercase code provided by the match host.
                </p>
              </div>
            </div>

            {joinError && (
              <div className="mb-4">
                <Alert type="error" title="Join Failed">
                  {joinError}
                </Alert>
              </div>
            )}

            <form onSubmit={handleJoinMatch} className="space-y-4">
              <Input
                label="6-Character Invite Code"
                placeholder="e.g. ABC123"
                value={inviteCode}
                maxLength={6}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-widest text-lg font-bold"
                helperText="Ask your host for the 6-character code"
              />

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="as-spectator"
                  checked={asSpectator}
                  onChange={(e) => setAsSpectator(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label
                  htmlFor="as-spectator"
                  className="text-xs text-zinc-600 dark:text-zinc-400 select-none cursor-pointer"
                >
                  Join as Spectator (does not occupy gameplay player slot)
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  isLoading={isJoining}
                  disabled={inviteCode.trim().length !== 6}
                  className="w-full font-semibold"
                >
                  Join Match Lobby
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            Classic Manhunt rules: 8–12 active players, 2–3 hunters. Once the lobby fills or starts, invite codes expire automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
