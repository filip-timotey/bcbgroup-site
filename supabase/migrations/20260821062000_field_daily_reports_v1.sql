-- Field Daily Reports v1
-- Source-of-truth field reporting with AI suggestions, journal finalization and governed acceptance.

create table if not exists public.field_daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  time_entry_id uuid references public.employee_time_entries(id) on delete set null,
  journal_entry_id uuid references public.site_journal_entries(id) on delete set null,
  work_date date not null default (timezone('Europe/Bucharest', now()))::date,
  status text not null default 'submitted',
  source text not null default 'field_mobile',
  report_text text not null,
  work_summary text,
  issues_notes text,
  materials_needed text,
  next_steps text,
  safety_notes text,
  risk_level text not null default 'low',
  ai_status text not null default 'pending',
  ai_model text,
  ai_confidence numeric,
  ai_payload jsonb not null default '{}'::jsonb,
  ai_analyzed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_daily_reports_status_check check (status in ('draft','submitted','reviewed','needs_attention','archived')),
  constraint field_daily_reports_source_check check (source in ('field_mobile','journal','admin_manual')),
  constraint field_daily_reports_risk_check check (risk_level in ('low','medium','high','critical')),
  constraint field_daily_reports_ai_status_check check (ai_status in ('pending','processing','ready','failed','not_requested')),
  constraint field_daily_reports_confidence_check check (ai_confidence is null or (ai_confidence between 0 and 1)),
  constraint field_daily_reports_text_check check (char_length(trim(report_text)) between 2 and 12000)
);

create table if not exists public.field_report_suggestions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.field_daily_reports(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  suggestion_type text not null,
  title text not null,
  description text,
  priority text not null default 'normal',
  quantity numeric,
  unit text,
  due_date date,
  status text not null default 'suggested',
  created_entity_id uuid,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint field_report_suggestions_type_check check (suggestion_type in ('task','material','risk','note')),
  constraint field_report_suggestions_priority_check check (priority in ('low','normal','high','urgent')),
  constraint field_report_suggestions_status_check check (status in ('suggested','accepted','rejected')),
  constraint field_report_suggestions_title_check check (char_length(trim(title)) between 2 and 240),
  constraint field_report_suggestions_quantity_check check (quantity is null or quantity >= 0)
);

create index if not exists field_daily_reports_project_date_idx on public.field_daily_reports(project_id, work_date desc);
create index if not exists field_daily_reports_creator_date_idx on public.field_daily_reports(created_by, work_date desc);
create index if not exists field_daily_reports_employee_date_idx on public.field_daily_reports(employee_id, work_date desc);
create index if not exists field_daily_reports_status_idx on public.field_daily_reports(status, work_date desc);
create index if not exists field_daily_reports_risk_idx on public.field_daily_reports(risk_level, work_date desc) where risk_level in ('high','critical');
create index if not exists field_daily_reports_time_entry_idx on public.field_daily_reports(time_entry_id) where time_entry_id is not null;
create index if not exists field_daily_reports_journal_idx on public.field_daily_reports(journal_entry_id) where journal_entry_id is not null;
create index if not exists field_daily_reports_updated_by_idx on public.field_daily_reports(updated_by);
create index if not exists field_daily_reports_reviewed_by_idx on public.field_daily_reports(reviewed_by);
create index if not exists field_report_suggestions_report_idx on public.field_report_suggestions(report_id, status);
create index if not exists field_report_suggestions_project_idx on public.field_report_suggestions(project_id, status, suggestion_type);
create index if not exists field_report_suggestions_reviewed_by_idx on public.field_report_suggestions(reviewed_by);

alter table public.field_daily_reports enable row level security;
alter table public.field_report_suggestions enable row level security;

drop policy if exists "field reports own read" on public.field_daily_reports;
drop policy if exists "field reports admin read" on public.field_daily_reports;
drop policy if exists "field reports own insert" on public.field_daily_reports;
drop policy if exists "field reports own draft update" on public.field_daily_reports;
drop policy if exists "field reports admin update" on public.field_daily_reports;
drop policy if exists "field reports owner delete" on public.field_daily_reports;

create policy "field reports own read" on public.field_daily_reports
for select to authenticated using (created_by = (select auth.uid()));
create policy "field reports admin read" on public.field_daily_reports
for select to authenticated using (public.is_bcb_admin() or public.is_bcb_owner());
create policy "field reports own insert" on public.field_daily_reports
for insert to authenticated with check (created_by = (select auth.uid()) and public.is_bcb_staff());
create policy "field reports own draft update" on public.field_daily_reports
for update to authenticated
using (created_by = (select auth.uid()) and status = 'draft')
with check (created_by = (select auth.uid()) and status = 'draft');
create policy "field reports admin update" on public.field_daily_reports
for update to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner())
with check (public.is_bcb_admin() or public.is_bcb_owner());
create policy "field reports owner delete" on public.field_daily_reports
for delete to authenticated using (public.is_bcb_owner());

