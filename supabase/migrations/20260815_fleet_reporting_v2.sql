-- =========================================================
-- BCB GROUP — FLEET REPORTING V2
-- Automatic odometer continuity + one monthly report / vehicle
-- =========================================================

-- One monthly report belongs to one vehicle, not to one driver.
alter table public.fleet_reports
  drop constraint if exists fleet_reports_vehicle_id_report_year_report_month_driver_id_key;

-- Remove any duplicate legacy rows before enforcing the new vehicle/month identity.
with ranked as (
  select id,
         row_number() over (
           partition by vehicle_id, report_year, report_month
           order by generated_at desc nulls last, created_at desc
         ) as rn
  from public.fleet_reports
)
delete from public.fleet_reports r
using ranked x
where r.id = x.id and x.rn > 1;

update public.fleet_reports set driver_id = null;

create unique index if not exists fleet_reports_vehicle_month_unique_idx
  on public.fleet_reports(vehicle_id, report_year, report_month);

-- At START, the database is the source of truth for odometer start.
-- Users no longer choose the starting mileage manually.
create or replace function public.fleet_start_trip_odometer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_odometer numeric(12,1);
begin
  select current_odometer into v_odometer
  from public.fleet_vehicles
  where id = new.vehicle_id
    and is_active = true
  for update;

  if v_odometer is null then
    raise exception 'Vehiculul nu este activ sau nu exista.';
  end if;

  new.start_odometer := v_odometer;
  return new;
end;
$$;

drop trigger if exists fleet_trip_start_odometer on public.fleet_trips;
create trigger fleet_trip_start_odometer
before insert on public.fleet_trips
for each row
execute function public.fleet_start_trip_odometer();

-- At STOP, calculate distance and make the arrival mileage the vehicle's new mileage.
create or replace function public.fleet_finish_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric(12,1);
begin
  if new.status = 'completed' and old.status = 'active' then
    if new.end_at is null then new.end_at := now(); end if;
    if new.end_odometer is null then
      raise exception 'Kilometrajul final este obligatoriu.';
    end if;
    if new.end_odometer < old.start_odometer then
      raise exception 'Kilometrajul final nu poate fi mai mic decat kilometrajul de plecare.';
    end if;

    -- Strong guard against accidental extra digits. Admin can correct the vehicle
    -- mileage first if an exceptional journey really exceeds this threshold.
    if new.end_odometer - old.start_odometer > 3000 then
      raise exception 'Diferenta de kilometraj depaseste 3000 km. Verifica valoarea introdusa.';
    end if;

    new.start_odometer := old.start_odometer;
    new.distance_km := round((new.end_odometer - old.start_odometer)::numeric, 1);

    select current_odometer into v_current
    from public.fleet_vehicles
    where id = new.vehicle_id
    for update;

    if v_current is distinct from old.start_odometer then
      -- Keep continuity deterministic even if an admin edited the vehicle while
      -- the trip was open. The completed trip becomes the new source of truth.
      null;
    end if;

    update public.fleet_vehicles
       set current_odometer = new.end_odometer
     where id = new.vehicle_id;
  end if;
  return new;
end;
$$;

drop trigger if exists fleet_trip_finish on public.fleet_trips;
create trigger fleet_trip_finish
before update on public.fleet_trips
for each row
execute function public.fleet_finish_trip();
