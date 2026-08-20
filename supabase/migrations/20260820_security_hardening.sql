-- BCB Group — Supabase security hardening

alter function public.fleet_touch_updated_at() set search_path = public;
alter function public.employees_touch_updated_at() set search_path = public;
alter function public.employee_compensation_touch() set search_path = public;

-- Trigger functions do not need to be directly callable through the Data API.
revoke execute on function public.enforce_bcb_account_removal_governance() from public, anon, authenticated;
revoke execute on function public.fleet_finish_trip() from public, anon, authenticated;
revoke execute on function public.fleet_start_trip_odometer() from public, anon, authenticated;
revoke execute on function public.protect_bcb_owner_profile() from public, anon, authenticated;
revoke execute on function public.protect_last_bcb_admin() from public, anon, authenticated;

-- Fleet availability is staff-only; anonymous callers should not reach the RPC endpoint.
revoke execute on function public.fleet_vehicle_availability() from public, anon;
grant execute on function public.fleet_vehicle_availability() to authenticated, service_role;

-- Explicitly keep helper RPCs scoped to signed-in users / backend only.
revoke execute on function public.is_bcb_admin() from public, anon;
revoke execute on function public.is_bcb_owner() from public, anon;
revoke execute on function public.is_bcb_staff() from public, anon;
revoke execute on function public.get_hr_alerts(integer) from public, anon;
revoke execute on function public.set_own_avatar(text) from public, anon;

grant execute on function public.is_bcb_admin() to authenticated, service_role;
grant execute on function public.is_bcb_owner() to authenticated, service_role;
grant execute on function public.is_bcb_staff() to authenticated, service_role;
grant execute on function public.get_hr_alerts(integer) to authenticated, service_role;
grant execute on function public.set_own_avatar(text) to authenticated, service_role;
