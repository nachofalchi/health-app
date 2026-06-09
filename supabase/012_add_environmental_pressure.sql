-- Migration: Add environmental pressure settings and caching tables
create table if not exists public.user_environment_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  atmospheric_pressure_tracking_enabled boolean not null default false,
  atmospheric_pressure_threshold_hpa numeric not null default 1025,
  weather_provider text not null default 'open_meteo',
  alert_sustained_pressure_only boolean not null default true,
  location_name text,
  location_latitude numeric,
  location_longitude numeric,
  location_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.environment_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'open_meteo',
  latitude numeric not null,
  longitude numeric not null,
  timezone text not null,
  forecast_date date not null,
  fetched_at timestamptz not null default now(),
  pressure_msl_min_hpa numeric not null,
  pressure_msl_max_hpa numeric not null,
  pressure_msl_avg_hpa numeric not null,
  surface_pressure_min_hpa numeric not null,
  surface_pressure_max_hpa numeric not null,
  surface_pressure_avg_hpa numeric not null,
  high_pressure_hours integer not null,
  threshold_hpa_used numeric not null,
  crosses_threshold boolean not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, forecast_date)
);

-- Enable RLS
alter table public.user_environment_settings enable row level security;
alter table public.environment_forecasts enable row level security;

-- Policies
drop policy if exists "user_environment_settings are user-owned" on public.user_environment_settings;
create policy "user_environment_settings are user-owned" on public.user_environment_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "environment_forecasts are user-owned" on public.environment_forecasts;
create policy "environment_forecasts are user-owned" on public.environment_forecasts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Comments
comment on table public.user_environment_settings is 'User atmospheric pressure tracking settings and manual location data';
comment on table public.environment_forecasts is 'Cached daily summaries of atmospheric pressure forecasts';

-- Reload schema
select pg_notify('pgrst', 'reload schema');
