-- =========================================================
-- BCB GROUP — EMPLOYEES + PROFILE AVATARS
-- Admin/Owner HR module, owner-only compensation, self-service avatars
-- =========================================================

alter table public.profiles
  add column if not exists avatar_path text;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  employee_code text unique,
  full_name text not null,
  work_email text,
  personal_email text,
  phone text,
  job_title text,
  department text,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','contractor','intern','temporary','other')),
  employment_status text not null default 'active'
    check (employment_status in ('active','on_leave','suspended','inactive','terminated')),
  hire_date date,
  contract_start date,
  contract_end date,
  work_location text,
  work_schedule text,
  manager_id uuid references public.employees(id) on delete set null,
  birth_date date,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  medical_notes text,
  admin_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_status_idx on public.employees(employment_status, department);
create index if not exists employees_profile_idx on public.employees(profile_id);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  document_type text not null default 'other',
  title text not null,
  document_number text,
  issued_at date,
  expires_at date,
  file_path text,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists employee_documents_employee_idx on public.employee_documents(employee_id, expires_at);

create table if not exists public.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  salary_net numeric(12,2),
  salary_gross numeric(12,2),
  meal_benefit numeric(12,2),
  currency text not null default 'RON',
  iban text,
  bank_name text,
  effective_from date,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (salary_net is null or salary_net >= 0),
  check (salary_gross is null or salary_gross >= 0),
  check (meal_benefit is null or meal_benefit >= 0)
);

create or replace function public.is_bcb_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.is_owner = true
  );
$$;
revoke all on function public.is_bcb_owner() from public, anon;
grant execute on function public.is_bcb_owner() to authenticated;

create or replace function public.employees_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end; $$;

drop trigger if exists employees_touch on public.employees;
create trigger employees_touch before update on public.employees
for each row execute function public.employees_touch_updated_at();

create or replace function public.employee_compensation_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end; $$;

drop trigger if exists employee_compensation_touch on public.employee_compensation;
create trigger employee_compensation_touch before update on public.employee_compensation
for each row execute function public.employee_compensation_touch();

alter table public.employees enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_compensation enable row level security;

drop policy if exists "bcb admins view employees" on public.employees;
create policy "bcb admins view employees" on public.employees for select to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());
drop policy if exists "bcb admins manage employees" on public.employees;
create policy "bcb admins manage employees" on public.employees for all to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner())
with check (public.is_bcb_admin() or public.is_bcb_owner());

drop policy if exists "bcb admins view employee documents" on public.employee_documents;
create policy "bcb admins view employee documents" on public.employee_documents for select to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner());
drop policy if exists "bcb admins manage employee documents" on public.employee_documents;
create policy "bcb admins manage employee documents" on public.employee_documents for all to authenticated
using (public.is_bcb_admin() or public.is_bcb_owner())
with check (public.is_bcb_admin() or public.is_bcb_owner());

drop policy if exists "owner view compensation" on public.employee_compensation;
create policy "owner view compensation" on public.employee_compensation for select to authenticated
using (public.is_bcb_owner());
drop policy if exists "owner manage compensation" on public.employee_compensation;
create policy "owner manage compensation" on public.employee_compensation for all to authenticated
using (public.is_bcb_owner()) with check (public.is_bcb_owner());

-- IMPORTANT: do not grant direct UPDATE on profiles to editors merely for avatars.
-- This security-definer RPC updates only avatar_path for the authenticated user.
drop policy if exists "staff update own avatar" on public.profiles;
create or replace function public.set_own_avatar(p_avatar_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Autentificare necesară.'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active=true) then
    raise exception 'Cont inactiv sau inexistent.';
  end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Cale avatar invalidă.';
  end if;
  update public.profiles set avatar_path = p_avatar_path where id = auth.uid();
end; $$;
revoke all on function public.set_own_avatar(text) from public, anon;
grant execute on function public.set_own_avatar(text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "staff read profile avatars" on storage.objects;
create policy "staff read profile avatars" on storage.objects for select to authenticated
using (bucket_id='profile-avatars' and public.is_bcb_staff());
drop policy if exists "staff upload own avatar" on storage.objects;
create policy "staff upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.is_bcb_staff());
drop policy if exists "staff update own avatar" on storage.objects;
create policy "staff update own avatar" on storage.objects for update to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "staff delete own avatar" on storage.objects;
create policy "staff delete own avatar" on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('employee-documents','employee-documents',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "admins read employee documents storage" on storage.objects;
create policy "admins read employee documents storage" on storage.objects for select to authenticated
using (bucket_id='employee-documents' and (public.is_bcb_admin() or public.is_bcb_owner()));
drop policy if exists "admins manage employee documents storage" on storage.objects;
create policy "admins manage employee documents storage" on storage.objects for all to authenticated
using (bucket_id='employee-documents' and (public.is_bcb_admin() or public.is_bcb_owner()))
with check (bucket_id='employee-documents' and (public.is_bcb_admin() or public.is_bcb_owner()));
