/**
 * Classic Manhunt v1.0 — Centralized Domain Constants & Constraints
 */

export const MANHUNT_CONFIG = {
  MIN_PLAYERS: 8,
  MAX_PLAYERS: 12,
  MIN_HUNTERS: 2,
  MAX_HUNTERS: 3,
  MIN_MATCH_DURATION_SECONDS: 1200, // 20 minutes
  MAX_MATCH_DURATION_SECONDS: 1800, // 30 minutes
  DEFAULT_MATCH_DURATION_SECONDS: 1500, // 25 minutes
  PREPARATION_DURATION_SECONDS: 300, // 5 minutes (fixed)
  RUNNER_HEAD_START_SECONDS: 45, // 45 seconds (fixed)
  INVITE_CODE_LENGTH: 6,
  INVITE_CODE_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // Excludes lookalike chars (0/O, 1/I)
} as const;

export const MATCH_STATUSES = [
  "LOBBY",
  "PREPARING",
  "COUNTDOWN",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "RESULTS",
  "CANCELLED",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const PARTICIPANT_STATUSES = [
  "JOINED",
  "READY",
  "ACTIVE",
  "CAUGHT",
  "DISCONNECTED",
  "WITHDRAWN",
  "SPECTATING",
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const GAMEPLAY_ROLES = ["HUNTER", "RUNNER"] as const;

export type GameplayRole = (typeof GAMEPLAY_ROLES)[number];

export const MATCH_WINNERS = ["RUNNERS", "HUNTERS", "DRAW"] as const;

export type MatchWinner = (typeof MATCH_WINNERS)[number];