drop policy if exists "field suggestions reporter read" on public.field_report_suggestions;
drop policy if exists "field suggestions admin read" on public.field_report_suggestions;
drop policy if exists "field suggestions admin update" on public.field_report_suggestions;
create policy "field suggestions reporter read" on public.field_report_suggestions
for select to authenticated using (exists(select 1 from public.field_daily_reports r where r.id=report_id and r.created_by=(select auth.uid())));
create policy "field suggestions admin read" on public.field_report_suggestions
for select to authenticated using (public.is_bcb_admin() or public.is_bcb_owner());
-- Suggestions are written by the service layer and accepted/rejected only through the governed RPC below.

create or replace function private.ensure_field_report_employee(p_uid uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_employee uuid;
  v_name text;
  v_email text;
begin
  select e.id into v_employee from public.employees e
  where e.profile_id=p_uid and e.employment_status='active' limit 1;
  if v_employee is not null then return v_employee; end if;

  select coalesce(nullif(trim(p.full_name),''),'BCB User'), p.email into v_name,v_email
  from public.profiles p where p.id=p_uid and p.is_active=true;
  if v_name is null then raise exception 'Profil activ indisponibil.'; end if;

  insert into public.employees(profile_id,full_name,work_email,employment_type,employment_status,record_origin,hr_confirmed,created_by,updated_by)
  values(p_uid,v_name,v_email,'other','active','access_profile',false,p_uid,p_uid)
  on conflict (profile_id) where profile_id is not null do update
    set employment_status='active', updated_by=p_uid, updated_at=now()
  returning id into v_employee;
  return v_employee;
end;
$$;
revoke all on function private.ensure_field_report_employee(uuid) from public,anon,authenticated;

create or replace function private.enforce_field_report_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_employee uuid;
  v_time_entry uuid;
begin
  if v_uid is null then raise exception 'Autentificare necesara.'; end if;
  select exists(select 1 from public.profiles p where p.id=v_uid and p.is_active=true and (p.is_owner=true or p.role='admin')) into v_admin;

  if tg_op='INSERT' then
    if not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active=true and (p.role in ('admin','editor') or p.is_owner=true)) then raise exception 'Acces interzis.'; end if;
    v_employee := private.ensure_field_report_employee(v_uid);
    new.employee_id := v_employee;
    new.created_by := v_uid;
    new.updated_by := v_uid;
    new.work_date := coalesce(new.work_date,(timezone('Europe/Bucharest',clock_timestamp()))::date);
    new.source := case when v_admin and coalesce(new.source,'')='admin_manual' then 'admin_manual' else 'field_mobile' end;
    new.status := case when coalesce(new.status,'submitted')='draft' then 'draft' else 'submitted' end;
    new.ai_status := case when new.status='draft' then 'not_requested' else 'pending' end;
    new.reviewed_by := null; new.reviewed_at := null;
    new.ai_model := null; new.ai_confidence := null; new.ai_payload := '{}'::jsonb; new.ai_analyzed_at := null;
    new.updated_at := clock_timestamp();
    if new.time_entry_id is null then
      select t.id into v_time_entry from public.employee_time_entries t
      where t.employee_id=v_employee and t.project_id=new.project_id and t.work_date=new.work_date
      order by coalesce(t.ended_at,t.started_at) desc nulls last limit 1;
      new.time_entry_id := v_time_entry;
    end if;
    return new;
  end if;

  new.updated_at := clock_timestamp();
  new.updated_by := v_uid;
  if v_admin then
    if new.status='reviewed' and old.status is distinct from new.status then new.reviewed_by:=v_uid; new.reviewed_at:=clock_timestamp();
    elsif new.status<>'reviewed' then new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at; end if;
    new.created_by:=old.created_by; new.employee_id:=old.employee_id; new.project_id:=old.project_id; new.work_date:=old.work_date; new.time_entry_id:=old.time_entry_id; new.source:=old.source;
    return new;
  end if;

  -- Reporter may only change a report while it is still a draft. Sensitive/AI fields remain server-owned.
  new.created_by:=old.created_by; new.employee_id:=old.employee_id; new.project_id:=old.project_id; new.work_date:=old.work_date; new.time_entry_id:=old.time_entry_id; new.journal_entry_id:=old.journal_entry_id; new.source:=old.source;
  new.status:='draft'; new.ai_status:=old.ai_status; new.ai_model:=old.ai_model; new.ai_confidence:=old.ai_confidence; new.ai_payload:=old.ai_payload; new.ai_analyzed_at:=old.ai_analyzed_at; new.risk_level:=old.risk_level; new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
  return new;
