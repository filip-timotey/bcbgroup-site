-- Fix self-clock ownership detection so Admin/Owner can approve another user's row.
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
  v_self_clock boolean := false;
  v_name text;
  v_email text;
begin
  if v_uid is null then raise exception 'Autentificare necesara.'; end if;

  select exists(
    select 1 from public.profiles p
    where p.id = v_uid and p.is_active = true and (p.is_owner = true or p.role = 'admin')
  ) into v_privileged;

  v_self_clock := (
    coalesce(new.source,'') = 'self_clock'
    and new.created_by = v_uid
  ) or (new.created_by = v_uid and new.employee_id is null);

  if v_privileged and not v_self_clock then
    new.updated_by := v_uid;
    if tg_op = 'INSERT' then
      new.created_by := coalesce(new.created_by, v_uid);
      new.source := coalesce(nullif(new.source,''), 'admin_manual');
    end if;
    if new.approval_status = 'approved' and (tg_op = 'INSERT' or old.approval_status is distinct from new.approval_status) then
      new.approved_by := v_uid;
      new.approved_at := clock_timestamp();
    elsif new.approval_status <> 'approved' then
      new.approved_by := null;
      new.approved_at := null;
    end if;
    new.updated_at := clock_timestamp();
    return new;
  end if;

  select e.id into v_employee from public.employees e
  where e.profile_id = v_uid and e.employment_status = 'active' limit 1;

  if v_employee is null then
    select coalesce(nullif(trim(p.full_name),''),'BCB User'), p.email
      into v_name,v_email
    from public.profiles p where p.id=v_uid and p.is_active=true;
    if v_name is null then raise exception 'Profil activ indisponibil.'; end if;
    insert into public.employees(profile_id,full_name,work_email,employment_type,employment_status,record_origin,hr_confirmed,created_by,updated_by)
    values(v_uid,v_name,v_email,'other','active','access_profile',false,v_uid,v_uid)
    on conflict (profile_id) where profile_id is not null do update
      set employment_status='active',updated_by=v_uid,updated_at=clock_timestamp()
    returning id into v_employee;
  end if;

  new.employee_id := v_employee;
  new.created_by := v_uid;
  new.updated_by := v_uid;
  new.approval_status := 'draft';
  new.approved_by := null;
  new.approved_at := null;
  new.source := 'self_clock';
  new.updated_at := clock_timestamp();

  if tg_op = 'INSERT' then
    new.started_at := clock_timestamp();
    new.ended_at := null;
    new.work_date := (clock_timestamp() at time zone 'Europe/Bucharest')::date;
    new.entry_type := coalesce(nullif(new.entry_type,''), 'work');
  else
    new.employee_id := old.employee_id;
    new.project_id := old.project_id;
    new.started_at := old.started_at;
    new.work_date := old.work_date;
    new.entry_type := old.entry_type;
    new.created_by := old.created_by;
    new.source := old.source;
    if old.ended_at is not null then new.ended_at := old.ended_at;
    elsif new.ended_at is not null then new.ended_at := clock_timestamp(); end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_time_entry_identity() from public,anon,authenticated;
