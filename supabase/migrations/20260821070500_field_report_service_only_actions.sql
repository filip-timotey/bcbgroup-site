drop function if exists public.finalize_field_daily_report(uuid);
drop function if exists public.review_field_report_suggestion(uuid,text);

create or replace function public.finalize_field_daily_report_service(p_report_id uuid,p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r public.field_daily_reports%rowtype;
  v_journal uuid;
  v_hours numeric := 0;
  v_team text;
  v_actor_ok boolean := false;
  v_admin boolean := false;
begin
  select exists(select 1 from public.profiles p where p.id=p_actor_id and p.is_active=true and (p.role in ('admin','editor') or p.is_owner=true)),
         exists(select 1 from public.profiles p where p.id=p_actor_id and p.is_active=true and (p.role='admin' or p.is_owner=true))
  into v_actor_ok,v_admin;
  if not v_actor_ok then raise exception 'Actor invalid.'; end if;
  select * into r from public.field_daily_reports where id=p_report_id for update;
  if r.id is null then raise exception 'Raport inexistent.'; end if;
  if r.created_by<>p_actor_id and not v_admin then raise exception 'Acces interzis.'; end if;
  if r.status='draft' then raise exception 'Raportul trebuie trimis inainte de finalizare.'; end if;

  select coalesce(sum(greatest(0,extract(epoch from (coalesce(t.ended_at,clock_timestamp())-t.started_at))/3600 - coalesce(t.break_minutes,0)/60.0)),0)
    into v_hours
  from public.employee_time_entries t
  where t.project_id=r.project_id and t.work_date=r.work_date and t.started_at is not null;

  select string_agg(distinct e.full_name, ', ' order by e.full_name)
    into v_team
  from public.employee_time_entries t join public.employees e on e.id=t.employee_id
  where t.project_id=r.project_id and t.work_date=r.work_date and t.started_at is not null;

  if r.journal_entry_id is null then
    insert into public.site_journal_entries(project_id,work_date,stage,team_members,hours_worked,work_summary,issues_notes,materials_needed,created_by,updated_by)
    select r.project_id,r.work_date,p.current_stage,v_team,round(v_hours,2),coalesce(nullif(r.work_summary,''),r.report_text),r.issues_notes,r.materials_needed,r.created_by,p_actor_id
    from public.projects p where p.id=r.project_id returning id into v_journal;
    update public.field_daily_reports set journal_entry_id=v_journal,updated_by=p_actor_id,updated_at=clock_timestamp() where id=r.id;
  else
    v_journal:=r.journal_entry_id;
    update public.site_journal_entries set team_members=v_team,hours_worked=round(v_hours,2),work_summary=coalesce(nullif(r.work_summary,''),r.report_text),issues_notes=r.issues_notes,materials_needed=r.materials_needed,updated_by=p_actor_id,updated_at=clock_timestamp() where id=v_journal;
  end if;
  return jsonb_build_object('report_id',r.id,'journal_entry_id',v_journal,'hours_worked',round(v_hours,2),'team_members',v_team);
end;
$$;
revoke all on function public.finalize_field_daily_report_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_field_daily_report_service(uuid,uuid) to service_role;

create or replace function public.review_field_report_suggestion_service(p_suggestion_id uuid,p_decision text,p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  s public.field_report_suggestions%rowtype;
  v_entity uuid;
  v_admin boolean := false;
begin
  select exists(select 1 from public.profiles p where p.id=p_actor_id and p.is_active=true and (p.role='admin' or p.is_owner=true)) into v_admin;
  if not v_admin then raise exception 'Doar Owner/Admin poate valida propuneri.'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'Decizie invalida.'; end if;
  select * into s from public.field_report_suggestions where id=p_suggestion_id for update;
  if s.id is null then raise exception 'Propunere inexistenta.'; end if;
  if s.status<>'suggested' then return jsonb_build_object('id',s.id,'status',s.status,'created_entity_id',s.created_entity_id,'idempotent',true); end if;

  if p_decision='accepted' then
    if s.suggestion_type='task' then
      insert into public.project_tasks(project_id,title,description,status,priority,due_date,created_by,updated_by)
      values(s.project_id,s.title,s.description,'todo',s.priority,s.due_date,p_actor_id,p_actor_id) returning id into v_entity;
    elsif s.suggestion_type='material' then
      insert into public.project_material_requirements(project_id,item_name,quantity,unit,status,needed_by,notes,created_by,updated_by)
      values(s.project_id,s.title,s.quantity,s.unit,'needed',s.due_date,s.description,p_actor_id,p_actor_id) returning id into v_entity;
    end if;
  end if;

  update public.field_report_suggestions set status=p_decision,created_entity_id=v_entity,reviewed_by=p_actor_id,reviewed_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('id',s.id,'status',p_decision,'created_entity_id',v_entity,'idempotent',false);
end;
$$;
revoke all on function public.review_field_report_suggestion_service(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.review_field_report_suggestion_service(uuid,text,uuid) to service_role;
