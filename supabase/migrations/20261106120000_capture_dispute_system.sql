-- IRLG Milestone 12: Capture Dispute System (storage and immutable audit log)
-- The following migration completes the transactional RPC layer and repairs
-- environments where an earlier M12 migration was applied without its source.

-- Used by the composite FK so a dispute cannot point at a capture request from
-- a different match.
create unique index if not exists uq_capture_requests_id_match
  on public.capture_requests(id, match_id);

create table if not exists public.capture_disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  capture_request_id uuid not null,
  claimant_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'OPEN',
  reason text not null,
  resolution text null,
  resolution_reason text null,
  resolver_user_id uuid null references auth.users(id) on delete restrict,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_capture_disputes_capture_request_match
    foreign key (capture_request_id, match_id)
    references public.capture_requests(id, match_id) on delete restrict,
  constraint chk_capture_disputes_status check (
    status in ('OPEN', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'EXPIRED')
  ),
  constraint chk_capture_disputes_resolution check (
    resolution is null or resolution in ('VALID', 'INVALID')
  ),
  constraint chk_capture_disputes_reason check (
    char_length(btrim(reason)) between 1 and 1000
  ),
  constraint chk_capture_disputes_resolution_reason check (
    resolution_reason is null or char_length(btrim(resolution_reason)) between 1 and 1000
  ),
  constraint chk_capture_disputes_state_fields check (
    (status = 'OPEN'
      and resolution is null
      and resolution_reason is null
      and resolver_user_id is null
      and resolved_at is null)
    or (status = 'RESOLVED_VALID'
      and resolution = 'VALID'
      and resolution_reason is not null
      and resolver_user_id is not null
      and resolved_at is not null)
    or (status = 'RESOLVED_INVALID'
      and resolution = 'INVALID'
      and resolution_reason is not null
      and resolver_user_id is not null
      and resolved_at is not null)
    or (status = 'EXPIRED'
      and resolution is null
      and resolution_reason is null
      and resolver_user_id is null
      and resolved_at is not null)
  ),
  constraint uq_capture_disputes_capture_request unique (capture_request_id)
);

create index if not exists idx_capture_disputes_match_status_created
  on public.capture_disputes(match_id, status, created_at);
create index if not exists idx_capture_disputes_claimant
  on public.capture_disputes(claimant_user_id, created_at desc);
create index if not exists idx_capture_disputes_resolver
  on public.capture_disputes(resolver_user_id, resolved_at desc)
  where resolver_user_id is not null;

create table if not exists public.capture_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.capture_disputes(id) on delete restrict,
  match_id uuid not null,
  capture_request_id uuid not null,
  event_type text not null,
  status_before text null,
  status_after text not null,
  actor_user_id uuid null,
  reason text null,
  occurred_at timestamptz not null default now(),

  constraint chk_capture_dispute_events_type check (
    event_type in ('SUBMITTED', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'EXPIRED')
  ),
  constraint chk_capture_dispute_events_status_before check (
    status_before is null or status_before in ('OPEN', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'EXPIRED')
  ),
  constraint chk_capture_dispute_events_status_after check (
    status_after in ('OPEN', 'RESOLVED_VALID', 'RESOLVED_INVALID', 'EXPIRED')
  ),
  constraint uq_capture_dispute_events_type unique (dispute_id, event_type)
);

create index if not exists idx_capture_dispute_events_dispute_time
  on public.capture_dispute_events(dispute_id, occurred_at, id);

create or replace function public.guard_capture_dispute_state()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CAPTURE_DISPUTE_HISTORY_IMMUTABLE' using errcode = 'P0001';
  end if;

  if new.id is distinct from old.id
    or new.match_id is distinct from old.match_id
    or new.capture_request_id is distinct from old.capture_request_id
    or new.claimant_user_id is distinct from old.claimant_user_id
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
    or old.status <> 'OPEN'
    or new.status not in ('RESOLVED_VALID', 'RESOLVED_INVALID', 'EXPIRED') then
    raise exception 'INVALID_CAPTURE_DISPUTE_TRANSITION' using errcode = 'P0001';
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.record_capture_dispute_event()
returns trigger as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.capture_dispute_events (
      dispute_id, match_id, capture_request_id, event_type,
      status_before, status_after, actor_user_id, reason, occurred_at
    ) values (
      new.id, new.match_id, new.capture_request_id, 'SUBMITTED',
      null, 'OPEN', new.claimant_user_id, new.reason, new.created_at
    );

    if new.status <> 'OPEN' then
      v_event_type := case new.status
        when 'RESOLVED_VALID' then 'RESOLVED_VALID'
        when 'RESOLVED_INVALID' then 'RESOLVED_INVALID'
        when 'EXPIRED' then 'EXPIRED'
      end;
      insert into public.capture_dispute_events (
        dispute_id, match_id, capture_request_id, event_type,
        status_before, status_after, actor_user_id, reason, occurred_at
      ) values (
        new.id, new.match_id, new.capture_request_id, v_event_type,
        'OPEN', new.status, new.resolver_user_id, new.resolution_reason, new.resolved_at
      );
    end if;
  elsif old.status is distinct from new.status then
    v_event_type := case new.status
      when 'RESOLVED_VALID' then 'RESOLVED_VALID'
      when 'RESOLVED_INVALID' then 'RESOLVED_INVALID'
      when 'EXPIRED' then 'EXPIRED'
    end;
    insert into public.capture_dispute_events (
      dispute_id, match_id, capture_request_id, event_type,
      status_before, status_after, actor_user_id, reason, occurred_at
    ) values (
      new.id, new.match_id, new.capture_request_id, v_event_type,
      old.status, new.status, new.resolver_user_id, new.resolution_reason, new.resolved_at
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

create or replace function public.guard_capture_dispute_event()
returns trigger as $$
begin
  raise exception 'CAPTURE_DISPUTE_AUDIT_IMMUTABLE' using errcode = 'P0001';
end;
$$ language plpgsql security definer set search_path = pg_catalog, public;

alter function public.guard_capture_dispute_state() owner to postgres;
alter function public.record_capture_dispute_event() owner to postgres;
alter function public.guard_capture_dispute_event() owner to postgres;

drop trigger if exists capture_disputes_guard_state on public.capture_disputes;
create trigger capture_disputes_guard_state
  before update or delete on public.capture_disputes
  for each row execute function public.guard_capture_dispute_state();

drop trigger if exists capture_disputes_record_event on public.capture_disputes;
create trigger capture_disputes_record_event
  after insert or update on public.capture_disputes
  for each row execute function public.record_capture_dispute_event();

drop trigger if exists capture_dispute_events_immutable on public.capture_dispute_events;
create trigger capture_dispute_events_immutable
  before update or delete on public.capture_dispute_events
  for each row execute function public.guard_capture_dispute_event();

alter table public.capture_disputes enable row level security;
alter table public.capture_dispute_events enable row level security;
revoke all on table public.capture_disputes from public, anon, authenticated, service_role;
revoke all on table public.capture_dispute_events from public, anon, authenticated, service_role;
