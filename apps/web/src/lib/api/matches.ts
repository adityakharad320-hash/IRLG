import type {
  Match,
  MatchParticipant,
  MatchWithParticipants,
  CreateMatchInput,
  JoinMatchInput,
  UpdateSettingsInput,
  ApiResponse,
} from "../../types/api";
import { ApiError, getApiBaseUrl } from "./users";

export { ApiError, getApiBaseUrl };

/**
 * Creates a new Classic Manhunt match with the authenticated user as host.
 */
export async function createMatch(
  accessToken: string,
  input: CreateMatchInput = {}
): Promise<MatchWithParticipants> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<MatchWithParticipants>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Match creation failed with status ${response.status}`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data;
}

/**
 * Joins a match via a 6-character invite code.
 */
export async function joinMatch(
  accessToken: string,
  input: JoinMatchInput
): Promise<MatchParticipant> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches/join`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<MatchParticipant>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Failed to join match (status ${response.status})`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data;
}

/**
 * Retrieves authoritative match details and roster for an authorized participant.
 */
export async function fetchMatch(
  accessToken: string,
  matchId: string
): Promise<MatchWithParticipants> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches/${matchId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<MatchWithParticipants>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Failed to retrieve match (status ${response.status})`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data;
}

/**
 * Toggles or updates caller readiness (READY / JOINED).
 */
export async function updateReadiness(
  accessToken: string,
  matchId: string,
  status: "READY" | "JOINED"
): Promise<MatchParticipant> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches/${matchId}/readiness`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<MatchParticipant>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Failed to update readiness (status ${response.status})`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data;
}

/**
 * Updates match settings authoritatively. Host only.
 */
export async function updateMatchSettings(
  accessToken: string,
  matchId: string,
  input: UpdateSettingsInput
): Promise<Match> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches/${matchId}/settings`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<{ match: Match }>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Failed to update settings (status ${response.status})`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data.match;
}

/**
 * Cancels a match lobby authoritatively. Host only.
 */
export async function cancelMatch(
  accessToken: string,
  matchId: string
): Promise<Match> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/matches/${matchId}/cancel`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to backend server: ${msg}`, 0, "NETWORK_ERROR");
  }

  const json = (await response.json()) as ApiResponse<{ match: Match }>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Failed to cancel match (status ${response.status})`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data.match;
}
