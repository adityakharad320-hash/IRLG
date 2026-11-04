-- IRLG Milestone 9: Secure Role Isolation, Preparation & Head-Start Lifecycle
-- Migration ID: 20261104160000_create_match_participant_roles.sql

-- 1. Add preparation and countdown phase timestamps to matches table
alter table public.matches
  add column if not exists preparation_started_at timestamptz null,
  add column if not exists countdown_started_at timestamptz null;

-- 2. Create private match_participant_roles table
-- CRITICAL SECURITY REQUIREMENT:
-- This table stores private gameplay roles (HUNTER / RUNNER) and must NOT be added
-- to supabase_realtime publication to eliminate CDC data leakage.
create table if not exists public.match_participant_roles (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  participant_id uuid not null references public.match_participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gameplay_role text not null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_participant_role_participant unique (participant_id),
  constraint uq_participant_role_match_user unique (match_id, user_id),
  constraint chk_participant_gameplay_role check (
    gameplay_role in ('HUNTER', 'RUNNER')
  )
);

-- 3. Indexes for private role lookups
create index if not exists idx_match_participant_roles_match_id on public.match_participant_roles(match_id);
create index if not exists idx_match_participant_roles_user_id on public.match_participant_roles(user_id);
create index if not exists idx_match_participant_roles_participant_id on public.match_participant_roles(participant_id);

-- 4. Trigger for updated_at
drop trigger if exists on_match_participant_roles_updated_at on public.match_participant_roles;
create trigger on_match_participant_roles_updated_at
  before update on public.match_participant_roles
  for each row
  execute function public.handle_updated_at();

-- 5. Row Level Security & Least Privilege on match_participant_roles
-- Direct INSERT, UPDATE, and DELETE are strictly REVOKED from untrusted roles.
-- Writes are performed exclusively by backend server via service_role.
alter table public.match_participant_roles enable row level security;

revoke all on table public.match_participant_roles from anon, authenticated;
grant select on table public.match_participant_roles to authenticated;

-- Strict RLS: A user can retrieve ONLY their own gameplay role.
-- Host is an administrative permission, NOT a gameplay privilege; host CANNOT view other players' roles.
drop policy if exists "Users can view only their own gameplay role" on public.match_participant_roles;
create policy "Users can view only their own gameplay role"
  on public.match_participant_roles
  for select
  to authenticated
  using (
    auth.uid() = user_id
  );

-- 6. Atomic RPC for starting match preparation and assigning roles
create or replace function public.start_match_preparation_tx(
  p_match_id uuid,
  p_host_user_id uuid,
  p_assignments jsonb
)
returns jsonb as $$
declare
  v_match public.matches;
  v_active_count int;
  v_assignment jsonb;
  v_participant_id uuid;
  v_assigned_count int := 0;
