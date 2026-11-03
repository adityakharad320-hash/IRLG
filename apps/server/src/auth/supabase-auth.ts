import type { ServerConfig } from "../config/index.js";
import type { AuthUser } from "../types/index.js";
import { getSupabaseAdminClient, getSupabasePublicClient } from "../database/client.js";
import { AppError } from "../utils/errors.js";

export interface IAuthService {
  verifyToken(token: string): Promise<AuthUser>;
}

export class SupabaseAuthService implements IAuthService {
  constructor(private readonly config: ServerConfig) {}

  async verifyToken(token: string): Promise<AuthUser> {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw AppError.unauthorized("Authentication token is missing or malformed");
    }

    if (!this.config.supabase.isConfigured) {
      throw AppError.unauthorized("Authentication service is not configured in this environment");
    }

    const client =
      getSupabaseAdminClient(this.config) ?? getSupabasePublicClient(this.config);

    if (!client) {
      throw AppError.unauthorized("Authentication client is unavailable");
    }

    try {
      const { data, error } = await client.auth.getUser(token);

      if (error || !data.user) {
        throw AppError.unauthorized(
          error?.message ?? "Invalid or expired authentication token"
        );
      }

      return {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        metadata: data.user.user_metadata,
      };
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "Authentication failed";
      throw AppError.unauthorized(message);
    }
  }
}
