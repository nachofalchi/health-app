select
  'daily_metrics' as table_name,
  count(*) as rows
from public.daily_metrics
union all
select 'raw_health_datapoints', count(*) from public.raw_health_datapoints
union all
select 'body_measurements', count(*) from public.body_measurements
union all
select 'exercises', count(*) from public.exercises
union all
select 'sleep_sessions', count(*) from public.sleep_sessions
union all
select 'sync_runs', count(*) from public.sync_runs
order by table_name;
