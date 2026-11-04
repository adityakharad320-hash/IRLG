import type { FastifyPluginAsync } from "fastify";
import type { IAuthService } from "../../auth/supabase-auth.js";
import type { IMatchService } from "../../services/match.service.js";
import { createAuthHook } from "../../hooks/authenticate.js";
import { formatSuccessResponse } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";
import {
  createMatchSchema,
  matchIdParamSchema,
  joinMatchSchema,
  updateReadinessSchema,
  updateSettingsSchema,
} from "../../domain/manhunt/schemas.js";

export interface MatchRoutesOptions {
  authService: IAuthService;
  matchService: IMatchService;
}

export const matchRoutes: FastifyPluginAsync<MatchRoutesOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthHook(opts.authService);

  // POST /api/v1/matches - Create a new Classic Manhunt match
  fastify.post(
    "/",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsed = createMatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw parsed.error;
      }

      const result = await opts.matchService.createMatch(user.id, parsed.data);

      return reply.status(201).send(formatSuccessResponse(result));
    }
  );

  // POST /api/v1/matches/join - Join a match via invite code
  fastify.post(
    "/join",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsed = joinMatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw parsed.error;
      }

      const participant = await opts.matchService.joinMatch(user.id, parsed.data);

      return reply.status(200).send(formatSuccessResponse(participant));
    }
  );

  // GET /api/v1/matches/:matchId - Retrieve match details and roster
  fastify.get(
    "/:matchId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsedParams = matchIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw parsedParams.error;
      }

      const result = await opts.matchService.getMatchById(
        user.id,
        parsedParams.data.matchId
      );

      return reply.status(200).send(formatSuccessResponse(result));
    }
  );

  // PATCH /api/v1/matches/:matchId/readiness - Update caller's readiness
  fastify.patch(
    "/:matchId/readiness",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsedParams = matchIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw parsedParams.error;
      }

      const parsedBody = updateReadinessSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        throw parsedBody.error;
      }

      const updatedParticipant = await opts.matchService.updateReadiness(
        user.id,
        parsedParams.data.matchId,
        parsedBody.data
      );

      return reply.status(200).send(formatSuccessResponse(updatedParticipant));
    }
  );

  // PATCH /api/v1/matches/:matchId/settings - Host-only settings update
  fastify.patch(
    "/:matchId/settings",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsedParams = matchIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw parsedParams.error;
      }

      const parsedBody = updateSettingsSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        throw parsedBody.error;
      }

      const updatedMatch = await opts.matchService.updateSettings(
        user.id,
        parsedParams.data.matchId,
        parsedBody.data
      );

      return reply.status(200).send(
        formatSuccessResponse({
          match: updatedMatch,
        })
      );
    }
  );

  // POST /api/v1/matches/:matchId/cancel - Authoritatively cancel a match (Host only)
  fastify.post(
    "/:matchId/cancel",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        throw AppError.unauthorized("Authentication required");
      }

      const parsedParams = matchIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        throw parsedParams.error;
      }

      const cancelledMatch = await opts.matchService.cancelMatch(
        user.id,
        parsedParams.data.matchId
      );

      return reply.status(200).send(
        formatSuccessResponse({
          match: cancelledMatch,
        })
      );
    }
  );
};
