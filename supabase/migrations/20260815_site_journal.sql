create table if not exists public.site_journal_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  work_date date not null default current_date,
  stage text,
  team_members text,
  hours_worked numeric(5,2) check (hours_worked is null or hours_worked >= 0),
  work_summary text not null,
  issues_notes text,
  materials_needed text,
  weather text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_journal_project_date_idx
on public.site_journal_entries(project_id, work_date desc, created_at desc);

alter table public.site_journal_entries enable row level security;

drop policy if exists "staff can read site journal" on public.site_journal_entries;
create policy "staff can read site journal"
on public.site_journal_entries
for select
to authenticated
using (public.is_bcb_staff());

drop policy if exists "staff can insert site journal" on public.site_journal_entries;
create policy "staff can insert site journal"
on public.site_journal_entries
for insert
to authenticated
with check (public.is_bcb_staff() and created_by = auth.uid());

drop policy if exists "staff can update site journal" on public.site_journal_entries;
create policy "staff can update site journal"
on public.site_journal_entries
for update
to authenticated
using (public.is_bcb_staff())
with check (public.is_bcb_staff());

drop policy if exists "staff can delete site journal" on public.site_journal_entries;
create policy "staff can delete site journal"
on public.site_journal_entries
for delete
to authenticated
using (public.is_bcb_staff());

create or replace function public.site_journal_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_journal_set_updated_at on public.site_journal_entries;
create trigger site_journal_set_updated_at
before update on public.site_journal_entries
for each row execute function public.site_journal_touch_updated_at();

alter table public.project_media
add column if not exists journal_entry_id uuid references public.site_journal_entries(id) on delete set null;

create index if not exists project_media_journal_entry_idx
on public.project_media(journal_entry_id);

drop trigger if exists site_journal_activity_log on public.site_journal_entries;
create trigger site_journal_activity_log
after insert or update or delete on public.site_journal_entries
for each row execute function public.log_bcb_activity();