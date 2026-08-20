-- Job Costing performance + compatibility guard
create index if not exists project_cost_entries_approved_by_idx on public.project_cost_entries(approved_by) where approved_by is not null;
create index if not exists project_financials_created_by_idx on public.project_financials(created_by) where created_by is not null;
create index if not exists project_material_requirements_created_by_idx on public.project_material_requirements(created_by);
create index if not exists project_material_requirements_updated_by_idx on public.project_material_requirements(updated_by) where updated_by is not null;

-- One SELECT policy is cheaper and easier to reason about than overlapping permissive policies.
drop policy if exists "finance admins read project costs" on public.project_cost_entries;
drop policy if exists "editors read own draft project costs" on public.project_cost_entries;
create policy "role scoped project cost read" on public.project_cost_entries
for select to authenticated
using (
  public.is_bcb_admin()
  or (public.is_bcb_staff() and created_by=(select auth.uid()) and status='draft')
);

-- Legacy project financial columns stay compatibility-only; Editor cannot mutate them.
create or replace function public.guard_legacy_project_finance()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if (new.budget_estimated is distinct from old.budget_estimated
      or new.contract_value is distinct from old.contract_value
      or new.internal_notes is distinct from old.internal_notes)
     and not public.is_bcb_admin() then
    raise exception 'Câmp financiar sau privat rezervat Owner/Admin.';
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_legacy_project_finance on public.projects;
create trigger trg_guard_legacy_project_finance
before update of budget_estimated,contract_value,internal_notes on public.projects
for each row execute function public.guard_legacy_project_finance();
revoke execute on function public.guard_legacy_project_finance() from public,anon,authenticated;