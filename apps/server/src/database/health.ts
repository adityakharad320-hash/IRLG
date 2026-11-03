import type { ServerConfig } from "../config/index.js";

export interface DatabaseHealthResult {
  status: "healthy" | "unhealthy" | "unconfigured";
  latencyMs?: number;
  message?: string;
}

export async function checkDatabaseHealth(config: ServerConfig): Promise<DatabaseHealthResult> {
  if (!config.supabase.isConfigured || !config.supabase.url) {
    return {
      status: "unconfigured",
      message: "Supabase credentials not configured in environment",
    };
  }

  const key = config.supabase.serviceRoleKey || config.supabase.anonKey;
  if (!key) {
    return {
      status: "unconfigured",
      message: "Supabase key not configured in environment",
    };
  }

  const start = performance.now();
  try {
    // Probe real PostgREST connectivity with a 5000ms timeout
    const response = await fetch(`${config.supabase.url}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Math.round(performance.now() - start);

    if (response.ok) {
      return {
        status: "healthy",
        latencyMs,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: "unhealthy",
        latencyMs,
        message: "Invalid Supabase credentials or unauthorized",
      };
    }

    return {
      status: "unhealthy",
      latencyMs,
      message: `Database probe returned unexpected HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "Database service unreachable";
    return {
      status: "unhealthy",
      latencyMs,
      message,
    };
  }
}
