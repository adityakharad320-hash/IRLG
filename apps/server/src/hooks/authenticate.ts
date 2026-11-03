import type { FastifyRequest, FastifyReply } from "fastify";
import type { IAuthService } from "../auth/supabase-auth.js";
import { AppError } from "../utils/errors.js";

const BEARER_REGEX = /^Bearer\s+(\S+)$/;

export function createAuthHook(authService: IAuthService) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw AppError.unauthorized("Missing Authorization header");
    }

    const match = BEARER_REGEX.exec(authHeader.trim());
    if (!match || !match[1]) {
      throw AppError.unauthorized("Invalid Authorization header format. Expected 'Bearer <token>'");
    }

    const token = match[1];
    const user = await authService.verifyToken(token);
    request.user = user;
  };
}

export function requireRole(allowedRoles: string[]) {
  return async function checkRole(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) {
      throw AppError.unauthorized("Authentication required");
    }

    const userRole = request.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw AppError.forbidden("Access denied: insufficient permissions");
    }
  };
}
