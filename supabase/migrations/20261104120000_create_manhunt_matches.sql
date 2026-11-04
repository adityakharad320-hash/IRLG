-- IRLG Milestone 7: Classic Manhunt v1.0 Schema & Security
-- Migration ID: 20261104120000_create_manhunt_matches.sql

-- 1. Create matches table
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete restrict,
  invite_code text not null unique,
  status text not null default 'LOBBY',
  max_players integer not null default 12,
  hunter_count integer not null default 2,
  match_duration_seconds integer not null default 1500,
  preparation_duration_seconds integer not null default 300,
  runner_head_start_seconds integer not null default 45,
  winner text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,

  constraint chk_matches_invite_code check (
    char_length(invite_code) = 6 and invite_code ~ '^[A-Z0-9]{6}$'
  ),
  constraint chk_matches_status check (
    status in ('LOBBY', 'PREPARING', 'COUNTDOWN', 'ACTIVE', 'PAUSED', 'COMPLETED', 'RESULTS', 'CANCELLED')
  ),
  constraint chk_matches_max_players check (
    max_players >= 8 and max_players <= 12
  ),
  constraint chk_matches_hunter_count check (
    hunter_count >= 2 and hunter_count <= 3 and hunter_count < max_players
  ),
  constraint chk_matches_match_duration check (
    match_duration_seconds >= 1200 and match_duration_seconds <= 1800
  ),
  constraint chk_matches_prep_duration check (
    preparation_duration_seconds = 300
  ),
  constraint chk_matches_head_start check (
    runner_head_start_seconds = 45
  ),
  constraint chk_matches_winner check (
    winner is null or winner in ('RUNNERS', 'HUNTERS', 'DRAW')
  )
);

-- 2. Indexes for matches
create index if not exists idx_matches_host_user_id on public.matches(host_user_id);
create index if not exists idx_matches_invite_code on public.matches(invite_code);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_created_at on public.matches(created_at desc);

-- 3. Trigger for updated_at on matches
drop trigger if exists on_matches_updated_at on public.matches;
create trigger on_matches_updated_at
  before update on public.matches
  for each row
  execute function public.handle_updated_at();

-- 4. Create match_participants table
create table if not exists public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gameplay_role text null,
  participation_status text not null default 'JOINED',
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  ready_at timestamptz null,
  caught_at timestamptz null,
  disconnected_at timestamptz null,
  withdrawn_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_match_participant unique (match_id, user_id),
  constraint chk_participant_role check (
    gameplay_role is null or gameplay_role in ('HUNTER', 'RUNNER')
  ),
  constraint chk_participant_status check (
    participation_status in ('JOINED', 'READY', 'ACTIVE', 'CAUGHT', 'DISCONNECTED', 'WITHDRAWN', 'SPECTATING')
  ),
  constraint chk_spectator_no_role check (
    participation_status != 'SPECTATING' or gameplay_role is null
  )
);

-- 5. Indexes for match_participants
create index if not exists idx_match_participants_match_id on public.match_participants(match_id);
create index if not exists idx_match_participants_user_id on public.match_participants(user_id);
create index if not exists idx_match_participants_status on public.match_participants(participation_status);
create index if not exists idx_match_participants_role on public.match_participants(gameplay_role);

-- 6. Trigger for updated_at on match_participants
drop trigger if exists on_match_participants_updated_at on public.match_participants;
create trigger on_match_participants_updated_at
  before update on public.match_participants
  for each row
  execute function public.handle_updated_at();

-- 7. Security definer helper functions to prevent recursive RLS evaluations
-- Identity is derived internally via auth.uid() to eliminate authorization oracles.
-- search_path is set to pg_catalog, public to prevent operator/function hijacking.
create or replace function public.is_match_participant(_match_id uuid)
returns boolean as $$
declare
  v_caller_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.match_participants
    where match_id = _match_id
      and user_id = v_caller_id
  );
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.is_match_host(_match_id uuid)
returns boolean as $$
declare
  v_caller_id uuid;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.matches
    where id = _match_id
      and host_user_id = v_caller_id
  );
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- Drop obsolete 2-argument signatures if they existed to prevent any oracle bypass
drop function if exists public.is_match_participant(uuid, uuid);
drop function if exists public.is_match_host(uuid, uuid);

-- Enforce trusted function ownership
alter function public.is_match_participant(uuid) owner to postgres;
alter function public.is_match_host(uuid) owner to postgres;

-- Revoke default public execute on helper functions and grant only to authenticated and service_role
revoke execute on function public.is_match_participant(uuid) from public, anon;
grant execute on function public.is_match_participant(uuid) to authenticated, service_role;

revoke execute on function public.is_match_host(uuid) from public, anon;
grant execute on function public.is_match_host(uuid) to authenticated, service_role;

