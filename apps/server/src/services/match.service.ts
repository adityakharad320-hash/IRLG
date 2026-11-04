import type { ServerConfig } from "../config/index.js";
import { getSupabaseAdminClient } from "../database/client.js";
import { AppError } from "../utils/errors.js";
import {
  MANHUNT_CONFIG,
  type MatchStatus,
  type ParticipantStatus,
  type GameplayRole,
  type MatchWinner,
} from "../domain/manhunt/constants.js";
import { assertValidMatchTransition } from "../domain/manhunt/lifecycle.js";
import { generateInviteCode } from "../domain/manhunt/invite-code.js";
import {
  assignRoles,
  validateHunterCount,
  type CandidatePlayer,
} from "../domain/manhunt/role-manager.js";
import type {
  CreateMatchInput,
  JoinMatchInput,
  UpdateReadinessInput,
  UpdateSettingsInput,
} from "../domain/manhunt/schemas.js";
import type {
  Match,
  MatchParticipant,
  MatchWithParticipants,
  InviteLookupResult,
  MatchTiming,
  PlayerRoleResponse,
} from "../types/index.js";

export interface IMatchService {
  createMatch(hostUserId: string, input: CreateMatchInput): Promise<MatchWithParticipants>;
  getMatchById(userId: string, matchId: string): Promise<MatchWithParticipants>;
  cancelMatch(userId: string, matchId: string): Promise<Match>;
  getMatchByInviteCode(userId: string, inviteCode: string): Promise<InviteLookupResult>;
  joinMatch(userId: string, input: JoinMatchInput): Promise<MatchParticipant>;
  updateReadiness(userId: string, matchId: string, input: UpdateReadinessInput): Promise<MatchParticipant>;
  updateSettings(userId: string, matchId: string, input: UpdateSettingsInput): Promise<Match>;
  startPreparation(userId: string, matchId: string): Promise<MatchWithParticipants>;
  getMyRole(userId: string, matchId: string): Promise<PlayerRoleResponse>;
  getMatchTiming(userId: string, matchId: string): Promise<MatchTiming>;
  advanceMatchPhase(userId: string, matchId: string, targetStatus?: MatchStatus): Promise<Match>;
}

export interface MatchRow {
  id: string;
  host_user_id: string;
  invite_code: string;
  status: string;
  max_players: number;
  hunter_count: number;
  match_duration_seconds: number;
  preparation_duration_seconds: number;
  runner_head_start_seconds: number;
  winner: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  preparation_started_at?: string | null;
  countdown_started_at?: string | null;
}

export interface MatchParticipantRow {
  id: string;
  match_id: string;
  user_id: string;
  gameplay_role: string | null;
  participation_status: string;
  is_host: boolean;
  joined_at: string;
  ready_at: string | null;
  caught_at: string | null;
  disconnected_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchParticipantRoleRow {
  id: string;
  match_id: string;
  participant_id: string;
  user_id: string;
  gameplay_role: string;
  assigned_at: string;
  created_at?: string;
  updated_at?: string;
}

export function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    hostUserId: row.host_user_id,
    inviteCode: row.invite_code,
    status: row.status as MatchStatus,
    maxPlayers: row.max_players,
    hunterCount: row.hunter_count,
    matchDurationSeconds: row.match_duration_seconds,
    preparationDurationSeconds: row.preparation_duration_seconds,
    runnerHeadStartSeconds: row.runner_head_start_seconds,
    winner: row.winner as MatchWinner | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    preparationStartedAt: row.preparation_started_at ?? null,
    countdownStartedAt: row.countdown_started_at ?? null,
  };
}

