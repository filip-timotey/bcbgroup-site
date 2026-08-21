create or replace function private.enforce_field_report_identity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_admin boolean;
  v_employee uuid;
  v_time_entry uuid;
begin
  if v_role='service_role' then
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
