import type { FastifyPluginAsync } from "fastify";
import type { HealthService } from "../../services/health.service.js";

export const healthRoutes: FastifyPluginAsync<{ healthService: HealthService }> = async (
  fastify,
  opts
) => {
  fastify.get("/live", async (_request, reply) => {
    const data = opts.healthService.getLiveHealth();
    return reply.status(200).send(data);
  });

  fastify.get("/ready", async (_request, reply) => {
    const { statusCode, data } = await opts.healthService.getReadyHealth();
    return reply.status(statusCode).send(data);
  });
};
