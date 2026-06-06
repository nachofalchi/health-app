-- Migration: Add advanced score columns to scores table
alter table public.scores
  add column if not exists health_index integer check (health_index between 0 and 100),
  add column if not exists daily_readiness integer check (daily_readiness between 0 and 100),
  add column if not exists body_progress integer check (body_progress between 0 and 100);

comment on column public.scores.health_index is 'Trend/long-term health index score (0-100)';
comment on column public.scores.daily_readiness is 'Daily preparation and recovery readiness score (0-100)';
comment on column public.scores.body_progress is 'Body composition and measurement progress score (0-100)';

-- Reload PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
