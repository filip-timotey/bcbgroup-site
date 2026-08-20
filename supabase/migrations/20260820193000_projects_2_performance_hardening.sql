-- Projects 2.0 query-path indexes. Additive only; no Fleet records are modified.
create index if not exists fleet_trips_project_id_idx on public.fleet_trips(project_id) where project_id is not null;
create index if not exists project_tasks_created_by_idx on public.project_tasks(created_by) where created_by is not null;
create index if not exists project_tasks_updated_by_idx on public.project_tasks(updated_by) where updated_by is not null;
create index if not exists project_milestones_created_by_idx on public.project_milestones(created_by) where created_by is not null;
create index if not exists project_milestones_updated_by_idx on public.project_milestones(updated_by) where updated_by is not null;
create index if not exists project_team_members_created_by_idx on public.project_team_members(created_by) where created_by is not null;
create index if not exists projects_created_by_idx on public.projects(created_by) where created_by is not null;
create index if not exists projects_updated_by_idx on public.projects(updated_by) where updated_by is not null;

-- The ALL policy already includes SELECT; keep one permission evaluation path.
drop policy if exists "admins read project team" on public.project_team_members;
