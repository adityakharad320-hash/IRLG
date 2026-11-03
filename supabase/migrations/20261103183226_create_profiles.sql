-- IRLG Platform Migration: Initial Profiles Schema & Security
-- Migration ID: 20261103183226_create_profiles.sql

-- 1. Create profiles table linked to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_name_length check (
    char_length(trim(display_name)) >= 2 and
    char_length(display_name) <= 50
  )
);

-- 2. Performance indexes
create index if not exists idx_profiles_display_name on public.profiles(display_name);
create index if not exists idx_profiles_created_at on public.profiles(created_at desc);

-- 3. Automatic updated_at timestamp trigger with immutable field protection
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.id = old.id;
  new.created_at = old.created_at;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_profiles_updated_at on public.profiles;
create trigger on_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 4. Automatic profile generation on auth.users registration
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_display_name text;
begin
  default_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Player'
  );

  if char_length(default_display_name) < 2 then
    default_display_name := default_display_name || '_player';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    default_display_name,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 6. RLS Policies (fail-closed by default)
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);
