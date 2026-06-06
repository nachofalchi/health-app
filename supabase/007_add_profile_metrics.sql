-- Migration: Add user physical metrics to profiles table
alter table public.profiles 
  add column if not exists height_cm numeric,
  add column if not exists target_weight_kg numeric,
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists activity_level text;

comment on column public.profiles.height_cm is 'User height in centimeters';
comment on column public.profiles.target_weight_kg is 'User target weight in kilograms';
comment on column public.profiles.age is 'User age in years';
comment on column public.profiles.gender is 'Biological sex or gender identity';
comment on column public.profiles.activity_level is 'Base physical activity level (sedentary, moderate, active)';
