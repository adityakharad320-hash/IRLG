import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "../../lib/supabase/server";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { ProfileEditor } from "../../components/dashboard/ProfileEditor";
import { MatchHub } from "../../components/dashboard/MatchHub";

export const metadata: Metadata = {
  title: "Dashboard — IRLG",
  description: "IRLG Operator Dashboard",
};

export default async function DashboardPage() {
  // Validate session server-side before rendering protected page
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const initialDisplayName =
    user.user_metadata?.display_name || user.email?.split("@")[0] || "Operator";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Welcome back, {initialDisplayName}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Operator account active &bull; Supabase Auth verified
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Session Authenticated
              </span>
            </div>
          </div>
        </div>

        <MatchHub />

        <div className="my-8 border-t border-zinc-200 dark:border-zinc-800" />

        <ProfileEditor />
      </main>
    </div>
  );
}