end;
$$;
revoke all on function private.enforce_field_report_identity() from public,anon,authenticated;
drop trigger if exists bcb_field_report_identity on public.field_daily_reports;
create trigger bcb_field_report_identity before insert or update on public.field_daily_reports
for each row execute function private.enforce_field_report_identity();

create or replace function public.finalize_field_daily_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  r public.field_daily_reports%rowtype;
  v_journal uuid;
  v_hours numeric := 0;
  v_team text;
begin
  if v_uid is null then raise exception 'Autentificare necesara.'; end if;
  select * into r from public.field_daily_reports where id=p_report_id for update;
  if r.id is null then raise exception 'Raport inexistent.'; end if;
  if r.created_by<>v_uid and not (public.is_bcb_admin() or public.is_bcb_owner()) then raise exception 'Acces interzis.'; end if;
  if r.status='draft' then raise exception 'Raportul trebuie trimis inainte de finalizare.'; end if;

  select coalesce(sum(greatest(0,extract(epoch from (coalesce(t.ended_at,clock_timestamp())-t.started_at))/3600 - coalesce(t.break_minutes,0)/60.0)),0)
  into v_hours from public.employee_time_entries t
  where t.project_id=r.project_id and t.work_date=r.work_date and t.started_at is not null;

  select string_agg(distinct e.full_name, ', ' order by e.full_name) into v_team
  from public.employee_time_entries t join public.employees e on e.id=t.employee_id
  where t.project_id=r.project_id and t.work_date=r.work_date and t.started_at is not null;

  if r.journal_entry_id is null then
    insert into public.site_journal_entries(project_id,work_date,stage,team_members,hours_worked,work_summary,issues_notes,materials_needed,created_by,updated_by)
    select r.project_id,r.work_date,p.current_stage,v_team,round(v_hours,2),coalesce(nullif(r.work_summary,''),r.report_text),r.issues_notes,r.materials_needed,r.created_by,v_uid
    from public.projects p where p.id=r.project_id returning id into v_journal;
    update public.field_daily_reports set journal_entry_id=v_journal,updated_by=v_uid,updated_at=clock_timestamp() where id=r.id;
  else
    v_journal:=r.journal_entry_id;
    update public.site_journal_entries set team_members=v_team,hours_worked=round(v_hours,2),work_summary=coalesce(nullif(r.work_summary,''),r.report_text),issues_notes=r.issues_notes,materials_needed=r.materials_needed,updated_by=v_uid,updated_at=clock_timestamp() where id=v_journal;
  end if;
  return jsonb_build_object('report_id',r.id,'journal_entry_id',v_journal,'hours_worked',round(v_hours,2),'team_members',v_team);
end;
$$;
revoke all on function public.finalize_field_daily_report(uuid) from public,anon;
grant execute on function public.finalize_field_daily_report(uuid) to authenticated;

create or replace function public.review_field_report_suggestion(p_suggestion_id uuid,p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  s public.field_report_suggestions%rowtype;
  v_entity uuid;
begin
  if v_uid is null or not (public.is_bcb_admin() or public.is_bcb_owner()) then raise exception 'Doar Owner/Admin poate valida propuneri.'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'Decizie invalida.'; end if;
  select * into s from public.field_report_suggestions where id=p_suggestion_id for update;
  if s.id is null then raise exception 'Propunere inexistenta.'; end if;
  if s.status<>'suggested' then return jsonb_build_object('id',s.id,'status',s.status,'created_entity_id',s.created_entity_id,'idempotent',true); end if;

  if p_decision='accepted' then
    if s.suggestion_type='task' then
      insert into public.project_tasks(project_id,title,description,status,priority,due_date,created_by,updated_by)
      values(s.project_id,s.title,s.description,'todo',s.priority,s.due_date,v_uid,v_uid) returning id into v_entity;
    elsif s.suggestion_type='material' then
      insert into public.project_material_requirements(project_id,item_name,quantity,unit,status,needed_by,notes,created_by,updated_by)
      values(s.project_id,s.title,s.quantity,s.unit,'needed',s.due_date,s.description,v_uid,v_uid) returning id into v_entity;
    end if;
  end if;

  update public.field_report_suggestions set status=p_decision,created_entity_id=v_entity,reviewed_by=v_uid,reviewed_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('id',s.id,'status',p_decision,'created_entity_id',v_entity,'idempotent',false);
end;
$$;
revoke all on function public.review_field_report_suggestion(uuid,text) from public,anon;
grant execute on function public.review_field_report_suggestion(uuid,text) to authenticated;
