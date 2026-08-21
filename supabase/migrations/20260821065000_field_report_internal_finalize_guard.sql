create or replace function private.enforce_field_report_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_internal boolean := coalesce(current_setting('bcb.field_report_internal',true),'')='1';
  v_admin boolean;
  v_employee uuid;
  v_time_entry uuid;
begin
  if v_role='service_role' or v_internal then
    new.updated_at := clock_timestamp();
    return new;
  end if;
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
  new.updated_at := clock_timestamp(); new.updated_by := v_uid;
  if v_admin then
    if new.status='reviewed' and old.status is distinct from new.status then new.reviewed_by:=v_uid; new.reviewed_at:=clock_timestamp();
    elsif new.status<>'reviewed' then new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at; end if;
    new.created_by:=old.created_by; new.employee_id:=old.employee_id; new.project_id:=old.project_id; new.work_date:=old.work_date; new.time_entry_id:=old.time_entry_id; new.source:=old.source;
    return new;
  end if;
  new.created_by:=old.created_by; new.employee_id:=old.employee_id; new.project_id:=old.project_id; new.work_date:=old.work_date; new.time_entry_id:=old.time_entry_id; new.journal_entry_id:=old.journal_entry_id; new.source:=old.source;
  new.status:='draft'; new.ai_status:=old.ai_status; new.ai_model:=old.ai_model; new.ai_confidence:=old.ai_confidence; new.ai_payload:=old.ai_payload; new.ai_analyzed_at:=old.ai_analyzed_at; new.risk_level:=old.risk_level; new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
  return new;
end;
$$;
revoke all on function private.enforce_field_report_identity() from public,anon,authenticated;

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
    perform set_config('bcb.field_report_internal','1',true);
    update public.field_daily_reports set journal_entry_id=v_journal,updated_by=v_uid,updated_at=clock_timestamp() where id=r.id;
    perform set_config('bcb.field_report_internal','0',true);
  else
    v_journal:=r.journal_entry_id;
    update public.site_journal_entries set team_members=v_team,hours_worked=round(v_hours,2),work_summary=coalesce(nullif(r.work_summary,''),r.report_text),issues_notes=r.issues_notes,materials_needed=r.materials_needed,updated_by=v_uid,updated_at=clock_timestamp() where id=v_journal;
  end if;
  return jsonb_build_object('report_id',r.id,'journal_entry_id',v_journal,'hours_worked',round(v_hours,2),'team_members',v_team);
end;
$$;
revoke all on function public.finalize_field_daily_report(uuid) from public,anon;
grant execute on function public.finalize_field_daily_report(uuid) to authenticated;
