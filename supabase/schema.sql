create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google_health', 'hevy')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.raw_health_datapoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  data_type text not null,
  external_name text,
  payload_json jsonb not null,
  source_platform text,
  recording_method text,
  sample_time timestamptz,
  interval_start timestamptz,
  interval_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  steps integer,
  distance_meters numeric,
  calories_kcal numeric,
  active_minutes integer,
  resting_hr numeric,
  hrv numeric,
  spo2 numeric,
  respiratory_rate numeric,
  skin_temp_delta numeric,
  sleep_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  light_sleep_minutes integer,
  awake_minutes integer,
  vo2max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric,
  body_fat_percentage numeric,
  muscle_mass_kg numeric,
  water_percentage numeric,
  source_platform text,
  source_application text,
  raw_payload_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.blood_pressure_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_at timestamptz not null,
  systolic integer not null check (systolic between 70 and 230),
  diastolic integer not null check (diastolic between 40 and 140),
  pulse integer,
  context text check (context in ('morning', 'night', 'post_workout', 'manual', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.manual_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  energy_score integer check (energy_score between 1 and 5),
  mood_score integer check (mood_score between 1 and 5),
  stress_score integer check (stress_score between 1 and 5),
  caffeine_consumed boolean not null default false,
  last_caffeine_time time,
  caffeine_amount text,
  alcohol_level text check (alcohol_level in ('none', 'low', 'moderate', 'high')),
  keto_adherence text check (keto_adherence in ('yes', 'mild_deviation', 'moderate_deviation', 'strong_deviation')),
  heavy_meal_at_night boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  type text not null,
  location text,
  intensity integer check (intensity between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  recovery_score integer check (recovery_score between 0 and 100),
  sleep_score integer check (sleep_score between 0 and 100),
  training_score integer check (training_score between 0 and 100),
  cardiovascular_score integer check (cardiovascular_score between 0 and 100),
  body_composition_score integer check (body_composition_score between 0 and 100),
  wellbeing_score integer check (wellbeing_score between 0 and 100),
  overall_score integer check (overall_score between 0 and 100),
  calculation_version text not null default 'v0',
  explanation_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  category text not null,
  title text not null,
  explanation text not null,
  recommendation text,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  supporting_data_json jsonb not null default '{}',
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  hypothesis text,
  metric text,
  baseline_start date,
  intervention_start date,
  intervention_end date,
  result_json jsonb not null default '{}',
  confidence text check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.raw_health_datapoints enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.body_measurements enable row level security;
alter table public.blood_pressure_measurements enable row level security;
alter table public.manual_daily_logs enable row level security;
alter table public.symptoms enable row level security;
alter table public.scores enable row level security;
alter table public.insights enable row level security;
alter table public.experiments enable row level security;

create policy "profiles are user-owned" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "oauth tokens are user-owned" on public.oauth_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "raw datapoints are user-owned" on public.raw_health_datapoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily metrics are user-owned" on public.daily_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "body measurements are user-owned" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "blood pressure is user-owned" on public.blood_pressure_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "manual logs are user-owned" on public.manual_daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "symptoms are user-owned" on public.symptoms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scores are user-owned" on public.scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "insights are user-owned" on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "experiments are user-owned" on public.experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
