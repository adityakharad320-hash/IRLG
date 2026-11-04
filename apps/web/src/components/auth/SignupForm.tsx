"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [displayNameError, setDisplayNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setDisplayNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setFormError(null);

    const nameTrimmed = displayName.trim();
    if (!nameTrimmed) {
      setDisplayNameError("Display name is required");
      isValid = false;
    } else if (nameTrimmed.length < 2 || nameTrimmed.length > 50) {
      setDisplayNameError("Display name must be between 2 and 50 characters");
      isValid = false;
    }

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setEmailError("Email is required");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError("Please enter a valid email address");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password");
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
          emailRedirectTo,
        },
      });

      if (error) {
        setFormError(error.message);
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // If email confirmation is disabled or immediate session issued
        router.push("/dashboard");
        router.refresh();
      } else {
        // Standard flow: email confirmation required
        setRegisteredEmail(email.trim());
        setIsSuccess(true);
        setIsLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setFormError(msg);
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          Verify Your Email
        </h3>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
          We&apos;ve sent a verification link to{" "}
          <strong className="text-zinc-900 dark:text-zinc-200 font-semibold">
            {registeredEmail}
          </strong>
          . Please check your inbox (and spam folder) and click the link to activate your IRLG operator account.
        </p>

        <div className="space-y-3">
          <Link
            href="/login?message=Email+verified+accounts+can+now+sign+in"
            className="block w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-sm transition-colors text-center shadow-sm"
          >
            Return to Login
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsSuccess(false);
              setPassword("");
              setConfirmPassword("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Entered wrong email? Register again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Create IRLG Account
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Join the real-world multiplayer platform
        </p>
      </div>

      {formError && (
        <div className="mb-5">
          <Alert type="error" title="Registration Failed">
            {formError}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Display Name"
          type="text"
          name="displayName"
          autoComplete="nickname"
          placeholder="ShadowRunner"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (displayNameError) setDisplayNameError("");
          }}
          helperText="2 to 50 characters, public player identifier"
          error={displayNameError}
          disabled={isLoading}
          required
        />

        <Input
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="operator@irlg.gg"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          error={emailError}
          disabled={isLoading}
          required
        />

        <Input
          label="Password"
          isPassword
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError("");
          }}
          helperText="At least 6 characters"
          error={passwordError}
          disabled={isLoading}
          required
        />

        <Input
          label="Confirm Password"
          isPassword
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (confirmPasswordError) setConfirmPasswordError("");
          }}
          error={confirmPasswordError}
          disabled={isLoading}
          required
        />

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          disabled={isLoading}
          className="w-full mt-2"
        >
          {isLoading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
