alter table public.project_media
  add column if not exists field_report_id uuid references public.field_daily_reports(id) on delete set null;
create index if not exists project_media_field_report_idx on public.project_media(field_report_id) where field_report_id is not null;
