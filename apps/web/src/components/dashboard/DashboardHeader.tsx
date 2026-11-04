"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";

export function DashboardHeader() {
  const { user, profile, signOut, isLoading } = useAuth();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm tracking-widest shadow-sm shadow-emerald-600/30">
              IR
            </span>
            <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
              IRLG
            </span>
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-medium">
            Platform Alpha
          </span>
        </div>

        <div className="flex items-center gap-4">
          {!isLoading && user && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {profile?.displayName || user.email?.split("@")[0] || "Operator"}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {user.email}
              </span>
            </div>
          )}

          <Button
            variant="secondary"
            onClick={signOut}
            className="text-xs py-1.5 px-3"
          >
            Log Out
          </Button>
        </div>
      </div>
    </header>
  );
}
