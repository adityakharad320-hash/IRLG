import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-50 dark:bg-black font-sans">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm tracking-widest shadow-sm shadow-emerald-600/30">
              IR
            </span>
            <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
              IRLG
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs sm:text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg transition-colors shadow-sm shadow-emerald-600/20"
            >
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-semibold mb-6 border border-emerald-300/40 dark:border-emerald-800/40">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Milestone 6: Frontend Authentication Complete
        </div>

        <h1 className="max-w-3xl text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight sm:leading-none">
          Real-World Multiplayer Gaming Platform
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Secure identity, cookie-based session persistence, and server-side authorization powered by Supabase Auth and Fastify.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/30"
          >
            Access Operator Dashboard &rarr;
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-sm transition-all"
          >
            Register New Operator
          </Link>
        </div>

        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          <span>Next.js 16 &bull; React 19</span>
          <span>Fastify 5 Backend</span>
          <span>Supabase SSR Authentication</span>
          <span>PostgreSQL Row Level Security</span>
        </div>
      </main>
    </div>
  );
}
