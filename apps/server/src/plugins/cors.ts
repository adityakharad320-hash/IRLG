import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/index.js";

export async function registerCors(fastify: FastifyInstance, config: ServerConfig): Promise<void> {
  const allowedOrigins = Array.isArray(config.corsOrigin)
    ? config.corsOrigin
    : [config.corsOrigin];

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, native mobile apps, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check against explicit allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Disallowed origin: fail closed by returning false (no Access-Control-Allow-Origin header)
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
  });
}
