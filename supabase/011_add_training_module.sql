-- Migration: Add Training Module Schema and Seed Data

-- 1. Create Catalog Tables
create table if not exists public.muscle_groups (
  id text primary key,
  name text not null,
  category text not null check (category in ('push', 'pull', 'legs', 'core', 'other'))
);

create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  instructions text,
  type text not null check (type in ('strength', 'mobility', 'core', 'cardio', 'other')),
  equipment text not null check (equipment in ('bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'other')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced', 'scalable')),
  is_warmup boolean not null default false,
  counts_for_volume boolean not null default true,
  regressions_json jsonb not null default '[]',
  progressions_json jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_catalog_muscle_map (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  muscle_group_id text not null references public.muscle_groups(id) on delete cascade,
  role text not null check (role in ('primary', 'secondary', 'stabilizer', 'mobility')),
  contribution_percent numeric not null check (contribution_percent between 0 and 100),
  unique (exercise_id, muscle_group_id)
);

-- 2. Create User Tables
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade, -- null = global default template
  name text not null,
  description text,
  difficulty text not null default 'intermediate',
  created_at timestamptz not null default now()
);

create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  order_index integer not null,
  section text not null check (section in ('warmup', 'main', 'cooldown')),
  default_sets integer not null default 3,
  default_reps integer,
  default_duration_seconds integer,
  default_rest_seconds integer default 90,
  tempo text,
  notes text
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null,
  date date not null default current_date,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  duration_minutes integer,
  source text not null check (source in ('manual', 'template', 'google_health', 'hevy', 'imported')),
  session_rpe integer check (session_rpe between 1 and 10),
  energy_before integer check (energy_before between 1 and 5),
  energy_after integer check (energy_after between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  order_index integer not null,
  section text not null check (section in ('warmup', 'main', 'cooldown')),
  notes text
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number integer not null,
  reps integer,
  weight_kg numeric default 0,
  duration_seconds integer,
  rir integer check (rir between 0 and 10),
  rpe integer check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  completed boolean not null default true,
  side text check (side in ('left', 'right', 'both')),
  notes text
);

create table if not exists public.muscle_volume_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  muscle_group_id text not null references public.muscle_groups(id) on delete cascade,
  hard_sets numeric not null default 0,
  estimated_volume numeric,
  source text not null default 'manual',
  unique (user_id, date, muscle_group_id)
);

-- 3. Enable Row Level Security (RLS)
alter table public.muscle_groups enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.exercise_catalog_muscle_map enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.muscle_volume_daily enable row level security;

-- 4. Create Security Policies (RLS)
create policy "muscle groups read policy" on public.muscle_groups for select using (true);
create policy "exercise_catalog read policy" on public.exercise_catalog for select using (true);
create policy "exercise_catalog_muscle_map read policy" on public.exercise_catalog_muscle_map for select using (true);

create policy "templates select policy" on public.workout_templates
  for select using (user_id is null or auth.uid() = user_id);
create policy "templates modify policy" on public.workout_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "template exercises select policy" on public.workout_template_exercises
  for select using (exists (select 1 from public.workout_templates t where t.id = template_id and (t.user_id is null or t.user_id = auth.uid())));
create policy "template exercises write policy" on public.workout_template_exercises
  for all using (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = auth.uid()));

create policy "workout sessions are user-owned" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session exercises select policy" on public.workout_session_exercises
  for select using (exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = auth.uid()));
create policy "session exercises write policy" on public.workout_session_exercises
  for all using (exists (select 1 from public.workout_sessions s where s.id = workout_session_id and s.user_id = auth.uid()));

create policy "sets select policy" on public.workout_sets
  for select using (exists (select 1 from public.workout_session_exercises se join public.workout_sessions s on s.id = se.workout_session_id where se.id = workout_session_exercise_id and s.user_id = auth.uid()));
create policy "sets write policy" on public.workout_sets
  for all using (exists (select 1 from public.workout_session_exercises se join public.workout_sessions s on s.id = se.workout_session_id where se.id = workout_session_exercise_id and s.user_id = auth.uid()));

