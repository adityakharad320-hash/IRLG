import type { ServerConfig } from "../config/index.js";
import { checkDatabaseHealth, type DatabaseHealthResult } from "../database/health.js";

export interface LiveHealthResponse {
  status: "ok";
  uptime: number;
  timestamp: string;
  version: string;
}

export interface ReadyHealthResponse {
  status: "ok" | "not_ready";
  uptime: number;
  timestamp: string;
  services: {
    database: DatabaseHealthResult;
  };
}

export class HealthService {
  private readonly startTime: number;

  constructor(private readonly config: ServerConfig) {
    this.startTime = Date.now();
  }

  getLiveHealth(): LiveHealthResponse {
    return {
      status: "ok",
      uptime: Math.round(((Date.now() - this.startTime) / 1000) * 100) / 100,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    };
  }

  async getReadyHealth(): Promise<{ statusCode: number; data: ReadyHealthResponse }> {
    const dbHealth = await checkDatabaseHealth(this.config);

    const isReady = dbHealth.status === "healthy";
    const statusCode = isReady ? 200 : 503;

    return {
      statusCode,
      data: {
        status: isReady ? "ok" : "not_ready",
        uptime: Math.round(((Date.now() - this.startTime) / 1000) * 100) / 100,
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
        },
      },
    };
  }
}
