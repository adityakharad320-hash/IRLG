import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseMatchService,
  type MatchParticipantRow,
  type MatchParticipantRoleRow,
} from "../src/services/match.service.js";
import { loadConfig } from "../src/config/index.js";

function createMockConfig() {
  const config = loadConfig();
  config.supabase.isConfigured = true;
  config.supabase.url = "https://mock-supabase.co";
  config.supabase.serviceRoleKey = "mock-service-role-key";
  return config;
}

describe("Milestone 9: Private Role Isolation & Security Boundaries", () => {
  let service: SupabaseMatchService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SupabaseMatchService(createMockConfig());
  });

  const mockMatchId = "match-sec-101";

  const mockParticipants: MatchParticipantRow[] = [
    {
      id: "part-host",
      match_id: mockMatchId,
      user_id: "user-host",
      gameplay_role: null,
      participation_status: "ACTIVE",
      is_host: true,
      joined_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
      caught_at: null,
      disconnected_at: null,
      withdrawn_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "part-alice",
      match_id: mockMatchId,
      user_id: "user-alice",
      gameplay_role: null,
      participation_status: "ACTIVE",
      is_host: false,
      joined_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
      caught_at: null,
      disconnected_at: null,
      withdrawn_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "part-bob",
      match_id: mockMatchId,
      user_id: "user-bob",
      gameplay_role: null,
      participation_status: "ACTIVE",
      is_host: false,
      joined_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
      caught_at: null,
      disconnected_at: null,
      withdrawn_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockPrivateRoles: Record<string, MatchParticipantRoleRow> = {
    "user-host": {
      id: "role-1",
      match_id: mockMatchId,
      participant_id: "part-host",
      user_id: "user-host",
      gameplay_role: "RUNNER",
      assigned_at: new Date().toISOString(),
    },
    "user-alice": {
      id: "role-2",
      match_id: mockMatchId,
      participant_id: "part-alice",
      user_id: "user-alice",
      gameplay_role: "HUNTER",
      assigned_at: new Date().toISOString(),
    },
    "user-bob": {
      id: "role-3",
      match_id: mockMatchId,
      participant_id: "part-bob",
      user_id: "user-bob",
      gameplay_role: "RUNNER",
      assigned_at: new Date().toISOString(),
    },
  };

  const createMockDbClient = () => {
    return {
      from: vi.fn((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: mockMatchId,
                    host_user_id: "user-host",
                    status: "PREPARING",
                    max_players: 8,
                    hunter_count: 2,
                    preparation_duration_seconds: 300,
                    runner_head_start_seconds: 45,
                    match_duration_seconds: 1500,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "match_participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field: string, _val: string) => {
                if (field === "match_id") {
                  return {
                    eq: vi.fn((subField: string, subVal: string) => {
                      if (subField === "user_id") {
                        const found = mockParticipants.find((p) => p.user_id === subVal);
                        return {
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: found ?? null,
                            error: null,
                          }),
                        };
                      }
                      return {};
                    }),
                    order: vi.fn().mockResolvedValue({
                      data: mockParticipants,
                      error: null,
                    }),
                  };
                }
                return {};
              }),
            }),
          };
        }
        if (table === "match_participant_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field: string, _val: string) => {
                if (field === "match_id") {
                  return {
                    eq: vi.fn((subField: string, subVal: string) => {
                      if (subField === "user_id") {
                        const roleRow = mockPrivateRoles[subVal];
                        return {
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: roleRow ?? null,
                            error: null,
                          }),
                        };
                      }
                      return {};
                    }),
                  };
                }
                return {};
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;
  };

  it("allows Player Alice to retrieve only her own gameplay role", async () => {
    const mockClient = createMockDbClient();
    vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

    const aliceRole = await service.getMyRole("user-alice", mockMatchId);

    expect(aliceRole.userId).toBe("user-alice");
    expect(aliceRole.role).toBe("HUNTER");
  });

  it("allows Player Bob to retrieve only his own gameplay role", async () => {
    const mockClient = createMockDbClient();
    vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

    const bobRole = await service.getMyRole("user-bob", mockMatchId);

    expect(bobRole.userId).toBe("user-bob");
    expect(bobRole.role).toBe("RUNNER");
  });

  it("prohibits nonparticipants from retrieving any gameplay role (returns 403 Forbidden)", async () => {
    const mockClient = createMockDbClient();
    vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

    await expect(service.getMyRole("attacker-outsider", mockMatchId)).rejects.toThrow(
      "Access denied: You are not a participant in this match"
    );
  });

  it("ensures host cannot view other players' roles merely because they are host", async () => {
    const mockClient = createMockDbClient();
    vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

    // Host calls getMyRole -> gets ONLY host's role
    const hostRole = await service.getMyRole("user-host", mockMatchId);
    expect(hostRole.userId).toBe("user-host");
    expect(hostRole.role).toBe("RUNNER");

    // Host calls getMatchById (roster inspection)
    const matchWithRoster = await service.getMatchById("user-host", mockMatchId);

    const aliceInRoster = matchWithRoster.participants.find((p) => p.userId === "user-alice");
    const bobInRoster = matchWithRoster.participants.find((p) => p.userId === "user-bob");

    // In pre-game/active status, other players' roles are masked to NULL even for the host!
    expect(aliceInRoster?.gameplayRole).toBeNull();
    expect(bobInRoster?.gameplayRole).toBeNull();
  });

  it("prohibits spectators and withdrawn users from having active gameplay roles", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "match_participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "p-spec",
                      match_id: mockMatchId,
                      user_id: "user-spec",
                      participation_status: "SPECTATING",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    vi.spyOn(service as unknown as { getClient: () => SupabaseClient }, "getClient").mockReturnValue(mockClient);

    const specRole = await service.getMyRole("user-spec", mockMatchId);
    expect(specRole.role).toBeNull();
    expect(specRole.isSpectator).toBe(true);
  });
});
