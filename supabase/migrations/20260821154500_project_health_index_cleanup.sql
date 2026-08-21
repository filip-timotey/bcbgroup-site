-- The unique(project_id, snapshot_date) index already supports project history lookups.
drop index if exists public.project_health_snapshots_project_date_idx;
-- generated_by is audit metadata and is not part of the read path.
drop index if exists public.project_health_snapshots_generated_by_idx;
