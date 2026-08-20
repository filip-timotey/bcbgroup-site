-- Move remaining SECURITY DEFINER implementations outside the exposed public schema.

create or replace function private.fleet_vehicle_availability_core()
returns table(vehicle_id uuid,is_busy boolean)
language sql stable security definer
set search_path=public,pg_temp
as $$
  select v.id, exists(select 1 from public.fleet_trips t where t.vehicle_id=v.id and t.status='active')
  from public.fleet_vehicles v
  where v.is_active=true and private.is_bcb_staff_core();
$$;
grant execute on function private.fleet_vehicle_availability_core() to authenticated,service_role;
create or replace function public.fleet_vehicle_availability()
returns table(vehicle_id uuid,is_busy boolean)
language sql stable security invoker
set search_path=public,private,pg_temp
as $$ select * from private.fleet_vehicle_availability_core(); $$;
revoke all on function public.fleet_vehicle_availability() from public,anon;
grant execute on function public.fleet_vehicle_availability() to authenticated,service_role;

create or replace function private.get_hr_alerts_core(p_days integer default 30)
returns table(alert_type text,employee_id uuid,employee_name text,item_id text,title text,due_date date,days_left integer)
language sql stable security definer
set search_path=public,pg_temp
as $$
  select x.alert_type,x.employee_id,x.employee_name,x.item_id,x.title,x.due_date,x.days_left
  from (
    select 'contract'::text alert_type,e.id employee_id,e.full_name employee_name,e.id::text item_id,'Contract angajat'::text title,e.contract_end due_date,(e.contract_end-current_date)::int days_left
    from public.employees e where e.contract_end between current_date and current_date+greatest(1,p_days)
    union all
    select 'document',e.id,e.full_name,d.id::text,d.title,d.expires_at,(d.expires_at-current_date)::int from public.employee_documents d join public.employees e on e.id=d.employee_id where d.expires_at between current_date and current_date+greatest(1,p_days)
    union all
    select 'certification',e.id,e.full_name,c.id::text,c.title,c.expires_on,(c.expires_on-current_date)::int from public.employee_certifications c join public.employees e on e.id=c.employee_id where c.expires_on between current_date and current_date+greatest(1,p_days)
    union all
    select 'equipment_return',e.id,e.full_name,q.id::text,q.item_name,q.expected_return_on,(q.expected_return_on-current_date)::int from public.employee_equipment q join public.employees e on e.id=q.employee_id where q.status='assigned' and q.expected_return_on between current_date and current_date+greatest(1,p_days)
  ) x
  where private.is_bcb_admin_core() or private.is_bcb_owner_core()
  order by x.due_date,x.employee_name;
$$;
grant execute on function private.get_hr_alerts_core(integer) to authenticated,service_role;
create or replace function public.get_hr_alerts(p_days integer default 30)
returns table(alert_type text,employee_id uuid,employee_name text,item_id text,title text,due_date date,days_left integer)
language sql stable security invoker
set search_path=public,private,pg_temp
as $$ select * from private.get_hr_alerts_core(p_days); $$;
revoke all on function public.get_hr_alerts(integer) from public,anon;
grant execute on function public.get_hr_alerts(integer) to authenticated,service_role;

create or replace function private.set_own_avatar_core(p_avatar_path text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Autentificare necesară.'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active=true) then raise exception 'Cont inactiv sau inexistent.'; end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^'||auth.uid()::text||'/[A-Za-z0-9._-]+$') then raise exception 'Cale avatar invalidă.'; end if;
  update public.profiles set avatar_path=p_avatar_path where id=auth.uid();
end; $$;
grant execute on function private.set_own_avatar_core(text) to authenticated,service_role;
create or replace function public.set_own_avatar(p_avatar_path text)
returns void language sql security invoker set search_path=public,private,pg_temp as $$ select private.set_own_avatar_core(p_avatar_path); $$;
revoke all on function public.set_own_avatar(text) from public,anon;
grant execute on function public.set_own_avatar(text) to authenticated,service_role;