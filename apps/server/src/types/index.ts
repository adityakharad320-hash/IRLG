export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[] | unknown;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