create policy "muscle volume daily is user-owned" on public.muscle_volume_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Seed Catalog Data: Muscle Groups
insert into public.muscle_groups (id, name, category) values
  ('chest', 'Pecho', 'push'),
  ('triceps', 'Tríceps', 'push'),
  ('anterior_deltoid', 'Deltoide Anterior', 'push'),
  ('shoulders', 'Hombros', 'push'),
  ('quads', 'Cuádriceps', 'legs'),
  ('glutes', 'Glúteos', 'legs'),
  ('hamstrings', 'Isquiosurales', 'legs'),
  ('adductors', 'Aductores', 'legs'),
  ('calves', 'Pantorrillas', 'legs'),
  ('core', 'Core', 'core'),
  ('lower_back', 'Espalda baja', 'core'),
  ('back', 'Espalda', 'pull'),
  ('biceps', 'Bíceps', 'pull'),
  ('wrists', 'Muñecas', 'other'),
  ('hip_rotators', 'Rotadores de cadera', 'other')
on conflict (id) do nothing;

-- 6. Seed Catalog Data: exercise_catalog
-- Seeding exercises with fixed UUIDs for mapping consistency
insert into public.exercise_catalog (id, name, description, instructions, type, equipment, difficulty, is_warmup, counts_for_volume, regressions_json, progressions_json) values
  (
    '3f0b2f15-0d04-4b47-a89e-26f634b07fb8',
    'Cat-cow',
    'Movilización de la columna en cuatro apoyos.',
    'Apoya manos y rodillas en el piso. Al inhalar, arquea la espalda hacia abajo y mira al cielo (vaca). Al exhalar, redondea la espalda hacia arriba metiendo la cabeza (gato).',
    'mobility',
    'bodyweight',
    'beginner',
    true,
    false,
    '[]',
    '[]'
  ),
  (
    'cd9f1a0e-9276-47b2-bd74-dfd403e070e1',
    'Círculos de cadera en cuadrupedia',
    'Preparación de movilidad articular para la articulación de la cadera.',
    'En posición de cuadrupedia, levanta una rodilla y dibuja círculos amplios controlados en el aire. Realiza las repeticiones a un lado y luego al otro.',
    'mobility',
    'bodyweight',
    'beginner',
    true,
    false,
    '[]',
    '[]'
  ),
  (
    '92ef94df-73bb-4033-91b4-245f9fb571d8',
    'Sentadilla profunda con pausa',
    'Patrón de sentadilla enfocado en estiramiento de cadera y tobillos.',
    'Baja a una sentadilla profunda y mantén la posición abajo durante 2 segundos con el pecho erguido antes de subir.',
    'mobility',
    'bodyweight',
    'beginner',
    true,
    false,
    '[]',
    '[]'
  ),
  (
    'a2bb4d33-4f9e-4c74-884c-cf80efd123d4',
    'Círculos de brazos + muñecas',
    'Calentamiento de movilidad para articulaciones de tren superior.',
    'Dibuja 10 círculos hacia adelante y 10 hacia atrás con los brazos extendidos. Luego, arrodillado, apoya las muñecas en el piso con los dedos hacia ti y estira suavemente hacia atrás.',
    'mobility',
    'bodyweight',
    'beginner',
    true,
    false,
    '[]',
    '[]'
  ),
  (
    '08f88ff8-e152-4752-bfb2-9366110f845a',
    'Sentadilla al aire',
    'Sentadilla con el peso del propio cuerpo, enfocada en cuádriceps y glúteos.',
    'De pie con los pies al ancho de los hombros, desciende lentamente (tempo excéntrico de 3 segundos) empujando la cadera hacia atrás. Mantén la espalda recta y sube con fuerza.',
    'strength',
    'bodyweight',
    'beginner',
    false,
    true,
    '["Sentadilla parcial", "Sentadilla asistida"]',
    '["Sentadilla lenta", "Sentadilla con pausa", "Sentadilla búlgara", "Sentadilla con mochila"]'
  ),
  (
    'f4c718a2-23c2-4841-9de3-cde11ffb0762',
    'Flexiones',
    'Ejercicio clásico de empuje para pecho, hombros y tríceps.',
    'Coloca las manos un poco más anchas que los hombros. Baja controlando el cuerpo en una sola línea hasta tocar el pecho en el piso y empuja de regreso. Regula dificultad apoyando rodillas o elevando pies.',
    'strength',
    'bodyweight',
    'scalable',
    false,
    true,
    '["Flexión con rodillas apoyadas", "Flexión inclinada con manos elevadas"]',
    '["Flexión normal", "Flexión con pies elevados", "Flexión lenta", "Flexión con pausa abajo", "Flexión diamante"]'
  ),
  (
    '86a7d2e0-2f92-4217-a066-6b2f768de251',
    'Hip thrust en piso',
    'Extensión de cadera enfocada en activar y fortalecer glúteos.',
    'Acuéstate boca arriba con las rodillas dobladas y los pies firmes cerca de los glúteos. Contrae glúteos y abdomen para elevar la pelvis hacia el techo, realizando una pausa de 2 segundos arriba.',
    'strength',
    'bodyweight',
    'beginner',
    false,
    true,
    '["Puente de glúteos"]',
    '["Hip thrust con pausa", "Hip thrust unilateral", "Hip thrust con mochila", "Hip thrust con banda"]'
  ),
  (
    'eb10cf1c-34d2-430b-9ee0-1123f81e3a6c',
    'Plancha',
    'Estabilidad estática de core profundo y cadena anterior.',
    'Apóyate sobre tus antebrazos y las puntas de tus pies. Mantén el cuerpo totalmente recto alineando hombros, cadera y talones, apretando glúteos e internalizando el abdomen.',
    'core',
    'bodyweight',
    'beginner',
    false,
    true,
    '["Plancha con rodillas", "Plancha corta"]',
    '["Plancha 45s", "Plancha 60s", "Plancha con toque de hombros", "Plancha RKC"]'
  )