-- 8. Atomic Database Transactions (RPC functions for authoritative server use)
create or replace function public.create_manhunt_match_tx(
  p_host_user_id uuid,
  p_invite_code text,
  p_max_players int default 12,
  p_hunter_count int default 2,
  p_match_duration_seconds int default 1500
)
returns jsonb as $$
declare
  v_match public.matches;
  v_participant public.match_participants;
begin
  insert into public.matches (
    host_user_id,
    invite_code,
    status,
    max_players,
    hunter_count,
    match_duration_seconds,
    preparation_duration_seconds,
    runner_head_start_seconds
  ) values (
    p_host_user_id,
    p_invite_code,
    'LOBBY',
    p_max_players,
    p_hunter_count,
    p_match_duration_seconds,
    300,
    45
  )
  returning * into v_match;

  insert into public.match_participants (
    match_id,
    user_id,
    gameplay_role,
    participation_status,
    is_host
  ) values (
    v_match.id,
    p_host_user_id,
    null,
    'JOINED',
    true
  )
  returning * into v_participant;

  return jsonb_build_object(
    'match', to_jsonb(v_match),
    'participant', to_jsonb(v_participant)
  );
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.join_manhunt_match_tx(
  p_match_id uuid,
  p_user_id uuid,
  p_as_spectator boolean default false
)
returns jsonb as $$
declare
  v_match public.matches;
  v_participant public.match_participants;
  v_active_slot_count int;
  v_status text;
begin
  -- Lock match row to serialize concurrent joins and prevent over-subscription
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_match.status != 'LOBBY' then
    raise exception 'MATCH_NOT_IN_LOBBY' using errcode = 'P0001';
  end if;

  -- Active-player-slot capacity semantics:
  -- The 8-12 max_players limit strictly governs active gameplay slots.
  -- JOINED, READY, and DISCONNECTED (reconnection reserved) occupy active player slots.
  -- SPECTATING and WITHDRAWN do not occupy active player slots.
  if not p_as_spectator then
    select count(*) into v_active_slot_count
    from public.match_participants
    where match_id = p_match_id
      and participation_status not in ('SPECTATING', 'WITHDRAWN');

    if v_active_slot_count >= v_match.max_players then
      raise exception 'MATCH_FULL' using errcode = 'P0003';
    end if;
  end if;

  v_status := case when p_as_spectator then 'SPECTATING' else 'JOINED' end;

  insert into public.match_participants (
    match_id,
    user_id,
    gameplay_role,
    participation_status,
    is_host
  ) values (
    p_match_id,
    p_user_id,
    null,
    v_status,
    false
  )
  returning * into v_participant;

  return to_jsonb(v_participant);
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- Enforce trusted function ownership
alter function public.create_manhunt_match_tx(uuid, text, int, int, int) owner to postgres;
alter function public.join_manhunt_match_tx(uuid, uuid, boolean) owner to postgres;

-- Restrict RPC transaction functions strictly to service_role (backend server only)
revoke execute on function public.create_manhunt_match_tx(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.create_manhunt_match_tx(uuid, text, int, int, int) to service_role;

revoke execute on function public.join_manhunt_match_tx(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.join_manhunt_match_tx(uuid, uuid, boolean) to service_role;

-- 9. Schema & Table-Level Privileges (Least Privilege Principle)
-- Defense-in-depth: Ensure untrusted roles cannot create objects in the public schema
revoke create on schema public from public, anon, authenticated;

-- Untrusted clients (anon, authenticated) are strictly granted read-only access (SELECT).
-- Direct INSERT, UPDATE, and DELETE are REVOKED to guarantee the backend server remains authoritative.
revoke all on table public.matches from anon, authenticated;
grant select on table public.matches to authenticated;

revoke all on table public.match_participants from anon, authenticated;
grant select on table public.match_participants to authenticated;

-- 10. Enable Row Level Security (RLS) on both tables
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;

-- 11. Read-Only RLS Policies for matches
drop policy if exists "Users can view matches they host or participate in" on public.matches;
drop policy if exists "Authenticated users can create matches as host" on public.matches;
drop policy if exists "Hosts can update their own matches" on public.matches;

create policy "Users can view matches they host or participate in"
  on public.matches
  for select
  to authenticated
  using (
    auth.uid() = host_user_id
    or public.is_match_participant(id)
  );

-- 12. Read-Only RLS Policies for match_participants
drop policy if exists "Participants and hosts can view match roster" on public.match_participants;
drop policy if exists "Authenticated users can join as participant" on public.match_participants;
drop policy if exists "Participants can update their own record safely" on public.match_participants;

create policy "Participants and hosts can view match roster"
  on public.match_participants
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_match_host(match_id)
    or public.is_match_participant(match_id)
  );
