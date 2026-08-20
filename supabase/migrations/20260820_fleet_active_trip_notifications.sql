-- =========================================================
-- BCB GROUP — FLEET ACTIVE TRIP NOTIFICATIONS
-- Server-side reminders for long-running active trips
-- =========================================================

alter table public.fleet_settings
  add column if not exists active_trip_alerts_enabled boolean not null default true,
  add column if not exists active_trip_threshold_minutes integer not null default 180,
  add column if not exists active_trip_repeat_minutes integer not null default 120,
  add column if not exists active_trip_notify_driver boolean not null default true,
  add column if not exists active_trip_notify_admin boolean not null default true;

alter table public.fleet_settings
  drop constraint if exists fleet_settings_active_trip_threshold_check,
  add constraint fleet_settings_active_trip_threshold_check
    check (active_trip_threshold_minutes between 30 and 1440),
  drop constraint if exists fleet_settings_active_trip_repeat_check,
  add constraint fleet_settings_active_trip_repeat_check
    check (active_trip_repeat_minutes between 30 and 1440);

create table if not exists public.fleet_trip_alert_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.fleet_trips(id) on delete cascade,
  alert_kind text not null default 'active_trip_reminder',
  sent_at timestamptz not null default now(),
  sent_to text,
  elapsed_minutes integer not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint fleet_trip_alert_kind_check check (alert_kind in ('active_trip_reminder','active_trip_escalation'))
);

create index if not exists fleet_trip_alert_log_trip_sent_idx
  on public.fleet_trip_alert_log(trip_id, sent_at desc);

alter table public.fleet_trip_alert_log enable row level security;

revoke all on public.fleet_trip_alert_log from anon;
grant select on public.fleet_trip_alert_log to authenticated;

-- Only active Owner/Admin users can inspect notification history.
drop policy if exists "fleet_trip_alert_log_admin_select" on public.fleet_trip_alert_log;
create policy "fleet_trip_alert_log_admin_select"
on public.fleet_trip_alert_log
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (p.is_owner = true or p.role = 'admin')
  )
);

-- Server-side function used by the Edge Function. It does not bypass RLS for clients.
create or replace function public.get_active_fleet_trip_alert_candidates()
returns table (
  trip_id uuid,
  vehicle_id uuid,
  driver_id uuid,
  start_at timestamptz,
  origin text,
  destination text,
  purpose text,
  elapsed_minutes integer,
  registration_number text,
  make text,
  model text,
  driver_name text,
  driver_email text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id,
    t.vehicle_id,
    t.driver_id,
    t.start_at,
    t.origin,
    t.destination,
    t.purpose,
    floor(extract(epoch from (now() - t.start_at)) / 60)::integer,
    v.registration_number,
    v.make,
    v.model,
    coalesce(p.full_name, p.email, 'Șofer'),
    p.email
  from public.fleet_trips t
  join public.fleet_vehicles v on v.id = t.vehicle_id
  left join public.profiles p on p.id = t.driver_id
  where t.status = 'active'
    and t.end_at is null;
$$;

revoke all on function public.get_active_fleet_trip_alert_candidates() from public, anon, authenticated;
grant execute on function public.get_active_fleet_trip_alert_candidates() to service_role;

-- Schedule every 15 minutes. Uses the existing secured Vault secret shared by BCB cron jobs.
do $$
begin
  if exists(select 1 from cron.job where jobname='bcb-fleet-active-trip-alerts') then
    perform cron.unschedule('bcb-fleet-active-trip-alerts');
  end if;
end $$;

select cron.schedule(
  'bcb-fleet-active-trip-alerts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://igxkzgsxokdsfgkatkud.supabase.co/functions/v1/send-fleet-active-trip-alerts',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-bcb-cron-secret',(
        select decrypted_secret
        from vault.decrypted_secrets
        where name='fleet_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
