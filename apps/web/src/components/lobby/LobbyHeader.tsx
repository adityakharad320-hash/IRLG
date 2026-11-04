"use client";

import React, { useState } from "react";
import type { Match } from "../../types/api";
import type { RealtimeConnectionState } from "../../hooks/useMatchRealtime";

interface LobbyHeaderProps {
  match: Match;
  activeCount: number;
  connectionState: RealtimeConnectionState;
  onManualRefresh?: () => void;
}

export function LobbyHeader({
  match,
  activeCount,
  connectionState,
  onManualRefresh,
}: LobbyHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(match.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy invite code to clipboard:", err);
    }
  }

  const connectionPills = {
    connected: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Realtime
      </span>
    ),
    connecting: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300/40 dark:border-blue-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin" />
        Connecting...
      </span>
    ),
    reconnecting: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300/40 dark:border-amber-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Reconnecting...
      </span>
    ),
    disconnected: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        Offline
      </span>
    ),
    error: (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 border border-red-300/40 dark:border-red-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Realtime Disconnected
      </span>
    ),
  };

  const isLobby = match.status === "LOBBY";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                isLobby
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                  : match.status === "CANCELLED"
                  ? "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
              }`}
            >
              {match.status}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              Classic Manhunt v1.0
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Match Lobby
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {connectionPills[connectionState]}

          {onManualRefresh && (
            <button
              onClick={onManualRefresh}
              title="Refresh match canonical state"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              aria-label="Refresh match data"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        {/* Invite Code Box */}
        <div className="bg-zinc-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Shareable Invite Code
            </span>
            {isLobby ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Active & Joinable
              </span>
            ) : (
              <span className="text-xs text-zinc-400 font-medium">Expired</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 my-1">
            <div
              data-testid="invite-code-display"
              className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-zinc-900 dark:text-zinc-50 select-all"
            >
              {match.inviteCode}
            </div>

            <button
              onClick={handleCopyCode}
              disabled={!isLobby}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
              aria-label="Copy invite code"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Code
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Share this 6-character code with your friends to join this private lobby.
          </p>
        </div>

        {/* Match Settings Badges */}
        <div className="grid grid-cols-3 gap-3 items-center">
          <div className="bg-zinc-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 text-center">
            <span className="block text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400">
              Capacity
            </span>
            <span className="block text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
              {activeCount} / {match.maxPlayers}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-0.5">Active Players</span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 text-center">
            <span className="block text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400">
              Hunters
            </span>
            <span className="block text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
              {match.hunterCount}
            </span>
            <span className="block text-[11px] text-zinc-400 mt-0.5">Roles Hidden</span>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 text-center">
            <span className="block text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400">
              Duration
            </span>
            <span className="block text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
              {Math.round(match.matchDurationSeconds / 60)}m
            </span>
            <span className="block text-[11px] text-zinc-400 mt-0.5">
              {match.matchDurationSeconds}s total
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