on conflict (id) do nothing;

-- 7. Seed Catalog Data: exercise_catalog_muscle_map
insert into public.exercise_catalog_muscle_map (exercise_id, muscle_group_id, role, contribution_percent) values
  -- Cat-cow (Warmup / Mobility)
  ('3f0b2f15-0d04-4b47-a89e-26f634b07fb8', 'lower_back', 'mobility', 40),
  ('3f0b2f15-0d04-4b47-a89e-26f634b07fb8', 'core', 'mobility', 30),
  
  -- Círculos de cadera
  ('cd9f1a0e-9276-47b2-bd74-dfd403e070e1', 'hip_rotators', 'mobility', 60),
  ('cd9f1a0e-9276-47b2-bd74-dfd403e070e1', 'glutes', 'stabilizer', 40),

  -- Sentadilla profunda pausa
  ('92ef94df-73bb-4033-91b4-245f9fb571d8', 'quads', 'mobility', 40),
  ('92ef94df-73bb-4033-91b4-245f9fb571d8', 'glutes', 'mobility', 30),
  ('92ef94df-73bb-4033-91b4-245f9fb571d8', 'adductors', 'mobility', 30),

  -- Círculos de brazos
  ('a2bb4d33-4f9e-4c74-884c-cf80efd123d4', 'shoulders', 'mobility', 60),
  ('a2bb4d33-4f9e-4c74-884c-cf80efd123d4', 'wrists', 'mobility', 40),

  -- Sentadilla al aire
  ('08f88ff8-e152-4752-bfb2-9366110f845a', 'quads', 'primary', 45),
  ('08f88ff8-e152-4752-bfb2-9366110f845a', 'glutes', 'primary', 30),
  ('08f88ff8-e152-4752-bfb2-9366110f845a', 'adductors', 'secondary', 10),
  ('08f88ff8-e152-4752-bfb2-9366110f845a', 'hamstrings', 'secondary', 5),
  ('08f88ff8-e152-4752-bfb2-9366110f845a', 'core', 'stabilizer', 10),

  -- Flexiones
  ('f4c718a2-23c2-4841-9de3-cde11ffb0762', 'chest', 'primary', 45),
  ('f4c718a2-23c2-4841-9de3-cde11ffb0762', 'triceps', 'primary', 25),
  ('f4c718a2-23c2-4841-9de3-cde11ffb0762', 'anterior_deltoid', 'secondary', 20),
  ('f4c718a2-23c2-4841-9de3-cde11ffb0762', 'core', 'stabilizer', 10),

  -- Hip thrust en piso
  ('86a7d2e0-2f92-4217-a066-6b2f768de251', 'glutes', 'primary', 60),
  ('86a7d2e0-2f92-4217-a066-6b2f768de251', 'hamstrings', 'secondary', 20),
  ('86a7d2e0-2f92-4217-a066-6b2f768de251', 'core', 'stabilizer', 10),
  ('86a7d2e0-2f92-4217-a066-6b2f768de251', 'adductors', 'stabilizer', 5),
  ('86a7d2e0-2f92-4217-a066-6b2f768de251', 'lower_back', 'stabilizer', 5),

  -- Plancha
  ('eb10cf1c-34d2-430b-9ee0-1123f81e3a6c', 'core', 'primary', 70),
  ('eb10cf1c-34d2-430b-9ee0-1123f81e3a6c', 'glutes', 'secondary', 10),
  ('eb10cf1c-34d2-430b-9ee0-1123f81e3a6c', 'shoulders', 'secondary', 10),
  ('eb10cf1c-34d2-430b-9ee0-1123f81e3a6c', 'lower_back', 'stabilizer', 10)
