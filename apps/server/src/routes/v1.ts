import type { FastifyPluginAsync } from "fastify";
import type { ServerConfig } from "../config/index.js";
import { HealthService } from "../services/health.service.js";
import { SupabaseProfileService, type IProfileService } from "../services/profile.service.js";
import { SupabaseAuthService, type IAuthService } from "../auth/supabase-auth.js";
import { healthRoutes } from "./health/index.js";
import { userRoutes } from "./users/index.js";

export interface V1RoutesOptions {
  config: ServerConfig;
  authService?: IAuthService;
  profileService?: IProfileService;
}

export const v1Routes: FastifyPluginAsync<V1RoutesOptions> = async (
  fastify,
  opts
) => {
  const healthService = new HealthService(opts.config);
  const authService = opts.authService ?? new SupabaseAuthService(opts.config);
  const profileService = opts.profileService ?? new SupabaseProfileService(opts.config);

  // Mount health endpoints: /api/v1/health/live and /api/v1/health/ready
  await fastify.register(healthRoutes, {
    prefix: "/health",
    healthService,
  });

  // Mount user endpoints: /api/v1/users/me
  await fastify.register(userRoutes, {
    prefix: "/users",
    authService,
    profileService,
  });
};
