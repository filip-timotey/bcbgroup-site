-- BCB Fleet: atomic trip completion with optional fueling.
-- Additive only: existing trips, fuel entries and reports remain untouched.

create index if not exists fleet_fuel_entries_trip_id_idx
  on public.fleet_fuel_entries (trip_id)
  where trip_id is not null;

create index if not exists fleet_fuel_entries_driver_id_idx
  on public.fleet_fuel_entries (driver_id)
  where driver_id is not null;

create or replace function public.complete_fleet_trip_with_optional_fuel(
  p_trip_id uuid,
  p_end_odometer numeric,
  p_destination text default null,
  p_notes text default null,
  p_end_lat double precision default null,
  p_end_lng double precision default null,
  p_fueled boolean default false,
  p_fuel_liters numeric default null,
  p_fuel_amount numeric default null,
  p_fuel_station text default null
)
returns table(trip_id uuid, fuel_entry_id uuid, distance_km numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trip public.fleet_trips%rowtype;
  v_completed_at timestamptz := clock_timestamp();
  v_fuel_id uuid := null;
begin
  if p_trip_id is null then
    raise exception 'Cursa este obligatorie.';
  end if;

  select *
    into v_trip
    from public.fleet_trips
   where id = p_trip_id
   for update;

  if not found then
    raise exception 'Cursa nu exista.';
  end if;

  if v_trip.status <> 'active' then
    raise exception 'Cursa nu mai este activa.';
  end if;

  if not public.is_bcb_admin() and v_trip.driver_id <> auth.uid() then
    raise exception 'Nu poti incheia cursa altui utilizator.';
  end if;

  if p_end_odometer is null or p_end_odometer < v_trip.start_odometer then
    raise exception 'Kilometrajul final este invalid.';
  end if;

  if p_end_odometer - v_trip.start_odometer > 3000 then
    raise exception 'Diferenta de kilometraj depaseste 3000 km. Verifica valoarea introdusa.';
  end if;

  if coalesce(p_fueled, false) then
    if p_fuel_liters is null or p_fuel_liters <= 0 then
      raise exception 'Cantitatea alimentata trebuie sa fie mai mare decat zero.';
    end if;
    if p_fuel_amount is null or p_fuel_amount <= 0 then
      raise exception 'Valoarea alimentarii trebuie sa fie mai mare decat zero.';
    end if;
  end if;

  update public.fleet_trips
     set end_odometer = p_end_odometer,
         end_at = v_completed_at,
         destination = coalesce(nullif(trim(p_destination), ''), v_trip.destination),
         notes = nullif(trim(p_notes), ''),
         end_lat = p_end_lat,
         end_lng = p_end_lng,
         status = 'completed'
   where id = v_trip.id;

  if coalesce(p_fueled, false) then
    insert into public.fleet_fuel_entries (
      vehicle_id,
      driver_id,
      trip_id,
      fueled_at,
      liters,
      total_amount,
      odometer,
      station,
      notes
    ) values (
      v_trip.vehicle_id,
      v_trip.driver_id,
      v_trip.id,
      v_completed_at,
      round(p_fuel_liters::numeric, 2),
      round(p_fuel_amount::numeric, 2),
      p_end_odometer,
      nullif(trim(p_fuel_station), ''),
      'Inregistrata automat la inchiderea cursei'
    )
    returning id into v_fuel_id;
  end if;

  return query
  select
    v_trip.id,
    v_fuel_id,
    round((p_end_odometer - v_trip.start_odometer)::numeric, 1);
end;
$$;

revoke all on function public.complete_fleet_trip_with_optional_fuel(uuid,numeric,text,text,double precision,double precision,boolean,numeric,numeric,text) from public;
grant execute on function public.complete_fleet_trip_with_optional_fuel(uuid,numeric,text,text,double precision,double precision,boolean,numeric,numeric,text) to authenticated;
