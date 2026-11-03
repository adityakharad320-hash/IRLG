import type { FastifyPluginAsync } from "fastify";
import type { ServerConfig } from "../config/index.js";
import { HealthService } from "../services/health.service.js";
import { healthRoutes } from "./health/index.js";

export const v1Routes: FastifyPluginAsync<{ config: ServerConfig }> = async (
  fastify,
  opts
) => {
  const healthService = new HealthService(opts.config);

  // Mount health endpoints: /api/v1/health/live and /api/v1/health/ready
  await fastify.register(healthRoutes, {
    prefix: "/health",
    healthService,
  });
};
