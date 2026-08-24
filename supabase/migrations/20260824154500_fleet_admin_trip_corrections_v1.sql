-- BCB Fleet: governed Owner/Admin corrections for completed trips.
-- Additive only. Existing trips, fuel entries and generated reports remain untouched.

create table if not exists public.fleet_trip_corrections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.fleet_trips(id) on delete cascade,
  corrected_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  changed_fields text[] not null default '{}',
  before_data jsonb not null,
  after_data jsonb not null,
  report_year integer,
  report_month integer,
  vehicle_odometer_updated boolean not null default false,
  continuity_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint fleet_trip_corrections_reason_check check (char_length(trim(reason)) between 3 and 500),
  constraint fleet_trip_corrections_month_check check (report_month is null or report_month between 1 and 12),
  constraint fleet_trip_corrections_year_check check (report_year is null or report_year between 2000 and 2200)
);

create index if not exists fleet_trip_corrections_trip_created_idx
  on public.fleet_trip_corrections(trip_id, created_at desc);
create index if not exists fleet_trip_corrections_actor_idx
  on public.fleet_trip_corrections(corrected_by, created_at desc)
  where corrected_by is not null;

alter table public.fleet_trip_corrections enable row level security;

drop policy if exists "fleet trip corrections privileged read" on public.fleet_trip_corrections;
create policy "fleet trip corrections privileged read"
on public.fleet_trip_corrections for select to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());

-- Audit is immutable from the browser. Only the service RPC writes corrections.
revoke insert, update, delete on public.fleet_trip_corrections from anon, authenticated;

