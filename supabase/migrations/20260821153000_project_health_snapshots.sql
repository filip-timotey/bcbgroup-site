-- Project Operations Command Center v1
-- Stores deterministic project-health history without overwriting the manual project health_status.

create table if not exists public.project_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_date date not null default (timezone('Europe/Bucharest', now()))::date,
  score integer not null,
  status text not null,
  signals jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_health_snapshots_score_check check (score between 0 and 100),
  constraint project_health_snapshots_status_check check (status in ('healthy','attention','at_risk','blocked')),
  constraint project_health_snapshots_project_day_unique unique(project_id, snapshot_date)
);

create index if not exists project_health_snapshots_project_date_idx
  on public.project_health_snapshots(project_id, snapshot_date desc);
create index if not exists project_health_snapshots_generated_by_idx
  on public.project_health_snapshots(generated_by) where generated_by is not null;

alter table public.project_health_snapshots enable row level security;

drop policy if exists "project health admin read" on public.project_health_snapshots;
create policy "project health admin read" on public.project_health_snapshots
for select to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());

-- Browser clients never write snapshots directly. The authenticated Edge Function writes through service_role.
revoke insert, update, delete on public.project_health_snapshots from anon, authenticated;
