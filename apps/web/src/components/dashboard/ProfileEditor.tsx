"use client";

import React, { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "../../context/AuthContext";
import { updateCurrentUserProfile } from "../../lib/api/users";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

interface ProfileEditFormProps {
  initialDisplayName: string;
  initialAvatarUrl: string;
  session: Session | null;
  isProfileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

function ProfileEditForm({
  initialDisplayName,
  initialAvatarUrl,
  session,
  isProfileLoading,
  refreshProfile,
}: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  const [displayNameError, setDisplayNameError] = useState("");
  const [avatarUrlError, setAvatarUrlError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setDisplayNameError("");
    setAvatarUrlError("");
    setErrorMessage(null);
    setSuccessMessage(null);

    const nameTrimmed = displayName.trim();
    if (!nameTrimmed) {
      setDisplayNameError("Display name cannot be empty");
      isValid = false;
    } else if (nameTrimmed.length < 2 || nameTrimmed.length > 50) {
      setDisplayNameError("Display name must be between 2 and 50 characters");
      isValid = false;
    }

    if (avatarUrl.trim()) {
      try {
        new URL(avatarUrl.trim());
      } catch {
        setAvatarUrlError("Avatar URL must be a valid URL (e.g. https://...)");
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!session?.access_token) {
      setErrorMessage("Active session not found. Please log in again.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updateCurrentUserProfile(session.access_token, {
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      });

      setSuccessMessage("Profile updated successfully!");
      setDisplayName(updated.displayName);
      setAvatarUrl(updated.avatarUrl || "");
      await refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
        Edit Profile Information
      </h3>
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Updates are validated and saved directly via <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">PATCH /api/v1/users/me</code>
      </p>

      {successMessage && (
        <div className="mb-5">
          <Alert type="success" title="Success">
            {successMessage}
          </Alert>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5">
          <Alert type="error" title="Update Failed">
            {errorMessage}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4" noValidate>
        <Input
          label="Display Name"
          type="text"
          name="displayName"
          placeholder="OperatorAlias"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (displayNameError) setDisplayNameError("");
          }}
          helperText="2 to 50 characters"
          error={displayNameError}
          disabled={isSaving || isProfileLoading}
          required
        />

        <Input
          label="Avatar URL (Optional)"
          type="url"
          name="avatarUrl"
          placeholder="https://example.com/avatar.png"
          value={avatarUrl}
          onChange={(e) => {
            setAvatarUrl(e.target.value);
            if (avatarUrlError) setAvatarUrlError("");
          }}
          helperText="Must be a valid HTTPS image URL or left blank"
          error={avatarUrlError}
          disabled={isSaving || isProfileLoading}
        />

        <div className="pt-2 flex items-center justify-end gap-3">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            disabled={isSaving || isProfileLoading}
          >
            {isSaving ? "Saving Changes..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ProfileEditor() {
  const { user, session, profile, isProfileLoading, profileError, refreshProfile } = useAuth();

  const initialDisplayName =
    profile?.displayName || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const initialAvatarUrl = profile?.avatarUrl || "";

  return (
    <div className="space-y-6">
      {/* Account Identity Overview */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Operator Profile
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Identity synchronizing across Supabase Auth and Fastify backend
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                profileError ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
              {profileError ? "Backend Sync Alert" : "Backend Connected"}
            </span>
          </div>
        </div>

        {profileError && (
          <div className="mt-4">
            <Alert type="warning" title="Backend Profile Notice">
              {profileError}. Your auth session is valid, but the backend profile service could not be reached.{" "}
              <button
                type="button"
                onClick={() => void refreshProfile()}
                className="underline font-semibold hover:text-amber-800 dark:hover:text-amber-300 ml-1"
              >
                Retry sync
              </button>
            </Alert>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Account Email
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1 truncate">
              {user?.email || "—"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              User ID (auth.uid)
            </span>
            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 mt-1 truncate">
              {user?.id || "—"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Display Name
            </span>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              {profile?.displayName || "Loading..."}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Member Since
            </span>
            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 mt-1">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Modification Form */}
      <ProfileEditForm
        key={profile?.updatedAt || profile?.id || "initial"}
        initialDisplayName={initialDisplayName}
        initialAvatarUrl={initialAvatarUrl}
        session={session}
        isProfileLoading={isProfileLoading}
        refreshProfile={refreshProfile}
      />
    </div>
  );
}
