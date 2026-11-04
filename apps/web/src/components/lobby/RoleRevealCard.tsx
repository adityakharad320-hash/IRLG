"use client";

import React from "react";
import type { GameplayRole } from "../../types/api";

interface RoleRevealCardProps {
  role: GameplayRole | null;
  isSpectator?: boolean;
  isLoading?: boolean;
}

export function RoleRevealCard({ role, isSpectator = false, isLoading = false }: RoleRevealCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm animate-pulse text-center">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mx-auto mb-4" />
        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mx-auto mb-4" />
        <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mx-auto" />
      </div>
    );
  }

  const isHunter = role === "HUNTER";
  const isRunner = role === "RUNNER";

  return (
    <div
      data-testid="role-reveal-card"
      className={`rounded-2xl p-6 md:p-8 border shadow-lg transition-all ${
        isHunter
          ? "bg-gradient-to-b from-red-950/40 via-zinc-900 to-zinc-900 border-red-500/50 text-white shadow-red-950/30"
          : isRunner
          ? "bg-gradient-to-b from-emerald-950/40 via-zinc-900 to-zinc-900 border-emerald-500/50 text-white shadow-emerald-950/30"
          : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
      }`}
    >
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border bg-black/20 backdrop-blur-sm border-white/10">
          <span
            className={`w-2 h-2 rounded-full ${
              isHunter ? "bg-red-500 animate-ping" : isRunner ? "bg-emerald-400 animate-ping" : "bg-purple-400"
            }`}
          />
          Private Role Assignment
        </div>

        {isHunter && (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <path strokeWidth="2" d="M12 3v4m0 10v4m-9-9h4m10 0h4m-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-red-400 mb-2">
              YOU ARE A HUNTER
            </h2>
            <p className="text-sm md:text-base text-zinc-300 max-w-md mx-auto mb-6">
              Track down and tag all Runners before the match duration expires.
            </p>

            <div className="bg-red-950/60 border border-red-800/60 rounded-xl p-4 max-w-lg mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="text-red-400 font-bold text-lg leading-none">⚠️</span>
                <div className="text-xs md:text-sm text-red-200">
                  <p className="font-semibold text-red-300 mb-1">
                    45-Second Runner Head Start in Effect
                  </p>
                  Runners will receive a 45-second head start when the countdown starts. You must hold your
                  starting position until your timer hits zero and Hunters are officially released!
                </div>
              </div>
            </div>
          </div>
        )}

        {isRunner && (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-400 mb-2">
              YOU ARE A RUNNER
            </h2>
            <p className="text-sm md:text-base text-zinc-300 max-w-md mx-auto mb-6">
              Evade the Hunters, scatter into the game zone, and survive the full match duration.
            </p>

            <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-4 max-w-lg mx-auto text-left">
              <div className="flex items-start gap-3">
                <span className="text-emerald-400 font-bold text-lg leading-none">⚡</span>
                <div className="text-xs md:text-sm text-emerald-200">
                  <p className="font-semibold text-emerald-300 mb-1">
                    45-Second Head Start Advantage
                  </p>
                  You will have a 45-second head start to disperse and conceal yourself before the Hunters are
                  released into the field.
                </div>
              </div>
            </div>
          </div>
        )}

        {!isHunter && !isRunner && isSpectator && (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
              SPECTATOR MODE
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              You are watching this match in spectator mode. You do not participate in active gameplay.
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 text-xs text-zinc-400 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Strict Role Privacy: Only you can see this assignment. Neither other players nor the host can see your role.
        </div>
      </div>
    </div>
  );
}
