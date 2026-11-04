import type {
  MatchStatus,
  ParticipantStatus,
  GameplayRole,
  MatchWinner,
} from "../domain/manhunt/constants.js";

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

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserResponse {
  user: {
    id: string;
    email?: string;
    role?: string;
  };
  profile: UserProfile;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Match {
  id: string;
  hostUserId: string;
  inviteCode: string;
  status: MatchStatus;
  maxPlayers: number;
  hunterCount: number;
  matchDurationSeconds: number;
  preparationDurationSeconds: number;
  runnerHeadStartSeconds: number;
  winner: MatchWinner | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface MatchParticipant {
  id: string;
  matchId: string;
  userId: string;
  gameplayRole: GameplayRole | null;
  participationStatus: ParticipantStatus;
  isHost: boolean;
  joinedAt: string;
  readyAt: string | null;
  caughtAt: string | null;
  disconnectedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface MatchWithParticipants {
  match: Match;
  participants: MatchParticipant[];
}

export interface InviteLookupResult {
  matchId: string;
  status: MatchStatus;
  maxPlayers: number;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
