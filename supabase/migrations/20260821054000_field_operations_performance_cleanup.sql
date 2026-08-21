-- Field Operations performance cleanup after Supabase advisor review.
-- Preserve the historical employee_time_entries_employee_idx and remove only our duplicate.
drop index if exists public.employee_time_entries_employee_date_idx;
create index if not exists employee_time_entries_updated_by_idx
  on public.employee_time_entries(updated_by);
