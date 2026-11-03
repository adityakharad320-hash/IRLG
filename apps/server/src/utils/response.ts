import type { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail } from "../types/index.js";

export function formatSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

export function formatErrorResponse(
  code: string,
  message: string,
  details?: ApiErrorDetail[] | unknown,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };
}