on conflict (exercise_id, muscle_group_id) do nothing;

-- 8. Seed Default Template: "Rutina de casa"
insert into public.workout_templates (id, user_id, name, description, difficulty) values
  (
    'c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5',
    null,
    'Rutina de casa',
    'Rutina completa enfocada en empuje de tren superior (flexiones), fuerza de piernas (sentadillas y hip thrust) y estabilización central (plancha).',
    'beginner'
  )
on conflict (id) do nothing;

-- 9. Seed Template Exercises for "Rutina de casa"
insert into public.workout_template_exercises (template_id, exercise_id, order_index, section, default_sets, default_reps, default_duration_seconds, default_rest_seconds, tempo, notes) values
  -- Calentamiento
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', '3f0b2f15-0d04-4b47-a89e-26f634b07fb8', 1, 'warmup', 1, 10, null, 30, 'Lento', 'Moviliza columna y abre lumbar. Importante para vos.'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', 'cd9f1a0e-9276-47b2-bd74-dfd403e070e1', 2, 'warmup', 1, 8, null, 30, 'Controlado', 'Rodilla dibuja círculos grandes. Prepara para sentadilla e hip thrust (8 por lado).'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', '92ef94df-73bb-4033-91b4-245f9fb571d8', 3, 'warmup', 1, 8, null, 30, 'Pausa 2s', 'Quédate 2 segundos abajo. Sentí el estiramiento de cadera y tobillo.'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', 'a2bb4d33-4f9e-4c74-884c-cf80efd123d4', 4, 'warmup', 1, 20, null, 30, 'Dinámico', '10 atrás, 10 adelante. Después flexión de muñeca apoyada en piso (hold 10s).'),
  
  -- Bloque principal
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', '08f88ff8-e152-4752-bfb2-9366110f845a', 1, 'main', 3, 15, null, 90, 'Excéntrica 3s', 'Lenta: 3 segundos bajando. Bajá hasta donde puedas sin perder postura.'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', 'f4c718a2-23c2-4841-9de3-cde11ffb0762', 2, 'main', 3, null, null, 90, 'AMRAP', 'Si no llegás a 10: apoyá rodillas. Si sobran: pies en silla.'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', '86a7d2e0-2f92-4217-a066-6b2f768de251', 3, 'main', 3, 15, null, 90, 'Pausa 2s arriba', 'Hombros en piso, pies cerca del culo. Pausa 2 segundos arriba.'),
  ('c5a5b5a5-d5a5-45d5-95a5-f5a5b5a5c5a5', 'eb10cf1c-34d2-430b-9ee0-1123f81e3a6c', 4, 'main', 3, null, 30, 60, 'Estático', 'Codos abajo, cuerpo recto, glúteos apretados.')
on conflict do nothing;

-- 10. Reload PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