begin
  -- 1. Lock match row to serialize concurrent lifecycle starts
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_match.host_user_id != p_host_user_id then
    raise exception 'NOT_HOST' using errcode = 'P0008';
  end if;

  -- Idempotency: If match is already in PREPARING, return current state without reshuffling
  if v_match.status = 'PREPARING' then
    select count(*) into v_assigned_count
    from public.match_participant_roles
    where match_id = p_match_id;

    return jsonb_build_object(
      'match', to_jsonb(v_match),
      'assigned_count', v_assigned_count,
      'idempotent', true
    );
  end if;

  if v_match.status != 'LOBBY' then
    raise exception 'MATCH_NOT_IN_LOBBY' using errcode = 'P0001';
  end if;

  -- 2. Verify active player count and readiness
  select count(*) into v_active_count
  from public.match_participants
  where match_id = p_match_id
    and participation_status not in ('SPECTATING', 'WITHDRAWN')
  for update;

  if v_active_count < 8 then
    raise exception 'MINIMUM_PLAYERS_NOT_MET' using errcode = 'P0014';
  end if;

  if v_active_count > v_match.max_players then
    raise exception 'MAX_PLAYERS_EXCEEDED' using errcode = 'P0015';
  end if;

  -- All eligible active participants must be READY
  if exists (
    select 1
    from public.match_participants
    where match_id = p_match_id
      and participation_status not in ('SPECTATING', 'WITHDRAWN')
      and participation_status != 'READY'
  ) then
    raise exception 'NOT_ALL_PLAYERS_READY' using errcode = 'P0016';
  end if;

  if v_match.hunter_count >= v_active_count then
    raise exception 'HUNTER_COUNT_INVALID' using errcode = 'P0010';
  end if;

  -- 3. Insert secure role assignments into private table
  for v_assignment in select * from jsonb_array_elements(p_assignments)
  loop
    if (v_assignment->>'role') in ('HUNTER', 'RUNNER') then
      select id into v_participant_id
      from public.match_participants
      where match_id = p_match_id
        and user_id = (v_assignment->>'userId')::uuid;

      if v_participant_id is not null then
        insert into public.match_participant_roles (
          match_id,
          participant_id,
          user_id,
          gameplay_role
        ) values (
          p_match_id,
          v_participant_id,
          (v_assignment->>'userId')::uuid,
          v_assignment->>'role'
        )
        on conflict (match_id, user_id) do nothing;

        v_assigned_count := v_assigned_count + 1;
      end if;
    end if;
  end loop;

  -- 4. Advance active participants to ACTIVE
  update public.match_participants
  set
    participation_status = 'ACTIVE',
    updated_at = now()
  where match_id = p_match_id
    and participation_status = 'READY';

  -- 5. Transition match to PREPARING status
  update public.matches
  set
    status = 'PREPARING',
    preparation_started_at = now(),
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return jsonb_build_object(
    'match', to_jsonb(v_match),
    'assigned_count', v_assigned_count,
    'idempotent', false
  );
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- 7. Atomic RPC for lifecycle transitions (PREPARING -> COUNTDOWN -> ACTIVE)
create or replace function public.advance_match_lifecycle_tx(
  p_match_id uuid,
  p_requester_user_id uuid,
  p_target_status text
)
returns jsonb as $$
declare
  v_match public.matches;
  v_head_start_interval interval;
begin
  -- 1. Lock match row
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- If requester provided, verify host permissions
  if p_requester_user_id is not null and v_match.host_user_id != p_requester_user_id then
    raise exception 'NOT_HOST' using errcode = 'P0008';
  end if;

  -- Idempotent check
  if v_match.status = p_target_status then
    return jsonb_build_object('match', to_jsonb(v_match), 'idempotent', true);
  end if;

  -- Transition: PREPARING -> COUNTDOWN
  if p_target_status = 'COUNTDOWN' then
    if v_match.status != 'PREPARING' then
      raise exception 'INVALID_LIFECYCLE_TRANSITION' using errcode = 'P0018';
    end if;

    update public.matches
    set
      status = 'COUNTDOWN',
      countdown_started_at = now(),
      updated_at = now()
    where id = p_match_id
    returning * into v_match;

    return jsonb_build_object('match', to_jsonb(v_match), 'idempotent', false);
  end if;

  -- Transition: COUNTDOWN -> ACTIVE
  if p_target_status = 'ACTIVE' then
    if v_match.status != 'COUNTDOWN' then
      raise exception 'INVALID_LIFECYCLE_TRANSITION' using errcode = 'P0018';
    end if;

    -- Enforce 45-second Runner head-start period strictly
    v_head_start_interval := (v_match.runner_head_start_seconds || ' seconds')::interval;
    if v_match.countdown_started_at is null or now() < (v_match.countdown_started_at + v_head_start_interval) then
      raise exception 'HEAD_START_IN_PROGRESS' using errcode = 'P0017';
    end if;

    update public.matches
    set
      status = 'ACTIVE',
      started_at = now(),
      updated_at = now()
    where id = p_match_id
    returning * into v_match;

    return jsonb_build_object('match', to_jsonb(v_match), 'idempotent', false);
  end if;

  raise exception 'UNSUPPORTED_TARGET_STATUS' using errcode = 'P0019';
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- Enforce trusted function ownership
alter function public.start_match_preparation_tx(uuid, uuid, jsonb) owner to postgres;
alter function public.advance_match_lifecycle_tx(uuid, uuid, text) owner to postgres;

-- Restrict execution strictly to service_role (backend server only)
revoke execute on function public.start_match_preparation_tx(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_match_preparation_tx(uuid, uuid, jsonb) to service_role;

-- Host or server-executed lifecycle advance
revoke execute on function public.advance_match_lifecycle_tx(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.advance_match_lifecycle_tx(uuid, uuid, text) to service_role;