export function mapParticipantRow(
  row: MatchParticipantRow,
  profile?: { displayName?: string; avatarUrl?: string | null }
): MatchParticipant {
  return {
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    gameplayRole: row.gameplay_role as GameplayRole | null,
    participationStatus: row.participation_status as ParticipantStatus,
    isHost: row.is_host,
    joinedAt: row.joined_at,
    readyAt: row.ready_at,
    caughtAt: row.caught_at,
    disconnectedAt: row.disconnected_at,
    withdrawnAt: row.withdrawn_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: profile?.displayName || `Player_${row.user_id.slice(0, 6)}`,
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

export class SupabaseMatchService implements IMatchService {
  constructor(private readonly config: ServerConfig) {}

  private getClient() {
    if (!this.config.supabase.isConfigured) {
      throw AppError.serviceUnavailable("Database service is not configured in this environment");
    }

    const client = getSupabaseAdminClient(this.config);
    if (!client) {
      throw AppError.serviceUnavailable("Database client could not be initialized");
    }

    return client;
  }

  /**
   * Authoritatively creates a match and enlists the host as the first participant.
   * Uses atomic database RPC (create_manhunt_match_tx) when available to prevent orphaned records.
   * Handles invite code collisions safely with retries.
   */
  async createMatch(
    hostUserId: string,
    input: CreateMatchInput
  ): Promise<MatchWithParticipants> {
    const client = this.getClient();

    const maxPlayers = input.maxPlayers ?? MANHUNT_CONFIG.MAX_PLAYERS;
    const hunterCount = input.hunterCount ?? MANHUNT_CONFIG.MIN_HUNTERS;
    const matchDurationSeconds =
      input.matchDurationSeconds ?? MANHUNT_CONFIG.DEFAULT_MATCH_DURATION_SECONDS;

    if (hunterCount >= maxPlayers) {
      throw AppError.badRequest("hunterCount must be strictly less than maxPlayers");
    }

    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const inviteCode = generateInviteCode();

      if (typeof client.rpc !== "function" && this.config.nodeEnv === "production") {
        throw AppError.internal("Atomic database procedure execution is unavailable");
      }

      // Attempt atomic RPC execution first if supported by client
      if (typeof client.rpc === "function") {
        const { data: rpcData, error: rpcError } = await client.rpc("create_manhunt_match_tx", {
          p_host_user_id: hostUserId,
          p_invite_code: inviteCode,
          p_max_players: maxPlayers,
          p_hunter_count: hunterCount,
          p_match_duration_seconds: matchDurationSeconds,
        });

        if (!rpcError && rpcData) {
          const match = mapMatchRow(rpcData.match as MatchRow);
          const participant = mapParticipantRow(rpcData.participant as MatchParticipantRow);
          return { match, participants: [participant] };
        }

        if (rpcError) {
          if (rpcError.code === "23505" && rpcError.message?.includes("invite_code")) {
            continue;
          }
          // If RPC is missing, fail closed in production to prevent silent non-atomic execution
          if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
            if (this.config.nodeEnv === "production") {
              throw AppError.internal(
                `Atomic database procedure create_manhunt_match_tx is missing: ${rpcError.message}`
              );
            }
          } else {
            throw AppError.internal(`Failed to create match: ${rpcError.message}`);
          }
        }
      }

      // Fallback path: Table-level insert with transactional rollback
      const { data, error } = await client
        .from("matches")
        .insert({
          host_user_id: hostUserId,
          invite_code: inviteCode,
          status: "LOBBY",
          max_players: maxPlayers,
          hunter_count: hunterCount,
          match_duration_seconds: matchDurationSeconds,
          preparation_duration_seconds: MANHUNT_CONFIG.PREPARATION_DURATION_SECONDS,
          runner_head_start_seconds: MANHUNT_CONFIG.RUNNER_HEAD_START_SECONDS,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505" && error.message?.includes("invite_code")) {
          continue;
        }
        throw AppError.internal(`Failed to create match: ${error.message}`);
      }

      const matchRow = data as MatchRow;

      const { data: participantData, error: participantError } = await client
        .from("match_participants")
        .insert({
          match_id: matchRow.id,
          user_id: hostUserId,
          gameplay_role: null,
          participation_status: "JOINED",
          is_host: true,
        })
        .select("*")
        .single();

      if (participantError) {
        // Rollback match creation if participant addition fails
        await client.from("matches").delete().eq("id", matchRow.id);
        throw AppError.internal(`Failed to initialize host participation: ${participantError.message}`);
      }

      return {
        match: mapMatchRow(matchRow),
        participants: [mapParticipantRow(participantData as MatchParticipantRow)],
      };
    }

    throw AppError.internal("Could not generate unique invite code after maximum attempts");
  }

  /**
   * Retrieves match details with participants if the user is authorized (host or participant).
   * Enforces role privacy: masks other participants' gameplay roles unless the requester is host or match is completed.
   */
  async getMatchById(userId: string, matchId: string): Promise<MatchWithParticipants> {
    const client = this.getClient();

    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match: ${matchError.message}`);
    }

    if (!matchData) {
      throw AppError.notFound("Match not found");
    }

    const { data: participantsData, error: participantsError } = await client
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId)
      .order("joined_at", { ascending: true });

    if (participantsError) {
      throw AppError.internal(`Failed to retrieve match participants: ${participantsError.message}`);
    }

    const rawParticipants = (participantsData as MatchParticipantRow[]).map((r) => mapParticipantRow(r));

    // Authorization check: User must be the host or a participant
    const isHost = matchData.host_user_id === userId;
    const isParticipant = rawParticipants.some((p) => p.userId === userId);

    if (!isHost && !isParticipant) {
      throw AppError.forbidden("Access denied: You are not a participant in this match");
    }

    // Role privacy filtering:
    // Only post-match results (COMPLETED, RESULTS) allow viewing all roles.
    // Host is an administrative role, NOT a gameplay privilege; host CANNOT view other players' roles.
    // In pre-game/active matches, each participant can ONLY view their own gameplay role.
    const matchStatus = matchData.status as MatchStatus;
    const canSeeAllRoles = matchStatus === "COMPLETED" || matchStatus === "RESULTS";

    // Attempt to load profiles for participant display names
    const userIds = rawParticipants.map((p) => p.userId);
    const profilesMap = new Map<string, { displayName: string; avatarUrl: string | null }>();

    if (userIds.length > 0) {
      try {
        const profileQuery = client.from("profiles");
        if (profileQuery && typeof profileQuery.select === "function") {
          const { data: profilesData } = await profileQuery
            .select("id, display_name, avatar_url")
            .in("id", userIds);

          if (profilesData && Array.isArray(profilesData)) {
            for (const p of profilesData as Array<{ id: string; display_name: string; avatar_url: string | null }>) {
              profilesMap.set(p.id, {
                displayName: p.display_name,
                avatarUrl: p.avatar_url,
              });
            }
          }
        }
      } catch {
        // Graceful fallback to default display names
      }
    }

    const participants = rawParticipants.map((p) => {
      const profile = profilesMap.get(p.userId);
      const withProfile: MatchParticipant = {
        ...p,
        displayName: profile?.displayName || p.displayName,
        avatarUrl: profile?.avatarUrl ?? p.avatarUrl,
      };

      if (canSeeAllRoles || p.userId === userId) {
        return withProfile;
      }
      return {
        ...withProfile,
        gameplayRole: null,
      };
    });

    return {
      match: mapMatchRow(matchData as MatchRow),
      participants,
    };
  }

  /**
   * Cancels a match atomically.
   * Enforces that only the verified host can cancel, and only while the match is in a cancellable state.
   * Uses atomic conditional update to eliminate race conditions.
   */
  async cancelMatch(userId: string, matchId: string): Promise<Match> {
    const client = this.getClient();

    const cancellableStatuses: MatchStatus[] = ["LOBBY", "PREPARING", "COUNTDOWN", "PAUSED"];
    const now = new Date().toISOString();

    // Perform atomic conditional update matching ID, host, and cancellable status
    const { data: updatedMatch, error: updateError } = await client
      .from("matches")
      .update({
        status: "CANCELLED",
        cancelled_at: now,
      })
      .eq("id", matchId)
      .eq("host_user_id", userId)
      .in("status", cancellableStatuses)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw AppError.internal(`Failed to cancel match: ${updateError.message}`);
    }

    if (updatedMatch) {
      return mapMatchRow(updatedMatch as MatchRow);
    }

    // If no row was updated, inspect existing match state to report the precise failure
    const { data: existingMatch, error: lookupError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (lookupError) {
      throw AppError.internal(`Failed to inspect match state: ${lookupError.message}`);
    }

    if (!existingMatch) {
      throw AppError.notFound("Match not found");
    }

    if (existingMatch.host_user_id !== userId) {
      throw AppError.forbidden("Only the match host can cancel this match");
    }

    const currentStatus = existingMatch.status as MatchStatus;
    assertValidMatchTransition(currentStatus, "CANCELLED");

    throw AppError.badRequest(`Cannot cancel match in current status '${currentStatus}'`);
  }

  /**
   * Looks up a match by invite code.
   * Returns minimal non-sensitive data, and only succeeds if match is in LOBBY.
   */
  async getMatchByInviteCode(
    _userId: string,
    inviteCode: string
  ): Promise<InviteLookupResult> {
    const client = this.getClient();

    const normalizedCode = inviteCode.trim().toUpperCase();

    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("id, status, max_players")
      .eq("invite_code", normalizedCode)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to look up invite code: ${matchError.message}`);
    }

    if (!matchData) {
      throw AppError.notFound("Invalid invite code");
    }

    if (matchData.status !== "LOBBY") {
      throw AppError.badRequest("Invite code is no longer valid: match has already started or been cancelled");
    }

    return {
      matchId: matchData.id,
      status: matchData.status as MatchStatus,
      maxPlayers: matchData.max_players,
    };
  }

  /**
   * Joins a match via invite code.
   * Uses atomic database RPC (join_manhunt_match_tx) with row locking when available
   * to guarantee concurrent requests cannot exceed max_players.
   * Active player capacity strictly bounds players; spectators join without consuming player slots.
   */
  async joinMatch(
    userId: string,
    input: JoinMatchInput
  ): Promise<MatchParticipant> {
    const client = this.getClient();

    const lookup = await this.getMatchByInviteCode(userId, input.inviteCode);

    if (typeof client.rpc !== "function" && this.config.nodeEnv === "production") {
      throw AppError.internal("Atomic database procedure execution is unavailable");
    }

    // Attempt atomic RPC execution with SELECT FOR UPDATE row locking
    if (typeof client.rpc === "function") {
      const { data: rpcParticipant, error: rpcError } = await client.rpc("join_manhunt_match_tx", {
        p_match_id: lookup.matchId,
        p_user_id: userId,
        p_as_spectator: input.asSpectator ?? false,
      });

      if (!rpcError && rpcParticipant) {
        return mapParticipantRow(rpcParticipant as MatchParticipantRow);
      }

      if (rpcError) {
        if (rpcError.code === "P0003" || rpcError.message?.includes("MATCH_FULL")) {
          throw AppError.badRequest("Match lobby is full");
        }
        if (rpcError.code === "P0001" || rpcError.message?.includes("MATCH_NOT_IN_LOBBY")) {
          throw AppError.badRequest("Invite code is no longer valid: match has already started or been cancelled");
        }
        if (rpcError.code === "23505") {
          throw AppError.conflict("User is already a participant in this match");
        }
        // If RPC is missing, fail closed in production to prevent silent non-atomic execution
        if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
          if (this.config.nodeEnv === "production") {
            throw AppError.internal(
              `Atomic database procedure join_manhunt_match_tx is missing: ${rpcError.message}`
            );
          }
        } else {
          throw AppError.internal(`Failed to join match: ${rpcError.message}`);
        }
      }
    }

    // Fallback path: Check active player count and insert
    const isSpectator = input.asSpectator ?? false;
    if (!isSpectator) {
      const { count, error: countError } = await client
        .from("match_participants")
        .select("id", { count: "exact", head: true })
        .eq("match_id", lookup.matchId)
        .not("participation_status", "in", '("SPECTATING","WITHDRAWN")');

      if (countError) {
        throw AppError.internal(`Failed to check participant count: ${countError.message}`);
      }

      if (count != null && count >= lookup.maxPlayers) {
        throw AppError.badRequest("Match lobby is full");
      }
    }

    const participationStatus: ParticipantStatus = isSpectator ? "SPECTATING" : "JOINED";

    const { data: newParticipant, error: insertError } = await client
      .from("match_participants")
      .insert({
        match_id: lookup.matchId,
        user_id: userId,
        gameplay_role: null,
        participation_status: participationStatus,
        is_host: false,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        throw AppError.conflict("User is already a participant in this match");
      }
      throw AppError.internal(`Failed to join match: ${insertError.message}`);
    }

    return mapParticipantRow(newParticipant as MatchParticipantRow);
  }

  /**
   * Updates participant readiness atomically between JOINED and READY.
   * Derives user from verified auth token and rejects unauthorized or cross-participant updates.
   */
  async updateReadiness(
    userId: string,
    matchId: string,
    input: UpdateReadinessInput
  ): Promise<MatchParticipant> {
    const client = this.getClient();

    if (!["READY", "JOINED"].includes(input.status)) {
      throw AppError.invalidReadinessTransition("Readiness status must be JOINED or READY");
    }

    if (typeof client.rpc !== "function" && this.config.nodeEnv === "production") {
      throw AppError.internal("Atomic database procedure execution is unavailable");
    }

    // Attempt atomic RPC execution first if supported by client
    if (typeof client.rpc === "function") {
      const { data: rpcParticipant, error: rpcError } = await client.rpc(
        "update_participant_readiness_tx",
        {
          p_match_id: matchId,
          p_user_id: userId,
          p_new_status: input.status,
        }
      );

      if (!rpcError && rpcParticipant) {
        return mapParticipantRow(rpcParticipant as MatchParticipantRow);
      }

      if (rpcError) {
        if (rpcError.code === "P0002" || rpcError.message?.includes("MATCH_NOT_FOUND")) {
          throw AppError.matchNotFound("Match not found");
        }
        if (rpcError.code === "P0001" || rpcError.message?.includes("MATCH_NOT_IN_LOBBY")) {
          throw AppError.invalidMatchState("Cannot change readiness outside of LOBBY");
        }
        if (rpcError.code === "P0004" || rpcError.message?.includes("NOT_A_PARTICIPANT")) {
          throw AppError.notAuthorized("User is not a participant in this match");
        }
        if (rpcError.code === "P0005" || rpcError.message?.includes("SPECTATOR_CANNOT_READY")) {
          throw AppError.invalidReadinessTransition("Spectators cannot toggle readiness");
        }
        if (rpcError.code === "P0006" || rpcError.message?.includes("WITHDRAWN_CANNOT_READY")) {
          throw AppError.invalidReadinessTransition("Withdrawn participants cannot toggle readiness");
        }
        if (rpcError.code === "P0007" || rpcError.message?.includes("INVALID_READINESS_STATUS")) {
          throw AppError.invalidReadinessTransition("Readiness status must be JOINED or READY");
        }
        // If RPC is missing, fail closed in production to prevent silent non-atomic execution
        if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
          if (this.config.nodeEnv === "production") {
            throw AppError.internal(
              `Atomic database procedure update_participant_readiness_tx is missing: ${rpcError.message}`
            );
          }
        } else {
          throw AppError.internal(`Failed to update readiness: ${rpcError.message}`);
        }
      }
    }

    // Fallback path: Table queries with atomic conditional update
    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match: ${matchError.message}`);
    }
    if (!matchData) {
      throw AppError.matchNotFound("Match not found");
    }
    if (matchData.status !== "LOBBY") {
      throw AppError.invalidMatchState("Cannot change readiness outside of LOBBY");
    }

    const { data: participantData, error: participantError } = await client
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .maybeSingle();

    if (participantError) {
      throw AppError.internal(`Failed to retrieve participant: ${participantError.message}`);
    }
    if (!participantData) {
      throw AppError.notAuthorized("User is not a participant in this match");
    }

    if (participantData.participation_status === "SPECTATING") {
      throw AppError.invalidReadinessTransition("Spectators cannot toggle readiness");
    }
    if (participantData.participation_status === "WITHDRAWN") {
      throw AppError.invalidReadinessTransition("Withdrawn participants cannot toggle readiness");
    }

    const now = new Date().toISOString();
    const readyAt = input.status === "READY" ? now : null;

    const { data: updatedParticipant, error: updateError } = await client
      .from("match_participants")
      .update({
        participation_status: input.status,
        ready_at: readyAt,
        updated_at: now,
      })
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw AppError.internal(`Failed to update readiness: ${updateError.message}`);
    }

    if (!updatedParticipant) {
      throw AppError.internal("Failed to update participant readiness record");
    }

    return mapParticipantRow(updatedParticipant as MatchParticipantRow);
  }

  /**
   * Updates match settings authoritatively. Host only.
   * Validates bounds and enforces that capacity is not reduced below current active occupant count.
   */
  async updateSettings(
    userId: string,
    matchId: string,
    input: UpdateSettingsInput
  ): Promise<Match> {
    const client = this.getClient();

    if (typeof client.rpc !== "function" && this.config.nodeEnv === "production") {
      throw AppError.internal("Atomic database procedure execution is unavailable");
    }

    // Attempt atomic RPC execution first if supported by client
    if (typeof client.rpc === "function") {
      const { data: rpcMatch, error: rpcError } = await client.rpc(
        "update_match_settings_tx",
        {
          p_match_id: matchId,
          p_user_id: userId,
          p_max_players: input.maxPlayers ?? null,
          p_hunter_count: input.hunterCount ?? null,
          p_match_duration_seconds: input.matchDurationSeconds ?? null,
        }
      );

      if (!rpcError && rpcMatch) {
        return mapMatchRow(rpcMatch as MatchRow);
      }

      if (rpcError) {
        if (rpcError.code === "P0002" || rpcError.message?.includes("MATCH_NOT_FOUND")) {
          throw AppError.matchNotFound("Match not found");
        }
        if (rpcError.code === "P0008" || rpcError.message?.includes("NOT_HOST")) {
          throw AppError.notAuthorized("Only the match host can update lobby settings");
        }
        if (rpcError.code === "P0001" || rpcError.message?.includes("MATCH_NOT_IN_LOBBY")) {
          throw AppError.invalidMatchState("Settings can only be changed while match is in LOBBY");
        }
        if (rpcError.code === "P0009" || rpcError.message?.includes("CAPACITY_BELOW_OCCUPANCY")) {
          throw AppError.badRequest("Cannot reduce maxPlayers below current active participant count");
        }
        if (rpcError.code === "P0010" || rpcError.message?.includes("HUNTER_COUNT_INVALID")) {
          throw AppError.badRequest("hunterCount must be strictly less than maxPlayers");
        }
        if (rpcError.code === "P0011" || rpcError.message?.includes("MAX_PLAYERS_OUT_OF_BOUNDS")) {
          throw AppError.badRequest(`maxPlayers must be between ${MANHUNT_CONFIG.MIN_PLAYERS} and ${MANHUNT_CONFIG.MAX_PLAYERS}`);
        }
        if (rpcError.code === "P0012" || rpcError.message?.includes("HUNTER_COUNT_OUT_OF_BOUNDS")) {
          throw AppError.badRequest(`hunterCount must be between ${MANHUNT_CONFIG.MIN_HUNTERS} and ${MANHUNT_CONFIG.MAX_HUNTERS}`);
        }
        if (rpcError.code === "P0013" || rpcError.message?.includes("DURATION_OUT_OF_BOUNDS")) {
          throw AppError.badRequest(
            `matchDurationSeconds must be between ${MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS} and ${MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS}`
          );
        }
        // If RPC is missing, fail closed in production to prevent silent non-atomic execution
        if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
          if (this.config.nodeEnv === "production") {
            throw AppError.internal(
              `Atomic database procedure update_match_settings_tx is missing: ${rpcError.message}`
            );
          }
        } else {
          throw AppError.internal(`Failed to update settings: ${rpcError.message}`);
        }
      }
    }

    // Fallback path: Table queries with atomic conditional update
    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match: ${matchError.message}`);
    }
    if (!matchData) {
      throw AppError.matchNotFound("Match not found");
    }
    if (matchData.host_user_id !== userId) {
      throw AppError.notAuthorized("Only the match host can update lobby settings");
    }
    if (matchData.status !== "LOBBY") {
      throw AppError.invalidMatchState("Settings can only be changed while match is in LOBBY");
    }

    const currentMatch = mapMatchRow(matchData as MatchRow);
    const newMaxPlayers = input.maxPlayers ?? currentMatch.maxPlayers;
    const newHunterCount = input.hunterCount ?? currentMatch.hunterCount;
    const newDuration = input.matchDurationSeconds ?? currentMatch.matchDurationSeconds;

    if (newMaxPlayers < MANHUNT_CONFIG.MIN_PLAYERS || newMaxPlayers > MANHUNT_CONFIG.MAX_PLAYERS) {
      throw AppError.badRequest(
        `maxPlayers must be between ${MANHUNT_CONFIG.MIN_PLAYERS} and ${MANHUNT_CONFIG.MAX_PLAYERS}`
      );
    }
    if (newHunterCount < MANHUNT_CONFIG.MIN_HUNTERS || newHunterCount > MANHUNT_CONFIG.MAX_HUNTERS) {
      throw AppError.badRequest(
        `hunterCount must be between ${MANHUNT_CONFIG.MIN_HUNTERS} and ${MANHUNT_CONFIG.MAX_HUNTERS}`
      );
    }
    if (newHunterCount >= newMaxPlayers) {
      throw AppError.badRequest("hunterCount must be strictly less than maxPlayers");
    }
    if (
      newDuration < MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS ||
      newDuration > MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS
    ) {
      throw AppError.badRequest(
        `matchDurationSeconds must be between ${MANHUNT_CONFIG.MIN_MATCH_DURATION_SECONDS} and ${MANHUNT_CONFIG.MAX_MATCH_DURATION_SECONDS}`
      );
    }

    // Capacity floor check: active slot occupancy
    const { count, error: countError } = await client
      .from("match_participants")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .not("participation_status", "in", '("SPECTATING","WITHDRAWN")');

    if (countError) {
      throw AppError.internal(`Failed to check participant count: ${countError.message}`);
    }

    if (count != null && newMaxPlayers < count) {
      throw AppError.badRequest(
        `Cannot reduce maxPlayers (${newMaxPlayers}) below current active participant count (${count})`
      );
    }

    const now = new Date().toISOString();
    const { data: updatedMatch, error: updateError } = await client
      .from("matches")
      .update({
        max_players: newMaxPlayers,
        hunter_count: newHunterCount,
        match_duration_seconds: newDuration,
        updated_at: now,
      })
      .eq("id", matchId)
      .eq("host_user_id", userId)
      .eq("status", "LOBBY")
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw AppError.internal(`Failed to update match settings: ${updateError.message}`);
    }
    if (!updatedMatch) {
      throw AppError.internal("Failed to update match settings record");
    }

    return mapMatchRow(updatedMatch as MatchRow);
  }

  /**
   * Authoritatively transitions a match from LOBBY to PREPARING,
   * performs cryptographically secure role assignment, and stores roles in the private table.
   * Host only. Idempotent: safe against concurrent requests.
   */
  async startPreparation(userId: string, matchId: string): Promise<MatchWithParticipants> {
    const client = this.getClient();

    // 1. Fetch match to check existence, host authorization, and status
    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match: ${matchError.message}`);
    }

    if (!matchData) {
      throw AppError.notFound("Match not found");
    }

    const matchRow = matchData as MatchRow;

    if (matchRow.host_user_id !== userId) {
      throw AppError.forbidden("Access denied: Only the match host can start match preparation");
    }

    // Idempotency: If already PREPARING, return current state without reshuffling
    if (matchRow.status === "PREPARING") {
      return this.getMatchById(userId, matchId);
    }

    if (matchRow.status !== "LOBBY") {
      throw AppError.badRequest(
        `Cannot start preparation: Match is currently in '${matchRow.status}' status (must be in 'LOBBY')`
      );
    }

    // 2. Query participants to validate active player count and readiness
    const { data: participantsData, error: participantsError } = await client
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId)
      .order("joined_at", { ascending: true });

    if (participantsError) {
      throw AppError.internal(`Failed to retrieve participants: ${participantsError.message}`);
    }

    const rawParticipants = (participantsData as MatchParticipantRow[]) ?? [];
    const activeParticipants = rawParticipants.filter(
      (p) => !["SPECTATING", "WITHDRAWN"].includes(p.participation_status)
    );

    if (activeParticipants.length < MANHUNT_CONFIG.MIN_PLAYERS) {
      throw AppError.badRequest(
        `Cannot start match: Minimum of ${MANHUNT_CONFIG.MIN_PLAYERS} eligible active players required, but found ${activeParticipants.length}`
      );
    }

    if (activeParticipants.length > matchRow.max_players) {
      throw AppError.badRequest(
        `Cannot start match: Active player count (${activeParticipants.length}) exceeds maxPlayers limit (${matchRow.max_players})`
      );
    }

    // All eligible active participants must be READY
    const unreadyParticipants = activeParticipants.filter((p) => p.participation_status !== "READY");
    if (unreadyParticipants.length > 0) {
      throw AppError.badRequest(
        `Cannot start match: All eligible active players must be READY (${unreadyParticipants.length} player(s) not ready)`
      );
    }

    // Validate hunter count bounds
    validateHunterCount(matchRow.hunter_count, activeParticipants.length);

    // 3. Cryptographically secure role assignment
    const candidatePlayers: CandidatePlayer[] = rawParticipants.map((p) => ({
      userId: p.user_id,
      isSpectator: p.participation_status === "SPECTATING",
      isWithdrawn: p.participation_status === "WITHDRAWN",
    }));

    const assignments = assignRoles(candidatePlayers, matchRow.hunter_count);

    // 4. Atomic database transaction via RPC if available
    if (typeof client.rpc === "function") {
      const { data: rpcData, error: rpcError } = await client.rpc("start_match_preparation_tx", {
        p_match_id: matchId,
        p_host_user_id: userId,
        p_assignments: assignments,
      });

      if (!rpcError && rpcData) {
        return this.getMatchById(userId, matchId);
      }

      if (rpcError) {
        if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
          if (this.config.nodeEnv === "production") {
            throw AppError.internal(
              `Atomic database procedure start_match_preparation_tx is missing: ${rpcError.message}`
            );
          }
        } else {
          if (rpcError.message?.includes("NOT_HOST")) {
            throw AppError.forbidden("Access denied: Only the match host can start match preparation");
          }
          if (rpcError.message?.includes("MINIMUM_PLAYERS_NOT_MET")) {
            throw AppError.badRequest("Cannot start match: Minimum of 8 eligible active players required");
          }
          if (rpcError.message?.includes("NOT_ALL_PLAYERS_READY")) {
            throw AppError.badRequest("Cannot start match: All eligible active players must be READY");
          }
          throw AppError.internal(`Failed to start match preparation: ${rpcError.message}`);
        }
      }
    }

    // Fallback path (dev / testing without database RPC)
    const now = new Date().toISOString();
    const roleInserts = assignments
      .filter((a) => a.role !== null)
      .map((a) => {
        const participant = rawParticipants.find((p) => p.user_id === a.userId);
        return {
          match_id: matchId,
          participant_id: participant?.id ?? a.userId,
          user_id: a.userId,
          gameplay_role: a.role as string,
          assigned_at: now,
        };
      });

    if (roleInserts.length > 0) {
      const { error: rolesError } = await client
        .from("match_participant_roles")
        .insert(roleInserts);

      if (rolesError && !rolesError.message?.includes("duplicate")) {
        throw AppError.internal(`Failed to store private role assignments: ${rolesError.message}`);
      }
    }

    // Update active participants to ACTIVE
    await client
      .from("match_participants")
      .update({ participation_status: "ACTIVE", updated_at: now })
      .eq("match_id", matchId)
      .eq("participation_status", "READY");

    // Update match to PREPARING
    const { error: updateMatchError } = await client
      .from("matches")
      .update({
        status: "PREPARING",
        preparation_started_at: now,
        updated_at: now,
      })
      .eq("id", matchId);

    if (updateMatchError) {
      throw AppError.internal(`Failed to update match status to PREPARING: ${updateMatchError.message}`);
    }

    return this.getMatchById(userId, matchId);
  }

  /**
   * Retrieves the authenticated player's private gameplay role.
   * Enforces strict role isolation: Player A can never retrieve Player B's role.
   * Host receives only their own role. Nonparticipants receive 403 Forbidden.
   */
  async getMyRole(userId: string, matchId: string): Promise<PlayerRoleResponse> {
    const client = this.getClient();

    // Verify caller is a participant
    const { data: participantData, error: participantError } = await client
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .maybeSingle();

    if (participantError) {
      throw AppError.internal(`Failed to verify participant identity: ${participantError.message}`);
    }

    if (!participantData) {
      throw AppError.forbidden("Access denied: You are not a participant in this match");
    }

    const participant = participantData as MatchParticipantRow;

    if (participant.participation_status === "SPECTATING") {
      return { matchId, userId, role: null, isSpectator: true };
    }

    if (participant.participation_status === "WITHDRAWN") {
      return { matchId, userId, role: null, isWithdrawn: true };
    }

    // Retrieve caller's private role
    const { data: roleData, error: roleError } = await client
      .from("match_participant_roles")
      .select("*")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      throw AppError.internal(`Failed to retrieve private role: ${roleError.message}`);
    }

    if (!roleData) {
      // Role not yet assigned (e.g. still in LOBBY)
      return { matchId, userId, role: null };
    }

    const roleRow = roleData as MatchParticipantRoleRow;
    return {
      matchId,
      userId,
      role: roleRow.gameplay_role as GameplayRole,
    };
  }

  /**
   * Retrieves canonical match phase and countdown timing.
   * Authoritatively evaluates phase timers and advances expired phases automatically.
   */
  async getMatchTiming(userId: string, matchId: string): Promise<MatchTiming> {
    const client = this.getClient();

    // Verify match exists
    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match timing: ${matchError.message}`);
    }

    if (!matchData) {
      throw AppError.notFound("Match not found");
    }

    // Verify authorization: caller must be host or participant
    const isHost = matchData.host_user_id === userId;
    if (!isHost) {
      const { data: participantData } = await client
        .from("match_participants")
        .select("id")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!participantData) {
        throw AppError.forbidden("Access denied: You are not a participant in this match");
      }
    }

    let matchRow = matchData as MatchRow;
    const now = new Date();

    // Auto-advance expired preparation phase (300s) -> COUNTDOWN
    if (matchRow.status === "PREPARING" && matchRow.preparation_started_at) {
      const prepElapsed = Math.floor(
        (now.getTime() - new Date(matchRow.preparation_started_at).getTime()) / 1000
      );
      if (prepElapsed >= matchRow.preparation_duration_seconds) {
        try {
          const advanced = await this.advanceMatchPhase(matchRow.host_user_id, matchId, "COUNTDOWN");
          matchRow = {
            ...matchRow,
            status: advanced.status,
            countdown_started_at: advanced.countdownStartedAt ?? now.toISOString(),
          };
        } catch {
          // Ignore advance error if concurrent
        }
      }
    }

    // Auto-advance expired countdown phase (45s runner head start) -> ACTIVE
    if (matchRow.status === "COUNTDOWN" && matchRow.countdown_started_at) {
      const countdownElapsed = Math.floor(
        (now.getTime() - new Date(matchRow.countdown_started_at).getTime()) / 1000
      );
      if (countdownElapsed >= matchRow.runner_head_start_seconds) {
        try {
          const advanced = await this.advanceMatchPhase(matchRow.host_user_id, matchId, "ACTIVE");
          matchRow = {
            ...matchRow,
            status: advanced.status,
            started_at: advanced.startedAt ?? now.toISOString(),
          };
        } catch {
          // Ignore advance error if concurrent
        }
      }
    }

    // Calculate canonical countdowns
    let phaseRemainingSeconds: number | null = null;
    let hunterReleaseRemainingSeconds: number | null = null;
    let matchRemainingSeconds: number | null = null;

    if (matchRow.status === "PREPARING" && matchRow.preparation_started_at) {
      const prepElapsed = Math.floor(
        (now.getTime() - new Date(matchRow.preparation_started_at).getTime()) / 1000
      );
      phaseRemainingSeconds = Math.max(0, matchRow.preparation_duration_seconds - prepElapsed);
      matchRemainingSeconds = matchRow.match_duration_seconds;
    } else if (matchRow.status === "COUNTDOWN" && matchRow.countdown_started_at) {
      const countdownElapsed = Math.floor(
        (now.getTime() - new Date(matchRow.countdown_started_at).getTime()) / 1000
      );
      phaseRemainingSeconds = Math.max(0, matchRow.runner_head_start_seconds - countdownElapsed);
      hunterReleaseRemainingSeconds = phaseRemainingSeconds;
      matchRemainingSeconds = matchRow.match_duration_seconds;
    } else if (matchRow.status === "ACTIVE" && matchRow.started_at) {
      const activeElapsed = Math.floor(
        (now.getTime() - new Date(matchRow.started_at).getTime()) / 1000
      );
      phaseRemainingSeconds = Math.max(0, matchRow.match_duration_seconds - activeElapsed);
      hunterReleaseRemainingSeconds = 0;
      matchRemainingSeconds = phaseRemainingSeconds;
    } else if (matchRow.status === "LOBBY") {
      matchRemainingSeconds = matchRow.match_duration_seconds;
    } else {
      phaseRemainingSeconds = 0;
      hunterReleaseRemainingSeconds = 0;
      matchRemainingSeconds = 0;
    }

    return {
      matchId: matchRow.id,
      status: matchRow.status as MatchStatus,
      serverTime: now.toISOString(),
      preparationDurationSeconds: matchRow.preparation_duration_seconds,
      runnerHeadStartSeconds: matchRow.runner_head_start_seconds,
      matchDurationSeconds: matchRow.match_duration_seconds,
      preparationStartedAt: matchRow.preparation_started_at ?? null,
      countdownStartedAt: matchRow.countdown_started_at ?? null,
      startedAt: matchRow.started_at ?? null,
      phaseRemainingSeconds,
      hunterReleaseRemainingSeconds,
      matchRemainingSeconds,
    };
  }

  /**
   * Advances match lifecycle authoritatively.
   * Host or server operations only.
   * Strictly enforces that Hunters cannot be released before the 45-second Runner head start completes.
   */
  async advanceMatchPhase(
    userId: string,
    matchId: string,
    targetStatus?: MatchStatus
  ): Promise<Match> {
    const client = this.getClient();

    const { data: matchData, error: matchError } = await client
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) {
      throw AppError.internal(`Failed to retrieve match: ${matchError.message}`);
    }

    if (!matchData) {
      throw AppError.notFound("Match not found");
    }

    const matchRow = matchData as MatchRow;

    if (matchRow.host_user_id !== userId) {
      throw AppError.forbidden("Access denied: Only the match host can advance match lifecycle");
    }

    const currentStatus = matchRow.status as MatchStatus;
    const resolvedTarget = targetStatus ?? (currentStatus === "PREPARING" ? "COUNTDOWN" : "ACTIVE");

    // Idempotent check
    if (currentStatus === resolvedTarget) {
      return mapMatchRow(matchRow);
    }

    assertValidMatchTransition(currentStatus, resolvedTarget);

    const now = new Date();

    // Check head start if transitioning COUNTDOWN -> ACTIVE
    if (resolvedTarget === "ACTIVE") {
      if (currentStatus !== "COUNTDOWN") {
        throw AppError.badRequest(`Cannot transition to ACTIVE from '${currentStatus}'`);
      }

      if (matchRow.countdown_started_at) {
        const countdownElapsed = Math.floor(
          (now.getTime() - new Date(matchRow.countdown_started_at).getTime()) / 1000
        );
        if (countdownElapsed < matchRow.runner_head_start_seconds) {
          throw AppError.badRequest(
            `Runner head-start period is in progress. Hunters cannot be released before ${matchRow.runner_head_start_seconds} seconds have elapsed (${matchRow.runner_head_start_seconds - countdownElapsed}s remaining)`
          );
        }
      }
    }

    // Atomic RPC execution if available
    if (typeof client.rpc === "function") {
      const { data: rpcData, error: rpcError } = await client.rpc("advance_match_lifecycle_tx", {
        p_match_id: matchId,
        p_requester_user_id: userId,
        p_target_status: resolvedTarget,
      });

      if (!rpcError && rpcData?.match) {
        return mapMatchRow(rpcData.match as MatchRow);
      }

      if (rpcError) {
        if (rpcError.code === "PGRST202" || rpcError.message?.includes("not found")) {
          if (this.config.nodeEnv === "production") {
            throw AppError.internal(
              `Atomic database procedure advance_match_lifecycle_tx is missing: ${rpcError.message}`
            );
          }
        } else {
          if (rpcError.message?.includes("HEAD_START_IN_PROGRESS")) {
            throw AppError.badRequest("Runner head-start period is in progress. Hunters cannot be released early");
          }
          throw AppError.internal(`Failed to advance match lifecycle: ${rpcError.message}`);
        }
      }
    }

    // Fallback path
    const updatePayload: Partial<MatchRow> = {
      status: resolvedTarget,
      updated_at: now.toISOString(),
    };

    if (resolvedTarget === "COUNTDOWN") {
      updatePayload.countdown_started_at = now.toISOString();
    } else if (resolvedTarget === "ACTIVE") {
      updatePayload.started_at = now.toISOString();
    }

    const { data: updatedMatch, error: updateError } = await client
      .from("matches")
      .update(updatePayload)
      .eq("id", matchId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw AppError.internal(`Failed to advance match to '${resolvedTarget}': ${updateError.message}`);
    }

    if (!updatedMatch) {
      throw AppError.internal("Failed to update match lifecycle state");
    }

    return mapMatchRow(updatedMatch as MatchRow);
  }
}
