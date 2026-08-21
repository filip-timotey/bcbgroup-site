-- Harden Field Operations self clocking and consolidate RLS policies.

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
begin
  if v_uid is null then
    raise exception 'Autentificare necesara.';
  end if;

  select exists(
    select 1 from public.profiles p
    where p.id = v_uid and p.is_active = true and (p.is_owner = true or p.role = 'admin')
  ) into v_privileged;

  v_self_clock := coalesce(new.source,'') = 'self_clock' or (new.created_by = v_uid and new.employee_id is null);

  if v_privileged and not v_self_clock then
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
    -- The database is authoritative for attendance timestamps.
    new.started_at := now();
    new.ended_at := null;
    new.work_date := (now() at time zone 'Europe/Bucharest')::date;
    new.entry_type := coalesce(nullif(new.entry_type,''), 'work');
  else
    new.employee_id := old.employee_id;
    new.project_id := old.project_id;
    new.started_at := old.started_at;
    new.work_date := old.work_date;
    new.entry_type := old.entry_type;
    new.created_by := old.created_by;
    new.source := old.source;
    -- A finished self-clock cannot be reopened. First STOP is timestamped by DB.
    if old.ended_at is not null then
      new.ended_at := old.ended_at;
    elsif new.ended_at is not null then
      new.ended_at := now();
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_time_entry_identity() from public, anon, authenticated;

-- Consolidated policies: one SELECT and one UPDATE evaluation per row.
drop policy if exists "time entries admin manage" on public.employee_time_entries;
drop policy if exists "time entries own read" on public.employee_time_entries;
drop policy if exists "time entries own insert" on public.employee_time_entries;
drop policy if exists "time entries own update draft" on public.employee_time_entries;
drop policy if exists "time entries select" on public.employee_time_entries;
drop policy if exists "time entries insert" on public.employee_time_entries;
drop policy if exists "time entries update" on public.employee_time_entries;
drop policy if exists "time entries admin delete" on public.employee_time_entries;

create policy "time entries select"
on public.employee_time_entries for select to authenticated
using (
  public.is_bcb_admin() or public.is_bcb_owner()
  or created_by = (select auth.uid())
);

create policy "time entries insert"
on public.employee_time_entries for insert to authenticated
with check (
  public.is_bcb_admin() or public.is_bcb_owner()
  or (
    created_by = (select auth.uid())
    and approval_status = 'draft'
    and approved_by is null
    and approved_at is null
  )
);

create policy "time entries update"
on public.employee_time_entries for update to authenticated
using (
  public.is_bcb_admin() or public.is_bcb_owner()
  or (created_by = (select auth.uid()) and approval_status = 'draft')
)
with check (
  public.is_bcb_admin() or public.is_bcb_owner()
  or (
    created_by = (select auth.uid())
    and approval_status = 'draft'
    and approved_by is null
    and approved_at is null
  )
);

create policy "time entries admin delete"
on public.employee_time_entries for delete to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());
