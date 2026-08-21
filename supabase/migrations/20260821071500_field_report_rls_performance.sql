-- Consolidate permissive policies introduced by Field Daily Reports.

drop policy if exists "field reports own read" on public.field_daily_reports;
drop policy if exists "field reports admin read" on public.field_daily_reports;
create policy "field reports role-aware read"
on public.field_daily_reports for select to authenticated
using (
  created_by = (select auth.uid())
  or public.is_bcb_admin()
  or public.is_bcb_owner()
);

drop policy if exists "field reports own draft update" on public.field_daily_reports;
drop policy if exists "field reports admin update" on public.field_daily_reports;
create policy "field reports role-aware update"
on public.field_daily_reports for update to authenticated
using (
  (created_by = (select auth.uid()) and status = 'draft')
  or public.is_bcb_admin()
  or public.is_bcb_owner()
)
with check (
  (created_by = (select auth.uid()) and status = 'draft')
  or public.is_bcb_admin()
  or public.is_bcb_owner()
);

drop policy if exists "field suggestions reporter read" on public.field_report_suggestions;
drop policy if exists "field suggestions admin read" on public.field_report_suggestions;
create policy "field suggestions role-aware read"
on public.field_report_suggestions for select to authenticated
using (
  public.is_bcb_admin()
  or public.is_bcb_owner()
  or exists(
    select 1 from public.field_daily_reports r
    where r.id = report_id and r.created_by = (select auth.uid())
  )
);
