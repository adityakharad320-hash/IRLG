-- IRLG Milestone 8: Multiplayer Lobby Realtime & Atomic Mutation RPCs
-- Migration ID: 20261104130000_enable_lobby_realtime.sql

-- 1. Enable Full Replica Identity for accurate realtime change notifications
alter table public.matches replica identity full;
alter table public.match_participants replica identity full;

-- 2. Add matches and match_participants to Supabase Realtime publication
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_participants;

-- 3. Atomic RPC for participant readiness update
create or replace function public.update_participant_readiness_tx(
  p_match_id uuid,
  p_user_id uuid,
  p_new_status text
)
returns jsonb as $$
declare
  v_match public.matches;
  v_participant public.match_participants;
begin
  -- Validate target readiness status
  if p_new_status not in ('READY', 'JOINED') then
    raise exception 'INVALID_READINESS_STATUS' using errcode = 'P0007';
  end if;

  -- 1. Lock match row first using SELECT ... FOR UPDATE to serialize against
  -- concurrent cancellation or lifecycle transitions.
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

  -- Lock participant row to ensure atomic readiness modification
  select * into v_participant
  from public.match_participants
  where match_id = p_match_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0004';
  end if;

  if v_participant.participation_status = 'SPECTATING' then
    raise exception 'SPECTATOR_CANNOT_READY' using errcode = 'P0005';
  end if;

  if v_participant.participation_status = 'WITHDRAWN' then
    raise exception 'WITHDRAWN_CANNOT_READY' using errcode = 'P0006';
  end if;

  -- Update readiness atomically without altering role, host, or other fields
  update public.match_participants
  set
    participation_status = p_new_status,
    ready_at = case when p_new_status = 'READY' then now() else null end,
    updated_at = now()
  where id = v_participant.id
  returning * into v_participant;

  return to_jsonb(v_participant);
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- 4. Atomic RPC for host settings update
create or replace function public.update_match_settings_tx(
  p_match_id uuid,
  p_user_id uuid,
  p_max_players int default null,
  p_hunter_count int default null,
  p_match_duration_seconds int default null
)
returns jsonb as $$
declare
  v_match public.matches;
  v_new_max_players int;
  v_new_hunter_count int;
  v_new_duration int;
  v_active_slot_count int;
begin
  -- Lock match row
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_match.host_user_id != p_user_id then
    raise exception 'NOT_HOST' using errcode = 'P0008';
  end if;

  if v_match.status != 'LOBBY' then
    raise exception 'MATCH_NOT_IN_LOBBY' using errcode = 'P0001';
  end if;

  v_new_max_players := coalesce(p_max_players, v_match.max_players);
  v_new_hunter_count := coalesce(p_hunter_count, v_match.hunter_count);
  v_new_duration := coalesce(p_match_duration_seconds, v_match.match_duration_seconds);

  -- Enforce canonical bounds at database transaction level
  if v_new_max_players < 8 or v_new_max_players > 12 then
    raise exception 'MAX_PLAYERS_OUT_OF_BOUNDS' using errcode = 'P0011';
  end if;

  if v_new_hunter_count < 2 or v_new_hunter_count > 3 then
    raise exception 'HUNTER_COUNT_OUT_OF_BOUNDS' using errcode = 'P0012';
  end if;

  if v_new_hunter_count >= v_new_max_players then
    raise exception 'HUNTER_COUNT_INVALID' using errcode = 'P0010';
  end if;

  if v_new_duration < 1200 or v_new_duration > 1800 then
    raise exception 'DURATION_OUT_OF_BOUNDS' using errcode = 'P0013';
  end if;

  -- Verify active slot occupancy does not exceed new capacity
  select count(*) into v_active_slot_count
  from public.match_participants
  where match_id = p_match_id
    and participation_status not in ('SPECTATING', 'WITHDRAWN');

  if v_active_slot_count > v_new_max_players then
    raise exception 'CAPACITY_BELOW_OCCUPANCY' using errcode = 'P0009';
  end if;

  update public.matches
  set
    max_players = v_new_max_players,
    hunter_count = v_new_hunter_count,
    match_duration_seconds = v_new_duration,
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  return to_jsonb(v_match);
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

-- Enforce trusted function ownership
alter function public.update_participant_readiness_tx(uuid, uuid, text) owner to postgres;
alter function public.update_match_settings_tx(uuid, uuid, int, int, int) owner to postgres;

-- Restrict execution strictly to service_role (backend server only)
revoke execute on function public.update_participant_readiness_tx(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.update_participant_readiness_tx(uuid, uuid, text) to service_role;

revoke execute on function public.update_match_settings_tx(uuid, uuid, int, int, int) from public, anon, authenticated;
grant execute on function public.update_match_settings_tx(uuid, uuid, int, int, int) to service_role;
