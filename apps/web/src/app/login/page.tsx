import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../../components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In — IRLG",
  description: "Sign in to your IRLG operator account",
};

export default function LoginPage() {
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
              Loading login portal...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
