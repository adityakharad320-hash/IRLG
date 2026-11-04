import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "../../../lib/supabase/server";
import { DashboardHeader } from "../../../components/dashboard/DashboardHeader";
import { LobbyView } from "../../../components/lobby/LobbyView";

export const metadata: Metadata = {
  title: "Lobby — IRLG Classic Manhunt",
  description: "IRLG Multiplayer Match Lobby",
};

interface MatchPageProps {
  params: Promise<{ matchId: string }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/matches/${matchId}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col">
      <DashboardHeader />
      <main className="flex-1">
        <LobbyView matchId={matchId} />
      </main>
    </div>
  );
}
