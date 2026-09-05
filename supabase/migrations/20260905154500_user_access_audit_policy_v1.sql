-- Allow Owner-only audit inserts from SECURITY INVOKER governance RPCs.
drop policy if exists activity_log_owner_insert on public.activity_log;
create policy activity_log_owner_insert on public.activity_log
for insert to authenticated
with check (public.is_bcb_owner() and actor_id = (select auth.uid()));
