begin;

alter table public.projects
  add column if not exists client_name text,
  add column if not exists client_phone text,
  add column if not exists client_email text,
  add column if not exists planned_start date,
  add column if not exists planned_end date,
  add column if not exists budget_estimated numeric(14,2),
  add column if not exists contract_value numeric(14,2),
  add column if not exists health_status text not null default 'on_track',
  add column if not exists risk_level text not null default 'normal',
  add column if not exists internal_notes text,
  add column if not exists project_manager_id uuid references auth.users(id) on delete set null,
  add column if not exists source_quote_id uuid references public.quote_requests(id) on delete set null;

alter table public.projects drop constraint if exists projects_health_status_check;
alter table public.projects add constraint projects_health_status_check check (health_status in ('on_track','attention','at_risk','blocked'));
alter table public.projects drop constraint if exists projects_risk_level_check;
alter table public.projects add constraint projects_risk_level_check check (risk_level in ('low','normal','high','critical'));

create unique index if not exists projects_source_quote_uidx on public.projects(source_quote_id) where source_quote_id is not null;
create index if not exists projects_manager_idx on public.projects(project_manager_id);
create index if not exists projects_planned_end_idx on public.projects(planned_end) where status = 'in_progress';

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_status_idx on public.project_tasks(project_id,status,due_date);
create index if not exists project_tasks_assigned_idx on public.project_tasks(assigned_to,status) where assigned_to is not null;

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  target_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','delayed','cancelled')),
  completed_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_milestones_project_date_idx on public.project_milestones(project_id,target_date);

create table if not exists public.project_team_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_on_project text,
  is_lead boolean not null default false,
  active_from date,
  active_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id,employee_id)
);

create index if not exists project_team_members_employee_idx on public.project_team_members(employee_id);

create or replace function public.projects2_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if tg_table_name = 'project_tasks' then
    if new.status = 'done' and (old.status is distinct from 'done' or new.completed_at is null) then new.completed_at = coalesce(new.completed_at,now()); end if;
    if new.status <> 'done' then new.completed_at = null; end if;
  elsif tg_table_name = 'project_milestones' then
    if new.status = 'completed' and (old.status is distinct from 'completed' or new.completed_at is null) then new.completed_at = coalesce(new.completed_at,now()); end if;
    if new.status <> 'completed' then new.completed_at = null; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.projects2_touch_updated_at() from public, anon, authenticated;

drop trigger if exists project_tasks_touch_updated_at on public.project_tasks;
create trigger project_tasks_touch_updated_at before update on public.project_tasks for each row execute function public.projects2_touch_updated_at();
drop trigger if exists project_milestones_touch_updated_at on public.project_milestones;
create trigger project_milestones_touch_updated_at before update on public.project_milestones for each row execute function public.projects2_touch_updated_at();

alter table public.project_tasks enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_team_members enable row level security;

-- Operational tasks and milestones follow the existing project staff access model.
drop policy if exists "staff read project tasks" on public.project_tasks;
create policy "staff read project tasks" on public.project_tasks for select to authenticated using (is_bcb_staff());
drop policy if exists "staff insert project tasks" on public.project_tasks;
create policy "staff insert project tasks" on public.project_tasks for insert to authenticated with check (is_bcb_staff() and created_by = (select auth.uid()));
drop policy if exists "staff update project tasks" on public.project_tasks;
create policy "staff update project tasks" on public.project_tasks for update to authenticated using (is_bcb_staff()) with check (is_bcb_staff());
drop policy if exists "admins delete project tasks" on public.project_tasks;
create policy "admins delete project tasks" on public.project_tasks for delete to authenticated using (is_bcb_admin() or is_bcb_owner());

drop policy if exists "staff read project milestones" on public.project_milestones;
create policy "staff read project milestones" on public.project_milestones for select to authenticated using (is_bcb_staff());
drop policy if exists "staff insert project milestones" on public.project_milestones;
create policy "staff insert project milestones" on public.project_milestones for insert to authenticated with check (is_bcb_staff() and created_by = (select auth.uid()));
drop policy if exists "staff update project milestones" on public.project_milestones;
create policy "staff update project milestones" on public.project_milestones for update to authenticated using (is_bcb_staff()) with check (is_bcb_staff());
drop policy if exists "admins delete project milestones" on public.project_milestones;
create policy "admins delete project milestones" on public.project_milestones for delete to authenticated using (is_bcb_admin() or is_bcb_owner());

-- Team assignment is HR-adjacent, therefore restricted to Owner/Admin.
drop policy if exists "admins read project team" on public.project_team_members;
create policy "admins read project team" on public.project_team_members for select to authenticated using (is_bcb_admin() or is_bcb_owner());
drop policy if exists "admins manage project team" on public.project_team_members;
create policy "admins manage project team" on public.project_team_members for all to authenticated using (is_bcb_admin() or is_bcb_owner()) with check (is_bcb_admin() or is_bcb_owner());

-- Keep CRM conversion aligned with the richer project record without changing its idempotent behavior.
create or replace function public.bcb_convert_quote_to_project(p_quote_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  q public.quote_requests%rowtype;
  p_id uuid;
  base_slug text;
begin
  if not is_bcb_staff() then raise exception 'Not authorized'; end if;
  select * into q from public.quote_requests where id = p_quote_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if q.converted_project_id is not null then return q.converted_project_id; end if;

  base_slug := regexp_replace(lower(coalesce(q.project_type,'proiect') || '-' || coalesce(q.location,'bcb')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug) || '-' || substr(replace(q.id::text,'-',''),1,8);

  insert into public.projects(
    title,slug,location,short_description,description,status,progress,current_stage,
    client_name,client_phone,client_email,budget_estimated,health_status,risk_level,
    source_quote_id,created_by,updated_by
  ) values (
    coalesce(nullif(q.project_type,''),'Proiect BCB') || case when q.location is not null then ' — '||q.location else '' end,
    base_slug,q.location,
    left(coalesce(q.message,'Proiect creat din CRM.'),300),q.message,'draft',0,q.project_stage,
    q.full_name,q.phone,q.email,
    case
      when q.estimated_budget ~* '100[.]?000|peste' then 100000
      when q.estimated_budget ~* '50[.]?000' then 50000
      when q.estimated_budget ~* '20[.]?000' then 20000
      else null
    end,
    'on_track','normal',q.id,(select auth.uid()),(select auth.uid())
  ) returning id into p_id;

  update public.quote_requests
    set converted_project_id=p_id, converted_at=now(), status='accepted', updated_at=now()
    where id=q.id;
  insert into public.quote_request_events(quote_id,actor_id,event_type,summary,metadata)
    values(q.id,(select auth.uid()),'converted','Lead transformat în proiect',jsonb_build_object('project_id',p_id));
  return p_id;
end;
$$;

grant execute on function public.bcb_convert_quote_to_project(uuid) to authenticated;

commit;