create or replace function public.correct_fleet_trip_service(
  p_trip_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_origin text,
  p_destination text,
  p_purpose text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_start_odometer numeric,
  p_end_odometer numeric,
  p_notes text default null,
  p_project_id uuid default null,
  p_fuel_mode text default 'keep',
  p_fuel_liters numeric default null,
  p_fuel_amount numeric default null,
  p_fuel_station text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_trip public.fleet_trips%rowtype;
  v_actor_ok boolean := false;
  v_before_trip jsonb;
  v_after_trip jsonb;
  v_before_fuel jsonb := '[]'::jsonb;
  v_after_fuel jsonb := '[]'::jsonb;
  v_fuel_count integer := 0;
  v_fuel_id uuid;
  v_changed text[] := '{}';
  v_warnings jsonb := '[]'::jsonb;
  v_prev_end numeric;
  v_next_start numeric;
  v_has_later boolean := false;
  v_vehicle_current numeric;
  v_vehicle_updated boolean := false;
  v_report_year integer;
  v_report_month integer;
  v_report_count integer := 0;
  v_correction_id uuid;
  v_duration interval;
  v_old_end numeric;
  v_old_start numeric;
begin
  select exists(
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.is_active = true
      and (p.is_owner = true or p.role = 'admin')
  ) into v_actor_ok;
  if not v_actor_ok then raise exception 'Doar Owner/Admin poate corecta o cursa.'; end if;
  if p_trip_id is null then raise exception 'Cursa este obligatorie.'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Motivul corectiei este obligatoriu.'; end if;
  if p_fuel_mode not in ('keep','set','remove') then raise exception 'Mod alimentare invalid.'; end if;

  select * into v_trip from public.fleet_trips where id = p_trip_id for update;
  if not found then raise exception 'Cursa nu exista.'; end if;
  if v_trip.status <> 'completed' then raise exception 'Doar cursele finalizate pot fi corectate. Pentru o cursa activa foloseste STOP CURSA.'; end if;

  if p_start_at is null or p_end_at is null or p_end_at < p_start_at then
    raise exception 'Intervalul cursei este invalid.';
  end if;
  v_duration := p_end_at - p_start_at;
  if v_duration > interval '7 days' then raise exception 'Durata corectata depaseste 7 zile. Verifica datele.'; end if;
  if p_start_odometer is null or p_end_odometer is null or p_start_odometer < 0 or p_end_odometer < p_start_odometer then
    raise exception 'Kilometrajul corectat este invalid.';
  end if;
  if p_end_odometer - p_start_odometer > 3000 then
    raise exception 'Diferenta de kilometraj depaseste 3000 km. Verifica valorile.';
  end if;
  if char_length(trim(coalesce(p_purpose,''))) < 1 then raise exception 'Scopul deplasarii este obligatoriu.'; end if;
  if p_project_id is not null and not exists(select 1 from public.projects p where p.id=p_project_id) then
    raise exception 'Proiectul selectat nu exista.';
  end if;
  if p_fuel_mode = 'set' then
    if p_fuel_liters is null or p_fuel_liters <= 0 then raise exception 'Litrii alimentati trebuie sa fie mai mari decat zero.'; end if;
    if p_fuel_amount is null or p_fuel_amount <= 0 then raise exception 'Valoarea alimentarii trebuie sa fie mai mare decat zero.'; end if;
  end if;

  v_old_start := v_trip.start_odometer;
  v_old_end := v_trip.end_odometer;
  v_before_trip := to_jsonb(v_trip);
  select coalesce(jsonb_agg(to_jsonb(f) order by f.fueled_at, f.id), '[]'::jsonb), count(*)
    into v_before_fuel, v_fuel_count
  from public.fleet_fuel_entries f where f.trip_id = v_trip.id;

  if v_fuel_count > 1 and p_fuel_mode <> 'keep' then
    raise exception 'Cursa are mai multe alimentari asociate. Corectia automata a alimentarii este blocata pentru a nu pierde date.';
  end if;

  -- Continuity checks are advisory. We keep the correction possible but record the warning.
  select t.end_odometer into v_prev_end
  from public.fleet_trips t
  where t.vehicle_id=v_trip.vehicle_id and t.id<>v_trip.id and t.status='completed' and t.start_at < p_start_at
  order by t.start_at desc limit 1;
  select t.start_odometer into v_next_start
  from public.fleet_trips t
  where t.vehicle_id=v_trip.vehicle_id and t.id<>v_trip.id and t.start_at > p_start_at
  order by t.start_at asc limit 1;
  if v_prev_end is not null and p_start_odometer < v_prev_end then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','previous_odometer','message','Km plecare este mai mic decat km sosire al cursei anterioare.','reference',v_prev_end));
  end if;
  if v_next_start is not null and p_end_odometer > v_next_start then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','next_odometer','message','Km sosire este mai mare decat km plecare al cursei urmatoare.','reference',v_next_start));
  end if;

  if v_trip.origin is distinct from nullif(trim(p_origin),'') then v_changed:=array_append(v_changed,'origin'); end if;
  if v_trip.destination is distinct from nullif(trim(p_destination),'') then v_changed:=array_append(v_changed,'destination'); end if;
  if v_trip.purpose is distinct from trim(p_purpose) then v_changed:=array_append(v_changed,'purpose'); end if;
  if v_trip.start_at is distinct from p_start_at then v_changed:=array_append(v_changed,'start_at'); end if;
  if v_trip.end_at is distinct from p_end_at then v_changed:=array_append(v_changed,'end_at'); end if;
  if v_trip.start_odometer is distinct from p_start_odometer then v_changed:=array_append(v_changed,'start_odometer'); end if;
  if v_trip.end_odometer is distinct from p_end_odometer then v_changed:=array_append(v_changed,'end_odometer'); end if;
  if v_trip.notes is distinct from nullif(trim(p_notes),'') then v_changed:=array_append(v_changed,'notes'); end if;
  if v_trip.project_id is distinct from p_project_id then v_changed:=array_append(v_changed,'project_id'); end if;
  if p_fuel_mode <> 'keep' then v_changed:=array_append(v_changed,'fuel'); end if;

  update public.fleet_trips
     set origin = nullif(trim(p_origin),''),
         destination = nullif(trim(p_destination),''),
         purpose = trim(p_purpose),
         start_at = p_start_at,
         end_at = p_end_at,
         start_odometer = p_start_odometer,
         end_odometer = p_end_odometer,
         distance_km = round((p_end_odometer-p_start_odometer)::numeric,1),
         notes = nullif(trim(p_notes),''),
         project_id = p_project_id,
         updated_at = clock_timestamp()
   where id = v_trip.id;

  if p_fuel_mode = 'remove' then
    delete from public.fleet_fuel_entries where trip_id=v_trip.id;
  elsif p_fuel_mode = 'set' then
    select id into v_fuel_id from public.fleet_fuel_entries where trip_id=v_trip.id limit 1 for update;
    if v_fuel_id is null then
      insert into public.fleet_fuel_entries(vehicle_id,driver_id,trip_id,fueled_at,liters,total_amount,odometer,station,notes)
      values(v_trip.vehicle_id,v_trip.driver_id,v_trip.id,p_end_at,round(p_fuel_liters,2),round(p_fuel_amount,2),p_end_odometer,nullif(trim(p_fuel_station),''),'Corectata de Owner/Admin din raportul cursei')
      returning id into v_fuel_id;
    else
      update public.fleet_fuel_entries
         set fueled_at=p_end_at,
             liters=round(p_fuel_liters,2),
             total_amount=round(p_fuel_amount,2),
             odometer=p_end_odometer,
             station=nullif(trim(p_fuel_station),''),
             notes='Corectata de Owner/Admin din raportul cursei'
       where id=v_fuel_id;
    end if;
  end if;

  -- Update current vehicle odometer only when the corrected trip is still the latest safe source.
  select exists(
    select 1 from public.fleet_trips t
    where t.vehicle_id=v_trip.vehicle_id and t.id<>v_trip.id and t.start_at > v_trip.start_at
  ) into v_has_later;
  select current_odometer into v_vehicle_current from public.fleet_vehicles where id=v_trip.vehicle_id for update;
  if not v_has_later and v_old_end is not null and v_vehicle_current = v_old_end then
    update public.fleet_vehicles set current_odometer=p_end_odometer where id=v_trip.vehicle_id;
    v_vehicle_updated := true;
  elsif p_end_odometer is distinct from v_old_end then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','vehicle_odometer_preserved','message','Kilometrajul curent al vehiculului nu a fost rescris deoarece exista activitate ulterioara sau o alta valoare curenta.','reference',v_vehicle_current));
  end if;

  select to_jsonb(t) into v_after_trip from public.fleet_trips t where t.id=v_trip.id;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.fueled_at, f.id), '[]'::jsonb)
    into v_after_fuel from public.fleet_fuel_entries f where f.trip_id=v_trip.id;
  v_report_year := extract(year from (p_start_at at time zone 'Europe/Bucharest'))::integer;
  v_report_month := extract(month from (p_start_at at time zone 'Europe/Bucharest'))::integer;
  select count(*) into v_report_count from public.fleet_reports r
   where r.vehicle_id=v_trip.vehicle_id and r.report_year=v_report_year and r.report_month=v_report_month;

  insert into public.fleet_trip_corrections(
    trip_id,corrected_by,reason,changed_fields,before_data,after_data,report_year,report_month,vehicle_odometer_updated,continuity_warnings
  ) values (
    v_trip.id,p_actor_id,trim(p_reason),v_changed,
    jsonb_build_object('trip',v_before_trip,'fuel',v_before_fuel),
    jsonb_build_object('trip',v_after_trip,'fuel',v_after_fuel),
    v_report_year,v_report_month,v_vehicle_updated,v_warnings
  ) returning id into v_correction_id;

  return jsonb_build_object(
    'success',true,
    'correction_id',v_correction_id,
    'trip_id',v_trip.id,
    'changed_fields',v_changed,
    'distance_km',round((p_end_odometer-p_start_odometer)::numeric,1),
    'vehicle_odometer_updated',v_vehicle_updated,
    'continuity_warnings',v_warnings,
    'report_year',v_report_year,
    'report_month',v_report_month,
    'existing_reports',v_report_count,
    'report_needs_regeneration',(v_report_count>0)
  );
end;
$$;

revoke all on function public.correct_fleet_trip_service(uuid,uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,text,uuid,text,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.correct_fleet_trip_service(uuid,uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,text,uuid,text,numeric,numeric,text) to service_role;
