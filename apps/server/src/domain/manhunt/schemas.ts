import { z } from "zod";
import { MANHUNT_CONFIG } from "./constants.js";

export const createMatchSchema = z
  .object({
    maxPlayers: z
      .number()
      .int("maxPlayers must be an integer")
      .min(MANHUNT_CONFIG.MIN_PLAYERS, `maxPlayers must be at least ${MANHUNT_CONFIG.MIN_PLAYERS}`)
      .max(MANHUNT_CONFIG.MAX_PLAYERS, `maxPlayers must be at most ${MANHUNT_CONFIG.MAX_PLAYERS}`)
      .default(MANHUNT_CONFIG.MAX_PLAYERS),
    hunterCount: z
      .number()
      .int("hunterCount must be an integer")
      .min(MANHUNT_CONFIG.MIN_HUNTERS, `hunterCount must be at least ${MANHUNT_CONFIG.MIN_HUNTERS}`)
      .max(MANHUNT_CONFIG.MAX_HUNTERS, `hunterCount must be at most ${MANHUNT_CONFIG.MAX_HUNTERS}`)
      .default(MANHUNT_CONFIG.MIN_HUNTERS),
    matchDurationSeconds: z
      .number()
      .int("matchDurationSeconds must be an integer")
      .min(
        MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS,
        `matchDurationSeconds must be at least ${MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS} (20 minutes)`
      )
      .max(
        MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS,
        `matchDurationSeconds must be at most ${MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS} (30 minutes)`
      )
      .default(MANHUNT_CONFIG.DEFAULT_MATCH_DURATION_SECONDS),
  })
  .refine((data) => data.hunterCount < data.maxPlayers, {
    message: "hunterCount must be strictly less than maxPlayers",
    path: ["hunterCount"],
  });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;

export const matchIdParamSchema = z.object({
  matchId: z.string().uuid("Invalid match ID format. Expected UUID"),
});

export type MatchIdParam = z.infer<typeof matchIdParamSchema>;

export const joinMatchSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(MANHUNT_CONFIG.INVITE_CODE_LENGTH, `inviteCode must be ${MANHUNT_CONFIG.INVITE_CODE_LENGTH} characters`)
    .regex(/^[A-Z0-9]{6}$/, "inviteCode must consist of uppercase letters and numbers"),
  asSpectator: z.boolean().optional().default(false),
});

export type JoinMatchInput = z.infer<typeof joinMatchSchema>;

export const updateReadinessSchema = z
  .object({
    status: z.enum(["READY", "JOINED"]).optional(),
    ready: z.boolean().optional(),
  })
  .refine((data) => data.status !== undefined || data.ready !== undefined, {
    message: "Must provide either 'status' ('READY' | 'JOINED') or 'ready' boolean",
  })
  .transform((data) => {
    if (data.status) {
      return { status: data.status };
    }
    return { status: data.ready ? ("READY" as const) : ("JOINED" as const) };
  });

export type UpdateReadinessInput = {
  status: "READY" | "JOINED";
};

export const updateSettingsSchema = z
  .object({
    maxPlayers: z
      .number()
      .int("maxPlayers must be an integer")
      .min(MANHUNT_CONFIG.MIN_PLAYERS, `maxPlayers must be at least ${MANHUNT_CONFIG.MIN_PLAYERS}`)
      .max(MANHUNT_CONFIG.MAX_PLAYERS, `maxPlayers must be at most ${MANHUNT_CONFIG.MAX_PLAYERS}`)
      .optional(),
    hunterCount: z
      .number()
      .int("hunterCount must be an integer")
      .min(MANHUNT_CONFIG.MIN_HUNTERS, `hunterCount must be at least ${MANHUNT_CONFIG.MIN_HUNTERS}`)
      .max(MANHUNT_CONFIG.MAX_HUNTERS, `hunterCount must be at most ${MANHUNT_CONFIG.MAX_HUNTERS}`)
      .optional(),
    durationSeconds: z
      .number()
      .int("durationSeconds must be an integer")
      .min(
        MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS,
        `durationSeconds must be at least ${MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS} (20 minutes)`
      )
      .max(
        MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS,
        `durationSeconds must be at most ${MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS} (30 minutes)`
      )
      .optional(),
    matchDurationSeconds: z
      .number()
      .int("matchDurationSeconds must be an integer")
      .min(
        MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS,
        `matchDurationSeconds must be at least ${MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS} (20 minutes)`
      )
      .max(
        MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS,
        `matchDurationSeconds must be at most ${MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS} (30 minutes)`
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.hunterCount !== undefined && data.maxPlayers !== undefined) {
        return data.hunterCount < data.maxPlayers;
      }
      return true;
    },
    {
      message: "hunterCount must be strictly less than maxPlayers",
      path: ["hunterCount"],
    }
  )
  .transform((data) => ({
    maxPlayers: data.maxPlayers,
    hunterCount: data.hunterCount,
    matchDurationSeconds: data.matchDurationSeconds ?? data.durationSeconds,
  }));

export type UpdateSettingsInput = {
  maxPlayers?: number;
  hunterCount?: number;
  matchDurationSeconds?: number;
};
