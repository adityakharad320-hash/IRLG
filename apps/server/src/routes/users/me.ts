import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { IAuthService } from "../../auth/supabase-auth.js";
import type { IProfileService } from "../../services/profile.service.js";
import { createAuthHook } from "../../hooks/authenticate.js";
import { formatSuccessResponse } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name cannot exceed 50 characters")
    .optional(),
  avatarUrl: z.string().url("Avatar URL must be a valid URL").nullable().optional(),
});

export const userMeRoutes: FastifyPluginAsync<{
  authService: IAuthService;
  profileService: IProfileService;
}> = async (fastify, opts) => {
  const requireAuth = createAuthHook(opts.authService);

  // GET /api/v1/users/me - Returns authenticated user identity & profile
  fastify.get(
    "/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const profile = await opts.profileService.ensureProfile(user);

      return reply.status(200).send(
        formatSuccessResponse({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          profile,
        })
      );
    }
  );

  // PATCH /api/v1/users/me - Updates permitted profile fields
  fastify.patch(
    "/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsed = updateProfileSchema.safeParse(request.body);
      if (!parsed.success) {
        throw parsed.error; // Handled by global errorHandler as VALIDATION_ERROR
      }

      const updatedProfile = await opts.profileService.updateProfile(user.id, parsed.data);

      return reply.status(200).send(
        formatSuccessResponse({
          profile: updatedProfile,
        })
      );
    }
  );
};
