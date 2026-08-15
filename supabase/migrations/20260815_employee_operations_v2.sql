-- =========================================================
-- BCB GROUP — EMPLOYEE OPERATIONS V2
-- Leave, attendance, certifications, equipment, alerts
-- =========================================================

create table if not exists public.employee_leave (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null default 'annual' check (leave_type in ('annual','medical','unpaid','special','parental','other')),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'approved' check (status in ('pending','approved','rejected','cancelled')),
  reason text,
  document_path text,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists employee_leave_employee_idx on public.employee_leave(employee_id, starts_on desc);
create index if not exists employee_leave_period_idx on public.employee_leave(starts_on, ends_on, status);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0 and break_minutes <= 1440),
  entry_type text not null default 'work' check (entry_type in ('work','overtime','remote','site','training','other')),
  work_location text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);
create index if not exists employee_time_entries_employee_idx on public.employee_time_entries(employee_id, work_date desc);
create unique index if not exists employee_time_entries_unique_day_type on public.employee_time_entries(employee_id, work_date, entry_type, coalesce(started_at,'1970-01-01'::timestamptz));

create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  certification_type text not null default 'training',
  title text not null,
  issuer text,
  certificate_number text,
  issued_on date,
  expires_on date,
  status text not null default 'valid' check (status in ('valid','expiring','expired','suspended','revoked')),
  file_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_certifications_employee_idx on public.employee_certifications(employee_id, expires_on);
create index if not exists employee_certifications_expiry_idx on public.employee_certifications(expires_on, status);

create table if not exists public.employee_equipment (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  category text not null default 'other',
  item_name text not null,
  asset_code text,
  serial_number text,
  assigned_on date not null default current_date,
  expected_return_on date,
  returned_on date,
  condition_on_assign text,
  condition_on_return text,
  status text not null default 'assigned' check (status in ('assigned','returned','lost','damaged','service')),
  value numeric(12,2) check (value is null or value >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_equipment_employee_idx on public.employee_equipment(employee_id, status);
create index if not exists employee_equipment_asset_idx on public.employee_equipment(asset_code);

create table if not exists public.hr_alert_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default true,
  days_before integer not null default 30 check (days_before between 1 and 365),
  report_email text,
  include_contracts boolean not null default true,
  include_documents boolean not null default true,
  include_certifications boolean not null default true,
  include_equipment_returns boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.hr_alert_settings(id, report_email)
values(true,'office@bcbgroup.ro') on conflict(id) do nothing;

create table if not exists public.hr_alert_log (
  id bigint generated by default as identity primary key,
  alert_key text not null,
  alert_type text not null,
  employee_id uuid references public.employees(id) on delete cascade,
  entity_id text,
  due_date date,
  sent_to text,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists hr_alert_log_key_idx on public.hr_alert_log(alert_key, sent_at desc);

create or replace function public.hr_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.updated_at=now();
  if tg_table_name in ('employee_time_entries','employee_equipment') then new.updated_by=auth.uid(); end if;
  return new;
end; $$;

drop trigger if exists employee_leave_touch on public.employee_leave;
create trigger employee_leave_touch before update on public.employee_leave for each row execute function public.hr_touch_updated_at();
drop trigger if exists employee_time_entries_touch on public.employee_time_entries;
create trigger employee_time_entries_touch before update on public.employee_time_entries for each row execute function public.hr_touch_updated_at();
drop trigger if exists employee_certifications_touch on public.employee_certifications;
create trigger employee_certifications_touch before update on public.employee_certifications for each row execute function public.hr_touch_updated_at();
drop trigger if exists employee_equipment_touch on public.employee_equipment;
create trigger employee_equipment_touch before update on public.employee_equipment for each row execute function public.hr_touch_updated_at();

alter table public.employee_leave enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.employee_certifications enable row level security;
alter table public.employee_equipment enable row level security;
alter table public.hr_alert_settings enable row level security;
alter table public.hr_alert_log enable row level security;

-- Operational HR remains Admin + Owner only.
do $$
declare t text;
begin
  foreach t in array array['employee_leave','employee_time_entries','employee_certifications','employee_equipment'] loop
    execute format('drop policy if exists "admins select %s" on public.%I',t,t);
    execute format('create policy "admins select %s" on public.%I for select to authenticated using (public.is_bcb_admin() or public.is_bcb_owner())',t,t);
    execute format('drop policy if exists "admins manage %s" on public.%I',t,t);
    execute format('create policy "admins manage %s" on public.%I for all to authenticated using (public.is_bcb_admin() or public.is_bcb_owner()) with check (public.is_bcb_admin() or public.is_bcb_owner())',t,t);
  end loop;
end $$;

drop policy if exists "admins read hr alert settings" on public.hr_alert_settings;
create policy "admins read hr alert settings" on public.hr_alert_settings for select to authenticated using (public.is_bcb_admin() or public.is_bcb_owner());
drop policy if exists "owner manages hr alert settings" on public.hr_alert_settings;
create policy "owner manages hr alert settings" on public.hr_alert_settings for all to authenticated using (public.is_bcb_owner()) with check (public.is_bcb_owner());

drop policy if exists "admins read hr alert log" on public.hr_alert_log;
create policy "admins read hr alert log" on public.hr_alert_log for select to authenticated using (public.is_bcb_admin() or public.is_bcb_owner());

-- A compact alert feed for the HR dashboard.
create or replace function public.get_hr_alerts(p_days integer default 30)
returns table(alert_type text, employee_id uuid, employee_name text, item_id text, title text, due_date date, days_left integer)
language sql stable security definer set search_path=public as $$
  select * from (
    select 'contract'::text,e.id,e.full_name,e.id::text,'Contract angajat'::text,e.contract_end,(e.contract_end-current_date)::int
    from employees e where e.contract_end between current_date and current_date + greatest(1,p_days)
    union all
    select 'document',e.id,e.full_name,d.id::text,d.title,d.expires_at,(d.expires_at-current_date)::int
    from employee_documents d join employees e on e.id=d.employee_id where d.expires_at between current_date and current_date + greatest(1,p_days)
    union all
    select 'certification',e.id,e.full_name,c.id::text,c.title,c.expires_on,(c.expires_on-current_date)::int
    from employee_certifications c join employees e on e.id=c.employee_id where c.expires_on between current_date and current_date + greatest(1,p_days)
    union all
    select 'equipment_return',e.id,e.full_name,q.id::text,q.item_name,q.expected_return_on,(q.expected_return_on-current_date)::int
    from employee_equipment q join employees e on e.id=q.employee_id where q.status='assigned' and q.expected_return_on between current_date and current_date + greatest(1,p_days)
  ) x
  where public.is_bcb_admin() or public.is_bcb_owner()
  order by due_date,employee_name;
$$;
revoke all on function public.get_hr_alerts(integer) from public,anon;
grant execute on function public.get_hr_alerts(integer) to authenticated;
