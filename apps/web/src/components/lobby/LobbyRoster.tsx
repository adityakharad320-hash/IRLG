"use client";

import React from "react";
import type { MatchParticipant } from "../../types/api";

interface LobbyRosterProps {
  participants: MatchParticipant[];
  currentUserId?: string;
  maxPlayers: number;
}

export function LobbyRoster({
  participants,
  currentUserId,
  maxPlayers,
}: LobbyRosterProps) {
  const activeParticipants = participants.filter(
    (p) => !["SPECTATING", "WITHDRAWN"].includes(p.participationStatus)
  );

  const readyCount = activeParticipants.filter(
    (p) => p.participationStatus === "READY"
  ).length;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Participant Roster ({participants.length})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {activeParticipants.length} of {maxPlayers} active player slots filled &bull; {readyCount} ready
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {readyCount} / {activeParticipants.length} Players Ready
          </span>
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {participants.map((participant) => {
          const isCurrentUser = participant.userId === currentUserId;
          const isHost = participant.isHost;
          const isSpectator = participant.participationStatus === "SPECTATING";
          const isReady = participant.participationStatus === "READY";

          const displayName = participant.displayName || `Player_${participant.userId.slice(0, 6)}`;
          const initial = displayName.charAt(0).toUpperCase();

          return (
            <div
              key={participant.id}
              className={`py-3.5 px-3 flex items-center justify-between rounded-lg transition-colors ${
                isCurrentUser
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                  : "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar Icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                    isCurrentUser
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {initial}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {displayName}
                    </span>

                    {isCurrentUser && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/40">
                        YOU
                      </span>
                    )}

                    {isHost && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300/40">
                        HOST
                      </span>
                    )}

                    {isSpectator && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300/40">
                        SPECTATOR
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-zinc-400">
                    Joined {new Date(participant.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              {/* Readiness status */}
              <div>
                {isSpectator ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Spectating
                  </span>
                ) : isReady ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-800/40">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    READY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    NOT READY
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {participants.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-500">
            No participants have joined this lobby yet.
          </div>
        )}
      </div>
    </div>
  );
}
