-- =========================================================
-- BCB GROUP — FLEET MANAGEMENT
-- Vehicles, trips, fuel, documents, reports and permissions
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  make text not null,
  model text not null,
  vin text,
  year integer,
  fuel_type text not null default 'diesel' check (fuel_type in ('diesel','benzina','gpl','hibrid','electric','altul')),
  current_odometer numeric(12,1) not null default 0 check (current_odometer >= 0),
  color text,
  owner_name text,
  internal_code text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_vehicle_drivers (
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);

create table if not exists public.fleet_trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete restrict,
  driver_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  origin text,
  destination text,
  purpose text not null,
  start_odometer numeric(12,1) not null check (start_odometer >= 0),
  end_odometer numeric(12,1) check (end_odometer is null or end_odometer >= 0),
  distance_km numeric(12,1),
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  gps_distance_km numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_trip_odometer_order check (end_odometer is null or end_odometer >= start_odometer)
);

create unique index if not exists fleet_one_active_trip_per_driver_idx
on public.fleet_trips(driver_id)
where status = 'active';

create index if not exists fleet_trips_vehicle_date_idx on public.fleet_trips(vehicle_id, start_at desc);
create index if not exists fleet_trips_driver_date_idx on public.fleet_trips(driver_id, start_at desc);
create index if not exists fleet_trips_status_idx on public.fleet_trips(status, start_at desc);

create table if not exists public.fleet_fuel_entries (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete restrict,
  driver_id uuid references auth.users(id) on delete set null,
  trip_id uuid references public.fleet_trips(id) on delete set null,
  fueled_at timestamptz not null default now(),
  liters numeric(10,2) not null check (liters > 0),
  total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  odometer numeric(12,1) check (odometer is null or odometer >= 0),
  station text,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fleet_fuel_vehicle_date_idx on public.fleet_fuel_entries(vehicle_id, fueled_at desc);

create table if not exists public.fleet_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('rca','itp','rovinieta','casco','talon','service','leasing','other')),
  document_number text,
  issued_at date,
  expires_at date,
  reminder_days integer not null default 30 check (reminder_days between 0 and 365),
  file_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_documents_expiry_idx on public.fleet_documents(expires_at);

create table if not exists public.fleet_reports (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  report_year integer not null,
  report_month integer not null check (report_month between 1 and 12),
  report_number text not null,
  driver_id uuid references auth.users(id) on delete set null,
  total_trips integer not null default 0,
  total_km numeric(12,1) not null default 0,
  total_fuel_liters numeric(12,2) not null default 0,
  pdf_path text,
  xlsx_path text,
  generated_at timestamptz,
  emailed_at timestamptz,
  generated_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','generated','emailed','error')),
  error_message text,
  created_at timestamptz not null default now(),
  unique(vehicle_id, report_year, report_month, driver_id)
);

create index if not exists fleet_reports_period_idx on public.fleet_reports(report_year desc, report_month desc);

create table if not exists public.fleet_settings (
  id boolean primary key default true check (id = true),
  report_email text,
  report_cc text,
  report_day integer not null default 1 check (report_day between 1 and 28),
  auto_generate boolean not null default true,
  auto_email boolean not null default true,
  company_header_name text not null default 'BCB Group',
  company_legal_name text not null default 'BCB Construct Pro S.R.L.',
  company_cui text not null default 'RO54634520',
  company_register text not null default 'J2026030027006',
  company_address text not null default 'Jud. Bihor, Sat Roșia, Com. Roșia',
  company_phone text not null default '0770 712 701',
  company_email text not null default 'office@bcbgroup.ro',
  approved_by text,
  updated_at timestamptz not null default now()
);

insert into public.fleet_settings(id) values(true) on conflict(id) do nothing;

-- Storage buckets
insert into storage.buckets (id,name,public,file_size_limit)
values ('fleet-documents','fleet-documents',false,26214400)
on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit)
values ('fleet-reports','fleet-reports',false,26214400)
on conflict (id) do nothing;

-- Helpers
create or replace function public.fleet_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists fleet_vehicles_touch on public.fleet_vehicles;
create trigger fleet_vehicles_touch before update on public.fleet_vehicles for each row execute function public.fleet_touch_updated_at();
drop trigger if exists fleet_trips_touch on public.fleet_trips;
create trigger fleet_trips_touch before update on public.fleet_trips for each row execute function public.fleet_touch_updated_at();
drop trigger if exists fleet_documents_touch on public.fleet_documents;
create trigger fleet_documents_touch before update on public.fleet_documents for each row execute function public.fleet_touch_updated_at();

create or replace function public.fleet_finish_trip()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'completed' and old.status = 'active' then
    if new.end_at is null then new.end_at = now(); end if;
    if new.end_odometer is null then raise exception 'Kilometrajul final este obligatoriu.'; end if;
    new.distance_km = round((new.end_odometer - new.start_odometer)::numeric,1);
    update public.fleet_vehicles
      set current_odometer = greatest(current_odometer,new.end_odometer)
      where id = new.vehicle_id;
  end if;
  return new;
