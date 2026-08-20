-- BCB Business Manager · Job Costing + Security hardening v1
-- Additive migration. Existing Fleet/HR/report data is not modified.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Keep privilege-elevated role checks outside the exposed public API schema.
create or replace function private.is_bcb_owner_core()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.is_owner = true
  );
$$;
create or replace function private.is_bcb_admin_core()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and (p.role = 'admin' or p.is_owner = true)
  );
$$;
create or replace function private.is_bcb_staff_core()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and (p.role in ('admin','editor') or p.is_owner = true)
  );
$$;
grant execute on function private.is_bcb_owner_core() to authenticated, service_role;
grant execute on function private.is_bcb_admin_core() to authenticated, service_role;
grant execute on function private.is_bcb_staff_core() to authenticated, service_role;

-- Public wrappers remain compatible with all existing RLS policies, but are no longer SECURITY DEFINER.
create or replace function public.is_bcb_owner()
returns boolean language sql stable security invoker set search_path = public, private, pg_temp
as $$ select private.is_bcb_owner_core(); $$;
create or replace function public.is_bcb_admin()
returns boolean language sql stable security invoker set search_path = public, private, pg_temp
as $$ select private.is_bcb_admin_core(); $$;
create or replace function public.is_bcb_staff()
returns boolean language sql stable security invoker set search_path = public, private, pg_temp
as $$ select private.is_bcb_staff_core(); $$;

-- Financial data is intentionally isolated from public.projects.
create table if not exists public.project_financials (
  project_id uuid primary key references public.projects(id) on delete cascade,
  budget_estimated numeric(14,2) check (budget_estimated is null or budget_estimated >= 0),
  contract_value numeric(14,2) check (contract_value is null or contract_value >= 0),
  contingency_amount numeric(14,2) not null default 0 check (contingency_amount >= 0),
  currency text not null default 'RON' check (currency in ('RON','EUR')),
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_cost_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('material','labor','subcontractor','fuel','equipment','transport','permit','other')),
  description text not null check (char_length(trim(description)) between 2 and 300),
  supplier text,
  cost_date date not null default current_date,
  amount_net numeric(14,2) not null default 0 check (amount_net >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  amount_gross numeric(14,2) generated always as (amount_net + vat_amount) stored,
  status text not null default 'draft' check (status in ('draft','approved','rejected')),
  source text not null default 'manual' check (source in ('manual','field','fleet','import','ai_assisted')),
  receipt_path text,
  linked_fleet_fuel_id uuid references public.fleet_fuel_entries(id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_material_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 2 and 180),
  quantity numeric(12,3) check (quantity is null or quantity >= 0),
  unit text,
  status text not null default 'needed' check (status in ('needed','ordered','delivered','used','cancelled')),
  needed_by date,
  supplier text,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_entries_project_status_idx on public.project_cost_entries(project_id,status,cost_date desc);
create index if not exists project_cost_entries_created_by_idx on public.project_cost_entries(created_by,created_at desc);
create index if not exists project_cost_entries_fuel_idx on public.project_cost_entries(linked_fleet_fuel_id) where linked_fleet_fuel_id is not null;
create index if not exists project_material_requirements_project_status_idx on public.project_material_requirements(project_id,status,needed_by);
create index if not exists project_financials_updated_by_idx on public.project_financials(updated_by);

alter table public.project_financials enable row level security;
alter table public.project_cost_entries enable row level security;
alter table public.project_material_requirements enable row level security;

-- Owner/Admin may see project financials. Editors cannot query this table.
drop policy if exists "finance admins read project financials" on public.project_financials;
create policy "finance admins read project financials" on public.project_financials for select to authenticated using (public.is_bcb_admin());
drop policy if exists "finance admins insert project financials" on public.project_financials;
create policy "finance admins insert project financials" on public.project_financials for insert to authenticated with check (public.is_bcb_admin() and created_by = (select auth.uid()));
drop policy if exists "finance admins update project financials" on public.project_financials;
create policy "finance admins update project financials" on public.project_financials for update to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());
drop policy if exists "owner deletes project financials" on public.project_financials;
create policy "owner deletes project financials" on public.project_financials for delete to authenticated using (public.is_bcb_owner());

