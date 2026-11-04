import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Supabase Migration Structure & Security Rules", () => {
  const migrationsDir = path.resolve(process.cwd(), "../../supabase/migrations");
  // In monorepo root or server directory
  const rootMigrationsDir = fs.existsSync(migrationsDir)
    ? migrationsDir
    : path.resolve(process.cwd(), "supabase/migrations");

  it("contains versioned create_profiles migration file", () => {
    const files = fs.readdirSync(rootMigrationsDir);
    const profileMigration = files.find((f) => f.includes("create_profiles.sql"));
    expect(profileMigration).toBeDefined();

    const content = fs.readFileSync(path.join(rootMigrationsDir, profileMigration!), "utf-8");

    // 1. Table structure
    expect(content).toContain("create table if not exists public.profiles");
    expect(content).toContain("references auth.users(id)");
    expect(content).toContain("on delete cascade");
    expect(content).toContain("display_name text not null");

    // 2. Constraints & indexes
    expect(content).toContain("constraint display_name_length check");
    expect(content).toContain("idx_profiles_display_name");

    // 3. Row Level Security
    expect(content).toContain("alter table public.profiles enable row level security;");
    expect(content).toContain('create policy "Users can read own profile"');
    expect(content).toContain('create policy "Users can update own profile"');
    expect(content).toContain('create policy "Users can insert own profile"');

    // 4. Verification that auth.uid() is used for ownership
    expect(content).toContain("auth.uid() = id");

    // 5. Triggers
    expect(content).toContain("handle_updated_at");
    expect(content).toContain("handle_new_user");
    expect(content).toContain("security definer set search_path = public");
  });

  it("contains versioned create_manhunt_matches migration file with strict constraints & RLS", () => {
    const files = fs.readdirSync(rootMigrationsDir);
    const manhuntMigration = files.find((f) => f.includes("create_manhunt_matches.sql"));
    expect(manhuntMigration).toBeDefined();

    const content = fs.readFileSync(path.join(rootMigrationsDir, manhuntMigration!), "utf-8");

    // 1. Matches Table Structure & Constraints
    expect(content).toContain("create table if not exists public.matches");
    expect(content).toContain("host_user_id uuid not null references auth.users(id)");
    expect(content).toContain("invite_code text not null unique");
    expect(content).toContain("chk_matches_invite_code check");
    expect(content).toContain("chk_matches_status check");
    expect(content).toContain("chk_matches_max_players check");
    expect(content).toContain("chk_matches_hunter_count check");
    expect(content).toContain("chk_matches_match_duration check");
    expect(content).toContain("preparation_duration_seconds = 300");
    expect(content).toContain("runner_head_start_seconds = 45");

    // 2. Match Participants Structure & Constraints
    expect(content).toContain("create table if not exists public.match_participants");
    expect(content).toContain("references public.matches(id) on delete cascade");
    expect(content).toContain("references auth.users(id) on delete cascade");
    expect(content).toContain("constraint uq_match_participant unique (match_id, user_id)");
    expect(content).toContain("chk_participant_status check");
    expect(content).toContain("participation_status in ('JOINED', 'READY', 'ACTIVE', 'CAUGHT', 'DISCONNECTED', 'WITHDRAWN', 'SPECTATING')");
    expect(content).toContain("chk_spectator_no_role check");

    // 3. Row Level Security & Least Privilege Table Grants
    expect(content).toContain("alter table public.matches enable row level security;");
    expect(content).toContain("alter table public.match_participants enable row level security;");
    expect(content).toContain("revoke all on table public.matches from anon, authenticated;");
    expect(content).toContain("grant select on table public.matches to authenticated;");
    expect(content).toContain("revoke all on table public.match_participants from anon, authenticated;");
    expect(content).toContain("grant select on table public.match_participants to authenticated;");

    // 4. Verification that untrusted roles DO NOT have direct INSERT/UPDATE policies
    expect(content).not.toContain('create policy "Authenticated users can create matches as host"');
    expect(content).not.toContain('create policy "Hosts can update their own matches"');
    expect(content).not.toContain('create policy "Authenticated users can join as participant"');
    expect(content).not.toContain('create policy "Participants can update their own record safely"');

    // 5. Read-Only Policies for authenticated users
    expect(content).toContain('create policy "Users can view matches they host or participate in"');
    expect(content).toContain('create policy "Participants and hosts can view match roster"');

    // 6. Security Definer Helper Functions: Elimination of Authorization Oracles & search_path hardening
    // Must NOT accept caller-controlled _user_id; identity must be internally derived via auth.uid()
    expect(content).toContain("create or replace function public.is_match_participant(_match_id uuid)");
    expect(content).toContain("create or replace function public.is_match_host(_match_id uuid)");
    expect(content).toContain("v_caller_id := auth.uid();");
    expect(content).toContain("drop function if exists public.is_match_participant(uuid, uuid);");
    expect(content).toContain("drop function if exists public.is_match_host(uuid, uuid);");
    expect(content).not.toContain("function public.is_match_participant(_match_id uuid, _user_id uuid)");
    expect(content).not.toContain("function public.is_match_host(_match_id uuid, _user_id uuid)");

    // Safe search_path configuration
    expect(content).toContain("security definer set search_path = pg_catalog, public;");

    // Trusted ownership
    expect(content).toContain("alter function public.is_match_participant(uuid) owner to postgres;");
    expect(content).toContain("alter function public.is_match_host(uuid) owner to postgres;");

    // Least privilege execute grants
    expect(content).toContain("revoke execute on function public.is_match_participant(uuid) from public, anon;");
    expect(content).toContain("grant execute on function public.is_match_participant(uuid) to authenticated, service_role;");
    expect(content).toContain("revoke execute on function public.is_match_host(uuid) from public, anon;");
    expect(content).toContain("grant execute on function public.is_match_host(uuid) to authenticated, service_role;");

    // Defense-in-depth: untrusted roles cannot create objects in public schema
    expect(content).toContain("revoke create on schema public from public, anon, authenticated;");

    // 7. Atomic RPC Transactions & Capacity Semantics
    expect(content).toContain("create or replace function public.create_manhunt_match_tx");
    expect(content).toContain("create or replace function public.join_manhunt_match_tx");
    expect(content).toContain("for update");
    // Explicitly verifies active player slots exclude SPECTATING and WITHDRAWN
    expect(content).toContain("participation_status not in ('SPECTATING', 'WITHDRAWN')");
    expect(content).toContain("revoke execute on function public.create_manhunt_match_tx(uuid, text, int, int, int) from public, anon, authenticated;");
    expect(content).toContain("grant execute on function public.create_manhunt_match_tx(uuid, text, int, int, int) to service_role;");
    expect(content).toContain("revoke execute on function public.join_manhunt_match_tx(uuid, uuid, boolean) from public, anon, authenticated;");
    expect(content).toContain("grant execute on function public.join_manhunt_match_tx(uuid, uuid, boolean) to service_role;");
  });

  it("contains versioned enable_lobby_realtime migration file with Realtime publication and atomic RPCs", () => {
    const files = fs.readdirSync(rootMigrationsDir);
    const realtimeMigration = files.find((f) => f.includes("enable_lobby_realtime.sql"));
    expect(realtimeMigration).toBeDefined();

    const content = fs.readFileSync(path.join(rootMigrationsDir, realtimeMigration!), "utf-8");

    // 1. Replica identity full for CDC changes
    expect(content).toContain("alter table public.matches replica identity full;");
    expect(content).toContain("alter table public.match_participants replica identity full;");

    // 2. Realtime publication additions
    expect(content).toContain("alter publication supabase_realtime add table public.matches;");
    expect(content).toContain("alter publication supabase_realtime add table public.match_participants;");

    // 3. Atomic readiness RPC with match row locking for concurrency serialization
    expect(content).toContain("create or replace function public.update_participant_readiness_tx");
    expect(content).toContain("select * into v_match\n  from public.matches\n  where id = p_match_id\n  for update;");
    expect(content).toContain("p_new_status not in ('READY', 'JOINED')");
    expect(content).toContain("INVALID_READINESS_STATUS");
    expect(content).toContain("SPECTATOR_CANNOT_READY");
    expect(content).toContain("WITHDRAWN_CANNOT_READY");
    expect(content).toContain("revoke execute on function public.update_participant_readiness_tx(uuid, uuid, text) from public, anon, authenticated;");
    expect(content).toContain("grant execute on function public.update_participant_readiness_tx(uuid, uuid, text) to service_role;");

    // 4. Atomic settings RPC with match row locking and bounds validation
    expect(content).toContain("create or replace function public.update_match_settings_tx");
    expect(content).toContain("v_match.host_user_id != p_user_id");
    expect(content).toContain("MAX_PLAYERS_OUT_OF_BOUNDS");
    expect(content).toContain("HUNTER_COUNT_OUT_OF_BOUNDS");
    expect(content).toContain("HUNTER_COUNT_INVALID");
    expect(content).toContain("DURATION_OUT_OF_BOUNDS");
    expect(content).toContain("CAPACITY_BELOW_OCCUPANCY");
    expect(content).toContain("participation_status not in ('SPECTATING', 'WITHDRAWN')");
    expect(content).toContain("revoke execute on function public.update_match_settings_tx(uuid, uuid, int, int, int) from public, anon, authenticated;");
    expect(content).toContain("grant execute on function public.update_match_settings_tx(uuid, uuid, int, int, int) to service_role;");
  });
});