end; $$;

drop trigger if exists fleet_trip_finish on public.fleet_trips;
create trigger fleet_trip_finish before update on public.fleet_trips for each row execute function public.fleet_finish_trip();

-- RLS
alter table public.fleet_vehicles enable row level security;
alter table public.fleet_vehicle_drivers enable row level security;
alter table public.fleet_trips enable row level security;
alter table public.fleet_fuel_entries enable row level security;
alter table public.fleet_documents enable row level security;
alter table public.fleet_reports enable row level security;
alter table public.fleet_settings enable row level security;

-- Vehicles: staff can view, admin can manage
drop policy if exists "fleet staff view vehicles" on public.fleet_vehicles;
create policy "fleet staff view vehicles" on public.fleet_vehicles for select to authenticated using (public.is_bcb_staff());
drop policy if exists "fleet admin manage vehicles" on public.fleet_vehicles;
create policy "fleet admin manage vehicles" on public.fleet_vehicles for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

-- Assignments
drop policy if exists "fleet staff view assignments" on public.fleet_vehicle_drivers;
create policy "fleet staff view assignments" on public.fleet_vehicle_drivers for select to authenticated using (public.is_bcb_staff());
drop policy if exists "fleet admin manage assignments" on public.fleet_vehicle_drivers;
create policy "fleet admin manage assignments" on public.fleet_vehicle_drivers for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

-- Trips: editors own; admins all
drop policy if exists "fleet staff view trips" on public.fleet_trips;
create policy "fleet staff view trips" on public.fleet_trips for select to authenticated using (public.is_bcb_admin() or driver_id = auth.uid());
drop policy if exists "fleet staff start own trips" on public.fleet_trips;
create policy "fleet staff start own trips" on public.fleet_trips for insert to authenticated with check (public.is_bcb_staff() and driver_id = auth.uid() and status = 'active');
drop policy if exists "fleet staff update own active trips" on public.fleet_trips;
create policy "fleet staff update own active trips" on public.fleet_trips for update to authenticated using (public.is_bcb_admin() or (driver_id = auth.uid() and status = 'active')) with check (public.is_bcb_admin() or driver_id = auth.uid());
drop policy if exists "fleet admin delete trips" on public.fleet_trips;
create policy "fleet admin delete trips" on public.fleet_trips for delete to authenticated using (public.is_bcb_admin());

-- Fuel
drop policy if exists "fleet staff view fuel" on public.fleet_fuel_entries;
create policy "fleet staff view fuel" on public.fleet_fuel_entries for select to authenticated using (public.is_bcb_admin() or driver_id = auth.uid());
drop policy if exists "fleet staff add fuel" on public.fleet_fuel_entries;
create policy "fleet staff add fuel" on public.fleet_fuel_entries for insert to authenticated with check (public.is_bcb_staff() and (driver_id = auth.uid() or driver_id is null));
drop policy if exists "fleet admin manage fuel" on public.fleet_fuel_entries;
create policy "fleet admin manage fuel" on public.fleet_fuel_entries for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

-- Documents/reports/settings admin management; staff reports can view own driver reports
drop policy if exists "fleet staff view documents" on public.fleet_documents;
create policy "fleet staff view documents" on public.fleet_documents for select to authenticated using (public.is_bcb_staff());
drop policy if exists "fleet admin manage documents" on public.fleet_documents;
create policy "fleet admin manage documents" on public.fleet_documents for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

drop policy if exists "fleet staff view reports" on public.fleet_reports;
create policy "fleet staff view reports" on public.fleet_reports for select to authenticated using (public.is_bcb_admin() or driver_id = auth.uid());
drop policy if exists "fleet admin manage reports" on public.fleet_reports;
create policy "fleet admin manage reports" on public.fleet_reports for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

drop policy if exists "fleet staff view settings" on public.fleet_settings;
create policy "fleet staff view settings" on public.fleet_settings for select to authenticated using (public.is_bcb_staff());
drop policy if exists "fleet admin manage settings" on public.fleet_settings;
create policy "fleet admin manage settings" on public.fleet_settings for all to authenticated using (public.is_bcb_admin()) with check (public.is_bcb_admin());

-- Private storage policies
drop policy if exists "fleet staff read fleet documents" on storage.objects;
create policy "fleet staff read fleet documents" on storage.objects for select to authenticated using (bucket_id in ('fleet-documents','fleet-reports') and public.is_bcb_staff());
drop policy if exists "fleet admin manage fleet storage" on storage.objects;
create policy "fleet admin manage fleet storage" on storage.objects for all to authenticated using (bucket_id in ('fleet-documents','fleet-reports') and public.is_bcb_admin()) with check (bucket_id in ('fleet-documents','fleet-reports') and public.is_bcb_admin());
