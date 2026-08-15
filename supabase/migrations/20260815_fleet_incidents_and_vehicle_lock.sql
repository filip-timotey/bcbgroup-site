-- =========================================================
-- BCB GROUP — FLEET SAFETY & INCIDENT MANAGEMENT
-- Prevent concurrent trips on one vehicle + incident register
-- =========================================================

-- One physical vehicle can never have two active trips at the same time.
create unique index if not exists fleet_one_active_trip_per_vehicle_idx
on public.fleet_trips(vehicle_id)
where status = 'active';

create table if not exists public.fleet_incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete restrict,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  driver_id uuid references auth.users(id) on delete set null,
  trip_id uuid references public.fleet_trips(id) on delete set null,
  incident_type text not null default 'accident'
    check (incident_type in ('accident','damage','breakdown','theft','vandalism','near_miss','other')),
  severity text not null default 'minor'
    check (severity in ('minor','moderate','major','critical')),
  status text not null default 'reported'
    check (status in ('reported','under_review','insurance','repair','resolved','closed')),
  occurred_at timestamptz not null,
  location_text text not null,
  latitude double precision,
  longitude double precision,
  description text not null,
  damage_description text,
  injuries boolean not null default false,
  third_parties_involved boolean not null default false,
  third_party_details text,
  witnesses text,
  police_notified boolean not null default false,
  police_reference text,
  amicable_report boolean not null default false,
  insurance_notified boolean not null default false,
  insurance_claim_number text,
  vehicle_drivable boolean not null default true,
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  actual_cost numeric(12,2) check (actual_cost is null or actual_cost >= 0),
  admin_notes text,
  resolution_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_incidents_vehicle_date_idx
on public.fleet_incidents(vehicle_id, occurred_at desc);
create index if not exists fleet_incidents_status_idx
on public.fleet_incidents(status, occurred_at desc);
create index if not exists fleet_incidents_reporter_idx
on public.fleet_incidents(reporter_id, occurred_at desc);

create table if not exists public.fleet_incident_files (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.fleet_incidents(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  category text not null default 'photo'
    check (category in ('photo','document','police','insurance','repair','other')),
  created_at timestamptz not null default now()
);
create index if not exists fleet_incident_files_incident_idx
on public.fleet_incident_files(incident_id, created_at);

-- Reuse Fleet updated_at helper.
drop trigger if exists fleet_incidents_touch on public.fleet_incidents;
create trigger fleet_incidents_touch
before update on public.fleet_incidents
for each row execute function public.fleet_touch_updated_at();

alter table public.fleet_incidents enable row level security;
alter table public.fleet_incident_files enable row level security;

-- Editors see their own reports. Admins see everything.
drop policy if exists "fleet staff view own incidents" on public.fleet_incidents;
create policy "fleet staff view own incidents"
on public.fleet_incidents for select to authenticated
using (public.is_bcb_admin() or reporter_id = auth.uid() or driver_id = auth.uid());

drop policy if exists "fleet staff report incidents" on public.fleet_incidents;
create policy "fleet staff report incidents"
on public.fleet_incidents for insert to authenticated
with check (public.is_bcb_staff() and reporter_id = auth.uid());

drop policy if exists "fleet admin manage incidents" on public.fleet_incidents;
create policy "fleet admin manage incidents"
on public.fleet_incidents for update to authenticated
using (public.is_bcb_admin()) with check (public.is_bcb_admin());

drop policy if exists "fleet admin delete incidents" on public.fleet_incidents;
create policy "fleet admin delete incidents"
on public.fleet_incidents for delete to authenticated
using (public.is_bcb_admin());

-- Incident file rows: reporter/driver can view, uploader can insert, admin can manage.
drop policy if exists "fleet staff view incident files" on public.fleet_incident_files;
create policy "fleet staff view incident files"
on public.fleet_incident_files for select to authenticated
using (
  public.is_bcb_admin()
  or exists (
    select 1 from public.fleet_incidents i
    where i.id = incident_id and (i.reporter_id = auth.uid() or i.driver_id = auth.uid())
  )
);

drop policy if exists "fleet staff add incident files" on public.fleet_incident_files;
create policy "fleet staff add incident files"
on public.fleet_incident_files for insert to authenticated
with check (
  public.is_bcb_staff()
  and uploaded_by = auth.uid()
  and exists (
    select 1 from public.fleet_incidents i
    where i.id = incident_id and (i.reporter_id = auth.uid() or public.is_bcb_admin())
  )
);

drop policy if exists "fleet admin delete incident files" on public.fleet_incident_files;
create policy "fleet admin delete incident files"
on public.fleet_incident_files for delete to authenticated
using (public.is_bcb_admin());

-- Private evidence storage.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'fleet-incidents','fleet-incidents',false,52428800,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fleet staff read incident storage" on storage.objects;
create policy "fleet staff read incident storage"
on storage.objects for select to authenticated
using (bucket_id = 'fleet-incidents' and public.is_bcb_staff());

drop policy if exists "fleet staff upload incident storage" on storage.objects;
create policy "fleet staff upload incident storage"
on storage.objects for insert to authenticated
with check (bucket_id = 'fleet-incidents' and public.is_bcb_staff());

drop policy if exists "fleet admin manage incident storage" on storage.objects;
create policy "fleet admin manage incident storage"
on storage.objects for all to authenticated
using (bucket_id = 'fleet-incidents' and public.is_bcb_admin())
with check (bucket_id = 'fleet-incidents' and public.is_bcb_admin());
