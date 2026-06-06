alter table public.body_measurements
  add column if not exists measurement_group_key text,
  add column if not exists source_external_names text[] not null default '{}';

update public.body_measurements
set
  measurement_group_key = coalesce(
    measurement_group_key,
    concat_ws(
      '|',
      date_trunc('minute', measured_at)::text,
      coalesce(source_platform, ''),
      coalesce(source_application, '')
    )
  ),
  source_external_names = case
    when external_name is null then source_external_names
    when external_name = any(source_external_names) then source_external_names
    else array_append(source_external_names, external_name)
  end
where measurement_group_key is null
  or (external_name is not null and not external_name = any(source_external_names));

create temp table body_measurements_fused as
select
  gen_random_uuid() as id,
  user_id,
  min(measured_at) as measured_at,
  max(weight_kg) filter (where weight_kg is not null) as weight_kg,
  max(body_fat_percentage) filter (where body_fat_percentage is not null) as body_fat_percentage,
  max(muscle_mass_kg) filter (where muscle_mass_kg is not null) as muscle_mass_kg,
  max(water_percentage) filter (where water_percentage is not null) as water_percentage,
  max(source_platform) filter (where source_platform is not null) as source_platform,
  max(source_application) filter (where source_application is not null) as source_application,
  jsonb_agg(raw_payload_json) filter (where raw_payload_json is not null) as raw_payload_json,
  min(created_at) as created_at,
  null::text as external_name,
  measurement_group_key,
  array_agg(distinct external_name) filter (where external_name is not null) as source_external_names
from public.body_measurements
where measurement_group_key is not null
group by user_id, measurement_group_key;

delete from public.body_measurements
where measurement_group_key is not null;

insert into public.body_measurements (
  id,
  user_id,
  measured_at,
  weight_kg,
  body_fat_percentage,
  muscle_mass_kg,
  water_percentage,
  source_platform,
  source_application,
  raw_payload_json,
  created_at,
  external_name,
  measurement_group_key,
  source_external_names
)
select
  id,
  user_id,
  measured_at,
  weight_kg,
  body_fat_percentage,
  muscle_mass_kg,
  water_percentage,
  source_platform,
  source_application,
  raw_payload_json,
  created_at,
  external_name,
  measurement_group_key,
  coalesce(source_external_names, '{}')
from body_measurements_fused;

drop table body_measurements_fused;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'body_measurements_user_measurement_group_key_key'
  ) then
    alter table public.body_measurements
      add constraint body_measurements_user_measurement_group_key_key unique (user_id, measurement_group_key);
  end if;
end $$;
