alter table public.profiles add column if not exists is_archived boolean not null default false;
alter table public.profiles add column if not exists archived_at timestamptz;
alter table public.profiles add column if not exists archived_by uuid;
create index if not exists profiles_active_archived_idx on public.profiles (is_archived, is_active);
comment on column public.profiles.is_archived is 'Logical removal flag. Keeps the profile row so operational history remains attributable after access is revoked.';
