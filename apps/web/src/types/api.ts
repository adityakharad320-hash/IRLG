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

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type MatchStatus =
  | "LOBBY"
  | "PREPARING"
  | "COUNTDOWN"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "RESULTS"
  | "CANCELLED";

export type ParticipantStatus =
  | "JOINED"
  | "READY"
  | "ACTIVE"
  | "CAUGHT"
  | "DISCONNECTED"
  | "WITHDRAWN"
  | "SPECTATING";

export type GameplayRole = "HUNTER" | "RUNNER";

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
  winner: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  preparationStartedAt?: string | null;
  countdownStartedAt?: string | null;
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

export interface MatchTiming {
  matchId: string;
  status: MatchStatus;
  serverTime: string;
  preparationDurationSeconds: number;
  runnerHeadStartSeconds: number;
  matchDurationSeconds: number;
  preparationStartedAt: string | null;
  countdownStartedAt: string | null;
  startedAt: string | null;
  phaseRemainingSeconds: number | null;
  hunterReleaseRemainingSeconds: number | null;
  matchRemainingSeconds: number | null;
}

export interface PlayerRoleResponse {
  matchId: string;
  userId: string;
  role: GameplayRole | null;
  isSpectator?: boolean;
  isWithdrawn?: boolean;
}


export interface CreateMatchInput {
  maxPlayers?: number;
  hunterCount?: number;
  matchDurationSeconds?: number;
}

export interface JoinMatchInput {
  inviteCode: string;
  asSpectator?: boolean;
}

export interface UpdateSettingsInput {
  maxPlayers?: number;
  hunterCount?: number;
  matchDurationSeconds?: number;
}
