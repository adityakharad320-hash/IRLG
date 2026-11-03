import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { ServerConfig } from "../config/index.js";
import { AppError, ErrorCode } from "../utils/errors.js";
import { formatErrorResponse } from "../utils/response.js";

export function registerErrorHandler(fastify: FastifyInstance, config: ServerConfig): void {
  fastify.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      return reply.status(400).send(
        formatErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Request validation failed",
          details,
          request.id
        )
      );
    }

    // 2. Fastify Schema Validation Errors
    if ("validation" in error && error.validation) {
      return reply.status(400).send(
        formatErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          error.message,
          error.validation,
          request.id
        )
      );
    }

    // 3. Application Domain Errors (AppError)
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(
        formatErrorResponse(
          error.code,
          error.message,
          error.details,
          request.id
        )
      );
    }

    // 4. Rate Limit / Method Not Allowed / Fastify Built-in Errors
    const statusCode: number =
      "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    if (isClientError) {
      const code =
        "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : ErrorCode.BAD_REQUEST;
      return reply.status(statusCode).send(
        formatErrorResponse(
          code,
          error.message,
          undefined,
          request.id
        )
      );
    }

    // 5. Unhandled Server Errors (500)
    request.log.error(
      {
        err: error,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Unhandled server exception"
    );

    const isProduction = config.nodeEnv === "production";
    const message = isProduction
      ? "An unexpected internal server error occurred"
      : error.message || "An unexpected internal server error occurred";

    return reply.status(500).send(
      formatErrorResponse(
        ErrorCode.INTERNAL_SERVER_ERROR,
        message,
        undefined,
        request.id
      )
    );
  });

  // Not Found (404) Handler
  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send(
      formatErrorResponse(
        ErrorCode.NOT_FOUND,
        `Route ${request.method} ${request.url} not found`,
        undefined,
        request.id
      )
    );
  });
}
