import type { ApiErrorDetail } from "../types/index.js";

export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[] | unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[] | unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: ApiErrorDetail[] | unknown): AppError {
    return new AppError(400, ErrorCode.BAD_REQUEST, message, details);
  }

  static validation(message: string, details?: ApiErrorDetail[] | unknown): AppError {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = "Unauthorized", details?: unknown): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message, details);
  }

  static forbidden(message = "Forbidden", details?: unknown): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message, details);
  }

  static notFound(message = "Resource not found", details?: unknown): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, message, details);
  }

  static internal(message = "Internal server error", details?: unknown): AppError {
    return new AppError(500, ErrorCode.INTERNAL_SERVER_ERROR, message, details);
  }

  static serviceUnavailable(message = "Service unavailable", details?: unknown): AppError {
    return new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, message, details);
  }
}
