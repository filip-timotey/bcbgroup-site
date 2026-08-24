-- BCB Fleet: safe odometer-chain reconciliation after Owner/Admin trip correction.
-- Additive. Existing trip correction RPC remains untouched; this wrapper adds controlled propagation.

create table if not exists public.fleet_odometer_reconciliations (
  id uuid primary key default gen_random_uuid(),
  root_trip_id uuid not null references public.fleet_trips(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  reconciled_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  root_rank integer not null,
  old_root_end_odometer numeric,
  new_root_end_odometer numeric,
  vehicle_odometer_before numeric,
  vehicle_odometer_after numeric,
  changes jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists fleet_odometer_reconciliations_root_idx
  on public.fleet_odometer_reconciliations(root_trip_id, created_at desc);
create index if not exists fleet_odometer_reconciliations_vehicle_idx
  on public.fleet_odometer_reconciliations(vehicle_id, created_at desc);

alter table public.fleet_odometer_reconciliations enable row level security;
drop policy if exists "fleet odometer reconciliations privileged read" on public.fleet_odometer_reconciliations;
create policy "fleet odometer reconciliations privileged read"
on public.fleet_odometer_reconciliations for select to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());
revoke insert, update, delete on public.fleet_odometer_reconciliations from anon, authenticated;

create or replace function public.correct_fleet_trip_with_reconciliation_service(
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
  v_root public.fleet_trips%rowtype;
  v_result jsonb;
  v_old_end numeric;
  v_vehicle_before numeric;
  v_vehicle_after numeric;
  v_rank integer;
  v_changes jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_next public.fleet_trips%rowtype;
  v_next_before jsonb;
  v_reconciled boolean := false;
  v_reconciliation_id uuid;
  v_canonical numeric;
begin
  select * into v_root from public.fleet_trips where id=p_trip_id for update;
  if not found then raise exception 'Cursa nu exista.'; end if;
  v_old_end := v_root.end_odometer;
  select current_odometer into v_vehicle_before from public.fleet_vehicles where id=v_root.vehicle_id for update;

  select 1 + count(*) into v_rank
  from public.fleet_trips t
  where t.vehicle_id=v_root.vehicle_id and t.start_at > v_root.start_at;

  v_result := public.correct_fleet_trip_service(
    p_trip_id=>p_trip_id,p_actor_id=>p_actor_id,p_reason=>p_reason,
    p_origin=>p_origin,p_destination=>p_destination,p_purpose=>p_purpose,
    p_start_at=>p_start_at,p_end_at=>p_end_at,
    p_start_odometer=>p_start_odometer,p_end_odometer=>p_end_odometer,
    p_notes=>p_notes,p_project_id=>p_project_id,p_fuel_mode=>p_fuel_mode,
    p_fuel_liters=>p_fuel_liters,p_fuel_amount=>p_fuel_amount,p_fuel_station=>p_fuel_station
  );

  -- Automatic propagation is intentionally limited to the five most recent trips.
  if v_rank <= 5 and v_old_end is distinct from p_end_odometer then
    select * into v_next
    from public.fleet_trips t
    where t.vehicle_id=v_root.vehicle_id and t.id<>p_trip_id and t.start_at > p_start_at
    order by t.start_at asc
    limit 1
    for update;

    if found then
      v_next_before := to_jsonb(v_next);

      if v_next.status='active' then
        -- The active trip has no authoritative final odometer yet. Its start must
        -- follow the corrected previous trip, even when a stale vehicle odometer
        -- caused the active trip to start from the wrong value.
        update public.fleet_trips
           set start_odometer=p_end_odometer,
               updated_at=clock_timestamp()
         where id=v_next.id;
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'trip_id',v_next.id,'status','active','action','rebase_active_start',
          'before_start_odometer',v_next.start_odometer,'after_start_odometer',p_end_odometer
        ));
        v_reconciled := true;

      elsif v_next.status='completed' and abs(coalesce(v_next.start_odometer,0)-coalesce(v_old_end,0)) <= 0.1 then
        -- A completed trip is altered only when we can prove it inherited the old
        -- root end exactly. Its final odometer remains authoritative; only start
        -- and distance are recalculated.
        if v_next.end_odometer is null or v_next.end_odometer < p_end_odometer then
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'code','completed_next_would_be_invalid','trip_id',v_next.id,
            'message','Urmatoarea cursa finalizata ar avea km final mai mic decat noul km de plecare; propagarea s-a oprit.'
          ));
        elsif v_next.end_odometer-p_end_odometer > 3000 then
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'code','completed_next_distance_guard','trip_id',v_next.id,
            'message','Recalcularea urmatoarei curse ar depasi 3000 km; propagarea s-a oprit.'
          ));
        else
          update public.fleet_trips
             set start_odometer=p_end_odometer,
                 distance_km=round((v_next.end_odometer-p_end_odometer)::numeric,1),
                 updated_at=clock_timestamp()
           where id=v_next.id;
          v_changes := v_changes || jsonb_build_array(jsonb_build_object(
            'trip_id',v_next.id,'status','completed','action','rebase_completed_start',
            'before_start_odometer',v_next.start_odometer,'after_start_odometer',p_end_odometer,
            'end_odometer_preserved',v_next.end_odometer,
            'distance_after',round((v_next.end_odometer-p_end_odometer)::numeric,1)
          ));
          v_reconciled := true;
        end if;
      elsif v_next.status='completed' then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','next_completed_not_inherited','trip_id',v_next.id,
          'message','Urmatoarea cursa finalizata nu a mostenit exact vechiul kilometraj; nu a fost modificata automat.',
          'next_start',v_next.start_odometer,'old_root_end',v_old_end
        ));
      end if;
    end if;

    -- Rebuild the vehicle odometer from the newest valid trip state. If the newest
    -- trip is active, its corrected start is the latest confirmed odometer; otherwise
    -- the latest completed end is authoritative.
    select case when t.status='active' then t.start_odometer else t.end_odometer end
      into v_canonical
    from public.fleet_trips t
    where t.vehicle_id=v_root.vehicle_id
    order by t.start_at desc
    limit 1;

    if v_canonical is not null then
      update public.fleet_vehicles set current_odometer=v_canonical where id=v_root.vehicle_id;
    end if;
  elsif v_rank > 5 and v_old_end is distinct from p_end_odometer then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','outside_recent_five','message','Cursa nu este in ultimele 5 ale vehiculului; kilometrajul curent nu a fost propagat automat.','rank',v_rank
    ));
  end if;

  select current_odometer into v_vehicle_after from public.fleet_vehicles where id=v_root.vehicle_id;

  if v_old_end is distinct from p_end_odometer then
    insert into public.fleet_odometer_reconciliations(
      root_trip_id,vehicle_id,reconciled_by,reason,root_rank,
      old_root_end_odometer,new_root_end_odometer,
      vehicle_odometer_before,vehicle_odometer_after,changes,warnings
    ) values (
      p_trip_id,v_root.vehicle_id,p_actor_id,trim(p_reason),v_rank,
      v_old_end,p_end_odometer,v_vehicle_before,v_vehicle_after,v_changes,v_warnings
    ) returning id into v_reconciliation_id;
  end if;

  return v_result || jsonb_build_object(
    'odometer_reconciliation',jsonb_build_object(
      'eligible',(v_rank<=5),
      'root_rank',v_rank,
      'applied',v_reconciled,
      'reconciliation_id',v_reconciliation_id,
      'vehicle_odometer_before',v_vehicle_before,
      'vehicle_odometer_after',v_vehicle_after,
      'changes',v_changes,
      'warnings',v_warnings
    )
  );
end;
$$;

revoke all on function public.correct_fleet_trip_with_reconciliation_service(uuid,uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,text,uuid,text,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.correct_fleet_trip_with_reconciliation_service(uuid,uuid,text,text,text,text,timestamptz,timestamptz,numeric,numeric,text,uuid,text,numeric,numeric,text) to service_role;
