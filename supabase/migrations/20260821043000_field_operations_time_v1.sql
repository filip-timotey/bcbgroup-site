-- BCB Field Operations / Time Tracking v1
-- Additive evolution of the existing employee_time_entries table.

alter table public.employee_time_entries
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists clock_in_lat numeric,
  add column if not exists clock_in_lng numeric,
  add column if not exists clock_in_accuracy numeric,
  add column if not exists clock_out_lat numeric,
  add column if not exists clock_out_lng numeric,
  add column if not exists clock_out_accuracy numeric;

alter table public.employee_time_entries
  drop constraint if exists employee_time_entries_approval_status_check;
alter table public.employee_time_entries
  add constraint employee_time_entries_approval_status_check
  check (approval_status in ('draft','approved','rejected'));

alter table public.employee_time_entries
  drop constraint if exists employee_time_entries_time_order_check;
alter table public.employee_time_entries
  add constraint employee_time_entries_time_order_check
  check (ended_at is null or started_at is null or (ended_at >= started_at and ended_at <= started_at + interval '18 hours'));

create index if not exists employee_time_entries_project_date_idx
  on public.employee_time_entries(project_id, work_date desc);
create index if not exists employee_time_entries_employee_date_idx
  on public.employee_time_entries(employee_id, work_date desc);
create index if not exists employee_time_entries_approval_idx
  on public.employee_time_entries(approval_status, work_date desc);
create index if not exists employee_time_entries_created_by_idx
  on public.employee_time_entries(created_by, work_date desc);
create index if not exists employee_time_entries_approved_by_idx
  on public.employee_time_entries(approved_by);
create unique index if not exists employee_time_entries_one_open_per_employee_idx
  on public.employee_time_entries(employee_id)
  where started_at is not null and ended_at is null;

-- Internal cost rates are deliberately separate from payroll/compensation.
create table if not exists public.project_labor_rates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  hourly_cost numeric not null default 0 check (hourly_cost >= 0),
  currency text not null default 'RON' check (currency in ('RON','EUR')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, employee_id)
);
create index if not exists project_labor_rates_project_idx on public.project_labor_rates(project_id);
create index if not exists project_labor_rates_employee_idx on public.project_labor_rates(employee_id);
create index if not exists project_labor_rates_created_by_idx on public.project_labor_rates(created_by);
create index if not exists project_labor_rates_updated_by_idx on public.project_labor_rates(updated_by);

alter table public.project_financials
  add column if not exists include_tracked_labor boolean not null default false;

alter table public.project_labor_rates enable row level security;

drop policy if exists "finance admins manage project labor rates" on public.project_labor_rates;
create policy "finance admins manage project labor rates"
on public.project_labor_rates for all to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner())
with check (public.is_bcb_admin() or public.is_bcb_owner());

-- Replace duplicated historical policies with role-specific policies.
drop policy if exists "admins manage employee_time_entries" on public.employee_time_entries;
drop policy if exists "admins select employee_time_entries" on public.employee_time_entries;
drop policy if exists "time entries admin manage" on public.employee_time_entries;
drop policy if exists "time entries own read" on public.employee_time_entries;
drop policy if exists "time entries own insert" on public.employee_time_entries;
drop policy if exists "time entries own update draft" on public.employee_time_entries;

create policy "time entries admin manage"
on public.employee_time_entries for all to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner())
with check (public.is_bcb_admin() or public.is_bcb_owner());

create policy "time entries own read"
on public.employee_time_entries for select to authenticated
using (created_by = (select auth.uid()));

create policy "time entries own insert"
on public.employee_time_entries for insert to authenticated
with check (
  created_by = (select auth.uid())
  and approval_status = 'draft'
  and approved_by is null
  and approved_at is null
);

create policy "time entries own update draft"
on public.employee_time_entries for update to authenticated
using (created_by = (select auth.uid()) and approval_status = 'draft')
with check (
  created_by = (select auth.uid())
  and approval_status = 'draft'
  and approved_by is null
  and approved_at is null
);

-- Server-side identity and immutable start data for self clocking.
create or replace function private.enforce_time_entry_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_employee uuid;
  v_privileged boolean := false;
begin
  if v_uid is null then
    raise exception 'Autentificare necesara.';
  end if;

  select exists(
    select 1 from public.profiles p
    where p.id = v_uid and p.is_active = true and (p.is_owner = true or p.role = 'admin')
  ) into v_privileged;

  if v_privileged then
    new.updated_by := v_uid;
    if tg_op = 'INSERT' then
      new.created_by := coalesce(new.created_by, v_uid);
      new.source := coalesce(nullif(new.source,''), 'admin_manual');
    end if;
    if new.approval_status = 'approved' and (tg_op = 'INSERT' or old.approval_status is distinct from new.approval_status) then
      new.approved_by := v_uid;
      new.approved_at := now();
    elsif new.approval_status <> 'approved' then
      new.approved_by := null;
      new.approved_at := null;
    end if;
    new.updated_at := now();
    return new;
  end if;

  select e.id into v_employee
  from public.employees e
  where e.profile_id = v_uid and e.employment_status = 'active'
  limit 1;

  if v_employee is null then
    raise exception 'Profilul nu este asociat unui angajat activ.';
  end if;

  new.employee_id := v_employee;
  new.created_by := v_uid;
  new.updated_by := v_uid;
  new.approval_status := 'draft';
  new.approved_by := null;
  new.approved_at := null;
  new.source := 'self_clock';
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.started_at := coalesce(new.started_at, now());
    new.work_date := (new.started_at at time zone 'Europe/Bucharest')::date;
    new.entry_type := coalesce(nullif(new.entry_type,''), 'work');
  else
    -- Users may stop their own shift and add break/notes/GPS, but cannot rewrite its identity/start/project.
    new.employee_id := old.employee_id;
    new.project_id := old.project_id;
    new.started_at := old.started_at;
    new.work_date := old.work_date;
    new.entry_type := old.entry_type;
    new.created_by := old.created_by;
    new.source := old.source;
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_time_entry_identity() from public, anon, authenticated;

-- Trigger functions do not need API EXECUTE privileges.
drop trigger if exists bcb_time_entry_identity on public.employee_time_entries;
create trigger bcb_time_entry_identity
before insert or update on public.employee_time_entries
for each row execute function private.enforce_time_entry_identity();

-- Guard unreasonable breaks.
alter table public.employee_time_entries
  drop constraint if exists employee_time_entries_break_minutes_check;
alter table public.employee_time_entries
  add constraint employee_time_entries_break_minutes_check
  check (break_minutes between 0 and 600);
