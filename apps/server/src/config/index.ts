import dotenv from "dotenv";
import { validateEnv, type ValidatedEnv } from "./env.js";

// Load .env file if available (safe no-op if not present)
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: "development" | "test" | "production";
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  apiPrefix: string;
  corsOrigin: string | string[];
  supabase: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    isConfigured: boolean;
  };
}

export function parseCorsOrigins(originString: string): string | string[] {
  if (originString.includes(",")) {
    return originString.split(",").map((item) => item.trim());
  }
  return originString.trim();
}

export function loadConfig(overrides: Partial<Record<string, unknown>> = {}): ServerConfig {
  const envInput = {
    ...process.env,
    ...overrides,
  };

  const validated: ValidatedEnv = validateEnv(envInput);

  const supabaseUrl = validated.SUPABASE_URL || undefined;
  const supabaseAnonKey = validated.SUPABASE_ANON_KEY || undefined;
  const supabaseServiceRoleKey = validated.SUPABASE_SERVICE_ROLE_KEY || undefined;

  const isSupabaseConfigured = Boolean(
    supabaseUrl && (supabaseServiceRoleKey || supabaseAnonKey)
  );

  return {
    port: validated.PORT,
    host: validated.HOST,
    nodeEnv: validated.NODE_ENV,
    logLevel: validated.LOG_LEVEL,
    apiPrefix: validated.API_PREFIX,
    corsOrigin: parseCorsOrigins(validated.CORS_ORIGIN),
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
      isConfigured: isSupabaseConfigured,
    },
  };
}

export const config = loadConfig();
