import type { ServerConfig } from "../config/index.js";
import type { AuthUser, UserProfile, UpdateProfileInput } from "../types/index.js";
import { getSupabaseAdminClient } from "../database/client.js";
import { AppError } from "../utils/errors.js";

export interface IProfileService {
  getProfileById(userId: string): Promise<UserProfile | null>;
  ensureProfile(user: AuthUser): Promise<UserProfile>;
  updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile>;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseProfileService implements IProfileService {
  constructor(private readonly config: ServerConfig) {}

  private getClient() {
    if (!this.config.supabase.isConfigured) {
      throw AppError.serviceUnavailable("Database service is not configured in this environment");
    }

    const client = getSupabaseAdminClient(this.config);
    if (!client) {
      throw AppError.serviceUnavailable("Database client could not be initialized");
    }

    return client;
  }

  async getProfileById(userId: string): Promise<UserProfile | null> {
    const client = this.getClient();

    const { data, error } = await client
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw AppError.internal(`Failed to fetch profile: ${error.message}`);
    }

    return data ? mapProfileRow(data as ProfileRow) : null;
  }

  async ensureProfile(user: AuthUser): Promise<UserProfile> {
    const existing = await this.getProfileById(user.id);
    if (existing) {
      return existing;
    }

    const client = this.getClient();

    // Derive display name from metadata or email
    const rawName =
      (user.metadata?.display_name as string) ||
      (user.metadata?.full_name as string) ||
      (user.email ? user.email.split("@")[0] : null) ||
      "Player";

    let displayName = rawName.trim();
    if (displayName.length < 2) {
      displayName = `${displayName}_player`;
    }
    if (displayName.length > 50) {
      displayName = displayName.substring(0, 50);
    }

    const avatarUrl = (user.metadata?.avatar_url as string) || null;

    const { data, error } = await client
      .from("profiles")
      .insert({
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      })
      .select("id, display_name, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      // If concurrent insert occurred, attempt re-fetch
      if (error.code === "23505") {
        const reFetched = await this.getProfileById(user.id);
        if (reFetched) return reFetched;
      }
      throw AppError.internal(`Failed to create user profile: ${error.message}`);
    }

    return mapProfileRow(data as ProfileRow);
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    const client = this.getClient();

    const updatePayload: Partial<ProfileRow> = {};
    if (data.displayName !== undefined) {
      const trimmed = data.displayName.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        throw AppError.badRequest("Display name must be between 2 and 50 characters");
      }
      updatePayload.display_name = trimmed;
    }

    if (data.avatarUrl !== undefined) {
      updatePayload.avatar_url = data.avatarUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
      const current = await this.getProfileById(userId);
      if (!current) {
        throw AppError.notFound("Profile not found");
      }
      return current;
    }

    const { data: updated, error } = await client
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, display_name, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw AppError.notFound("Profile not found");
      }
      throw AppError.internal(`Failed to update profile: ${error.message}`);
    }

    if (!updated) {
      throw AppError.notFound("Profile not found");
    }

    return mapProfileRow(updated as ProfileRow);
  }
}
