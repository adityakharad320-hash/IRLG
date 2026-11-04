import type { ApiErrorDetail } from "../types/index.js";

export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  // Match & Lobby domain error codes
  MATCH_FULL: "MATCH_FULL",
  INVALID_INVITE_CODE: "INVALID_INVITE_CODE",
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  ALREADY_JOINED: "ALREADY_JOINED",
  NOT_AUTHORIZED: "NOT_AUTHORIZED",
  INVALID_MATCH_STATE: "INVALID_MATCH_STATE",
  INVALID_READINESS_TRANSITION: "INVALID_READINESS_TRANSITION",
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

  static conflict(message = "Conflict", details?: unknown): AppError {
    return new AppError(409, ErrorCode.CONFLICT, message, details);
  }

  static matchFull(message = "Match lobby is full", details?: unknown): AppError {
    return new AppError(400, ErrorCode.MATCH_FULL, message, details);
  }

  static invalidInviteCode(message = "Invalid invite code", details?: unknown): AppError {
    return new AppError(404, ErrorCode.INVALID_INVITE_CODE, message, details);
  }

  static matchNotFound(message = "Match not found", details?: unknown): AppError {
    return new AppError(404, ErrorCode.MATCH_NOT_FOUND, message, details);
  }

  static alreadyJoined(message = "User is already a participant in this match", details?: unknown): AppError {
    return new AppError(409, ErrorCode.ALREADY_JOINED, message, details);
  }

  static notAuthorized(message = "Not authorized to perform this action", details?: unknown): AppError {
    return new AppError(403, ErrorCode.NOT_AUTHORIZED, message, details);
  }

  static invalidMatchState(message = "Action is not permitted in current match state", details?: unknown): AppError {
    return new AppError(400, ErrorCode.INVALID_MATCH_STATE, message, details);
  }

  static invalidReadinessTransition(message = "Invalid readiness transition", details?: unknown): AppError {
    return new AppError(400, ErrorCode.INVALID_READINESS_TRANSITION, message, details);
  }

  static internal(message = "Internal server error", details?: unknown): AppError {
    return new AppError(500, ErrorCode.INTERNAL_SERVER_ERROR, message, details);
  }

  static serviceUnavailable(message = "Service unavailable", details?: unknown): AppError {
    return new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, message, details);
  }
}
