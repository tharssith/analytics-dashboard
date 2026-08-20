-- Northstar Financial demo schema.
-- Auth lives in Supabase Auth (auth.users). No public sign-up in the app.

create table if not exists public.hr_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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

alter table public.hr_records enable row level security;

drop policy if exists "hr_records_select_own" on public.hr_records;
create policy "hr_records_select_own"
  on public.hr_records for select
  using (auth.uid() = user_id);

drop policy if exists "hr_records_insert_own" on public.hr_records;
create policy "hr_records_insert_own"
  on public.hr_records for insert
  with check (auth.uid() = user_id);

drop policy if exists "hr_records_update_own" on public.hr_records;
create policy "hr_records_update_own"
  on public.hr_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hr_records_delete_own" on public.hr_records;
create policy "hr_records_delete_own"
  on public.hr_records for delete
  using (auth.uid() = user_id);

create or replace function public.replace_hr_records(rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from public.hr_records where user_id = auth.uid();

  insert into public.hr_records (
    user_id,
    month,
    department,
    headcount,
    target_headcount,
    new_hires,
    attrition_count,
    time_to_hire_days,
    referral_pct,
    job_board_pct,
    agency_pct
  )
  select
    auth.uid(),
    r->>'month',
    r->>'department',
    coalesce((r->>'headcount')::double precision, 0),
    coalesce((r->>'target_headcount')::double precision, 0),
    coalesce((r->>'new_hires')::double precision, 0),
    coalesce((r->>'attrition_count')::double precision, 0),
    nullif(r->>'time_to_hire_days', '')::double precision,
    coalesce((r->>'referral_pct')::double precision, 0),
    coalesce((r->>'job_board_pct')::double precision, 0),
    coalesce((r->>'agency_pct')::double precision, 0)
  from jsonb_array_elements(rows) as r;
end;
$$;

grant select, insert, update, delete on public.hr_records to authenticated;
grant execute on function public.replace_hr_records(jsonb) to authenticated;
