create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_name text,
  start_time timestamptz not null,
  end_time timestamptz,
  display_name text,
  exercise_type text,
  active_duration_seconds integer,
  steps integer,
  distance_meters numeric,
  calories_kcal numeric,
  average_heart_rate numeric,
  source_platform text,
  recording_method text,
  raw_payload_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  external_name text,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  light_sleep_minutes integer,
  awake_minutes integer,
  source_platform text,
  recording_method text,
  raw_payload_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_health',
  status text not null check (status in ('success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  date_start date,
  date_end date,
  daily_metrics_upserted integer not null default 0,
  raw_datapoints_upserted integer not null default 0,
  exercises_upserted integer not null default 0,
  sleep_sessions_upserted integer not null default 0,
  body_measurements_upserted integer not null default 0,
  scores_upserted integer not null default 0,
  insights_upserted integer not null default 0,
  empty_responses integer not null default 0,
  results_json jsonb not null default '{}',
  errors_json jsonb not null default '[]'
);

alter table public.exercises enable row level security;
alter table public.sleep_sessions enable row level security;
alter table public.sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'exercises' and policyname = 'exercises are user-owned'
  ) then
    create policy "exercises are user-owned" on public.exercises
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sleep_sessions' and policyname = 'sleep sessions are user-owned'
  ) then
    create policy "sleep sessions are user-owned" on public.sleep_sessions
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sync_runs' and policyname = 'sync runs are user-owned'
  ) then
    create policy "sync runs are user-owned" on public.sync_runs
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_user_external_name_key'
  ) then
    alter table public.exercises
      add constraint exercises_user_external_name_key unique (user_id, external_name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sleep_sessions_user_external_name_key'
  ) then
    alter table public.sleep_sessions
      add constraint sleep_sessions_user_external_name_key unique (user_id, external_name);
  end if;
end $$;

create index if not exists exercises_user_start_time_idx on public.exercises (user_id, start_time desc);
create index if not exists sleep_sessions_user_start_time_idx on public.sleep_sessions (user_id, start_time desc);
create index if not exists sync_runs_user_started_at_idx on public.sync_runs (user_id, started_at desc);
