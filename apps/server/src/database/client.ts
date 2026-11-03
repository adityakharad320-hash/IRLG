import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServerConfig } from "../config/index.js";

let adminClientInstance: SupabaseClient | null = null;
let publicClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase admin client configured with the service-role key.
 * Used exclusively by backend services for authoritative operations.
 * Never expose this client or its credentials to frontend applications.
 */
export function getSupabaseAdminClient(config: ServerConfig): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return null;
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return adminClientInstance;
}

/**
 * Returns a standard Supabase client configured with the anon key.
 */
export function getSupabasePublicClient(config: ServerConfig): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.anonKey) {
    return null;
  }

  if (!publicClientInstance) {
    publicClientInstance = createClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return publicClientInstance;
}

/**
 * Reset client singletons (primarily useful for tests).
 */
export function resetSupabaseClients(): void {
  adminClientInstance = null;
  publicClientInstance = null;
}
