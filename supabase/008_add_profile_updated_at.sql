-- Migration: Add updated_at column to profiles table
alter table public.profiles
  add column if not exists updated_at timestamptz default now();
