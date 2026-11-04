import crypto from "node:crypto";
import fastify, { type FastifyInstance } from "fastify";
import { loadConfig, type ServerConfig } from "./config/index.js";
import { registerCors } from "./plugins/cors.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { sensiblePlugin } from "./plugins/sensible.js";
import { v1Routes } from "./routes/v1.js";
import type { IAuthService } from "./auth/supabase-auth.js";
import type { IProfileService } from "./services/profile.service.js";
import type { IMatchService } from "./services/match.service.js";

export async function buildApp(
  configOverrides?: Partial<Record<string, unknown>>,
  existingConfig?: ServerConfig,
  services?: {
    authService?: IAuthService;
    profileService?: IProfileService;
    matchService?: IMatchService;
  }
): Promise<FastifyInstance> {
  const appConfig = existingConfig ?? loadConfig(configOverrides);

  const isTest = appConfig.nodeEnv === "test";

  const app = fastify({
    logger: isTest
      ? false
      : {
          level: appConfig.logLevel,
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              'req.headers["set-cookie"]',
              "password",
              "*.password",
              "*.*.password",
              "token",
              "*.token",
              "*.*.token",
              "secret",
              "*.secret",
              "*.*.secret",
              "apiKey",
              "*.apiKey",
              "*.*.apiKey",
              "serviceRoleKey",
              "*.serviceRoleKey",
              "*.*.serviceRoleKey",
              "accessToken",
              "*.accessToken",
              "*.*.accessToken",
              "refreshToken",
              "*.refreshToken",
              "*.*.refreshToken",
            ],
            censor: "[REDACTED]",
          },
        },
    bodyLimit: 1048576, // 1 MB
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Ensure request ID header is reflected back in every response
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // Register base plugins
  await app.register(sensiblePlugin);
  await registerCors(app, appConfig);

  // Register global error and not-found handlers
  registerErrorHandler(app, appConfig);

  // Register v1 routes under /api/v1
  await app.register(v1Routes, {
    prefix: appConfig.apiPrefix,
    config: appConfig,
    authService: services?.authService,
    profileService: services?.profileService,
    matchService: services?.matchService,
  });

  return app;
}
