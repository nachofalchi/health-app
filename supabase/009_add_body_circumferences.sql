-- Migration: Add body circumference columns to body_measurements table
alter table public.body_measurements
  add column if not exists neck_cm numeric,
  add column if not exists shoulders_chest_cm numeric,
  add column if not exists arm_right_relaxed_cm numeric,
  add column if not exists arm_right_contracted_cm numeric,
  add column if not exists arm_left_relaxed_cm numeric,
  add column if not exists arm_left_contracted_cm numeric,
  add column if not exists waist_cm numeric,
  add column if not exists abdomen_cm numeric,
  add column if not exists hips_cm numeric,
  add column if not exists thigh_right_cm numeric,
  add column if not exists thigh_left_cm numeric,
  add column if not exists calf_right_cm numeric,
  add column if not exists calf_left_cm numeric;

comment on column public.body_measurements.neck_cm is 'Neck circumference in centimeters';
comment on column public.body_measurements.shoulders_chest_cm is 'Shoulders/Chest circumference in centimeters';
comment on column public.body_measurements.arm_right_relaxed_cm is 'Right arm relaxed circumference in centimeters';
comment on column public.body_measurements.arm_right_contracted_cm is 'Right arm contracted circumference in centimeters';
comment on column public.body_measurements.arm_left_relaxed_cm is 'Left arm relaxed circumference in centimeters';
comment on column public.body_measurements.arm_left_contracted_cm is 'Left arm contracted circumference in centimeters';
comment on column public.body_measurements.waist_cm is 'Waist circumference in centimeters';
comment on column public.body_measurements.abdomen_cm is 'Abdomen circumference at navel level in centimeters';
comment on column public.body_measurements.hips_cm is 'Hips circumference in centimeters';
comment on column public.body_measurements.thigh_right_cm is 'Right thigh circumference in centimeters';
comment on column public.body_measurements.thigh_left_cm is 'Left thigh circumference in centimeters';
comment on column public.body_measurements.calf_right_cm is 'Right calf circumference in centimeters';
comment on column public.body_measurements.calf_left_cm is 'Left calf circumference in centimeters';

-- Reload PostgREST schema cache
select pg_notify('pgrst', 'reload schema');

