import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "../../components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account — IRLG",
  description: "Register for an IRLG multiplayer platform account",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg tracking-widest shadow-md shadow-emerald-600/30">
            IR
          </span>
          <span className="font-extrabold text-2xl tracking-tight text-zinc-900 dark:text-zinc-50">
            IRLG
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense
          fallback={
            <div className="p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl text-center text-zinc-500 animate-pulse">
              Loading registration portal...
            </div>
          }
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
