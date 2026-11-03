import sensible from "@fastify/sensible";
import type { FastifyPluginAsync } from "fastify";

export const sensiblePlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(sensible);
};