-- Owner/Admin: full financial workflow. Editor: may submit a draft field expense and see only own drafts.
drop policy if exists "finance admins read project costs" on public.project_cost_entries;
create policy "finance admins read project costs" on public.project_cost_entries for select to authenticated using (public.is_bcb_admin());
drop policy if exists "editors read own draft project costs" on public.project_cost_entries;
create policy "editors read own draft project costs" on public.project_cost_entries for select to authenticated using (public.is_bcb_staff() and not public.is_bcb_admin() and created_by = (select auth.uid()) and status = 'draft');
drop policy if exists "staff submit project cost drafts" on public.project_cost_entries;
create policy "staff submit project cost drafts" on public.project_cost_entries for insert to authenticated with check (public.is_bcb_staff() and created_by = (select auth.uid()) and status = 'draft');
drop policy if exists "finance admins update project costs" on public.project_cost_entries;
create policy "finance admins update project costs" on public.project_cost_entries for update to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());
drop policy if exists "owner deletes project costs" on public.project_cost_entries;
create policy "owner deletes project costs" on public.project_cost_entries for delete to authenticated using (public.is_bcb_owner());

-- Materials are operational data; all active staff can work with them, destructive delete remains privileged.
drop policy if exists "staff read project materials" on public.project_material_requirements;
create policy "staff read project materials" on public.project_material_requirements for select to authenticated using (public.is_bcb_staff());
drop policy if exists "staff insert project materials" on public.project_material_requirements;
create policy "staff insert project materials" on public.project_material_requirements for insert to authenticated with check (public.is_bcb_staff() and created_by = (select auth.uid()));
drop policy if exists "staff update project materials" on public.project_material_requirements;
create policy "staff update project materials" on public.project_material_requirements for update to authenticated using (public.is_bcb_staff()) with check (public.is_bcb_staff());
drop policy if exists "admins delete project materials" on public.project_material_requirements;
create policy "admins delete project materials" on public.project_material_requirements for delete to authenticated using (public.is_bcb_admin());

-- Approved cost summary; security_invoker ensures base-table RLS remains authoritative.
create or replace view public.project_cost_summary
with (security_invoker = true)
as
select project_id,
       coalesce(sum(amount_gross) filter (where status='approved'),0)::numeric(14,2) as approved_cost,
       coalesce(sum(amount_gross) filter (where status='draft'),0)::numeric(14,2) as pending_cost,
       coalesce(sum(amount_gross) filter (where status='approved' and category='material'),0)::numeric(14,2) as material_cost,
       coalesce(sum(amount_gross) filter (where status='approved' and category='labor'),0)::numeric(14,2) as labor_cost,
       coalesce(sum(amount_gross) filter (where status='approved' and category='fuel'),0)::numeric(14,2) as fuel_cost,
       count(*) filter (where status='draft')::int as pending_entries
from public.project_cost_entries
group by project_id;

grant select on public.project_cost_summary to authenticated;

-- Keep legacy project financial columns empty going forward. Existing values are migrated first if present.
insert into public.project_financials(project_id,budget_estimated,contract_value,created_by,updated_by)
select p.id,p.budget_estimated,p.contract_value,p.created_by,p.updated_by
from public.projects p
where (p.budget_estimated is not null or p.contract_value is not null)
on conflict(project_id) do update set
  budget_estimated=coalesce(excluded.budget_estimated,public.project_financials.budget_estimated),
  contract_value=coalesce(excluded.contract_value,public.project_financials.contract_value),
  updated_at=now();

-- timestamps
create or replace function public.set_project_finance_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_project_financials_updated_at on public.project_financials;
create trigger trg_project_financials_updated_at before update on public.project_financials for each row execute function public.set_project_finance_updated_at();
drop trigger if exists trg_project_cost_entries_updated_at on public.project_cost_entries;
create trigger trg_project_cost_entries_updated_at before update on public.project_cost_entries for each row execute function public.set_project_finance_updated_at();
drop trigger if exists trg_project_materials_updated_at on public.project_material_requirements;
create trigger trg_project_materials_updated_at before update on public.project_material_requirements for each row execute function public.set_project_finance_updated_at();

revoke execute on function public.set_project_finance_updated_at() from public, anon, authenticated;
