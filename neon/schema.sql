-- Northstar Financial data tables on Neon Postgres.
-- Login stays on Supabase Auth. Rows are scoped by auth user id in the app.

create extension if not exists pgcrypto;

create table if not exists public.hr_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  month text not null,
  department text not null,
  headcount double precision not null default 0,
  target_headcount double precision not null default 0,
  new_hires double precision not null default 0,
  attrition_count double precision not null default 0,
  time_to_hire_days double precision,
  referral_pct double precision not null default 0,
  job_board_pct double precision not null default 0,
  agency_pct double precision not null default 0,
  unique (user_id, month, department)
);

create index if not exists hr_records_user_month_idx
  on public.hr_records (user_id, month);

create table if not exists public.user_datasets (
  user_id text primary key,
  filename text not null,
  kind text not null,
  type_from_name text not null,
  type_from_headers text not null,
  name_header_match boolean not null default true,
  reason text,
  time_field text,
  category_field text,
  metric_fields jsonb not null default '[]'::jsonb,
  headers jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
