delete from public.raw_health_datapoints a
using public.raw_health_datapoints b
where a.user_id = b.user_id
  and a.external_name = b.external_name
  and a.created_at < b.created_at;

alter table public.body_measurements
  add column if not exists external_name text;

delete from public.body_measurements a
using public.body_measurements b
where a.user_id = b.user_id
  and a.external_name = b.external_name
  and a.created_at < b.created_at;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'raw_health_datapoints_user_external_name_key'
  ) then
    alter table public.raw_health_datapoints
      add constraint raw_health_datapoints_user_external_name_key unique (user_id, external_name);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'body_measurements_user_external_name_key'
  ) then
    alter table public.body_measurements
      add constraint body_measurements_user_external_name_key unique (user_id, external_name);
  end if;
end $$;
