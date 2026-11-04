import type {
  CurrentUserResponse,
  UserProfile,
  UpdateProfileInput,
  ApiResponse,
} from "../../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://localhost:4000/api/v1";
}

/**
 * Calls Fastify GET /api/v1/users/me with the authenticated Supabase Bearer token.
 * Retrieves authenticated user identity and database profile.
 */
export async function fetchCurrentUserProfile(
  accessToken: string
): Promise<CurrentUserResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/users/me`;

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

  const json = (await response.json()) as ApiResponse<CurrentUserResponse>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Request failed with status ${response.status}`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data;
}

/**
 * Calls Fastify PATCH /api/v1/users/me with the authenticated Supabase Bearer token.
 * Updates user profile fields (e.g. displayName, avatarUrl).
 */
export async function updateCurrentUserProfile(
  accessToken: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/users/me`;

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

  const json = (await response.json()) as ApiResponse<{ profile: UserProfile }>;

  if (!response.ok || !json.success) {
    const errorPayload = !json.success ? json.error : undefined;
    throw new ApiError(
      errorPayload?.message || `Update failed with status ${response.status}`,
      response.status,
      errorPayload?.code || "API_ERROR",
      errorPayload?.details
    );
  }

  return json.data.profile;
}
