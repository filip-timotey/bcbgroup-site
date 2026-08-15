-- =========================================================
-- BCB GROUP — OWNER ACCESS GOVERNANCE
-- Owner > Admin > Editor, protected owner account and approval queue
-- =========================================================

alter table public.profiles
  add column if not exists is_owner boolean not null default false;

-- Promote the BCB primary account to Owner while preserving role=admin for
-- compatibility with all existing admin policies/modules.
update public.profiles
set role = 'admin', is_owner = true, is_active = true
where lower(email) = lower('b.filip.timotey@gmail.com');

create unique index if not exists profiles_single_owner_idx
on public.profiles ((is_owner))
where is_owner = true;

create table if not exists public.user_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('deactivate','delete')),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_access_request_not_self check (requester_id <> target_user_id)
);

create index if not exists user_access_requests_status_idx
on public.user_access_requests(status, created_at desc);
create index if not exists user_access_requests_target_idx
on public.user_access_requests(target_user_id, created_at desc);

alter table public.user_access_requests enable row level security;

-- Owner identity helper. SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_bcb_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and is_owner = true and is_active = true
  );
$$;

revoke all on function public.is_bcb_owner() from public, anon;
grant execute on function public.is_bcb_owner() to authenticated;

-- Existing admin helper now explicitly includes Owner.
create or replace function public.is_bcb_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and (role = 'admin' or is_owner = true)
  );
$$;

-- Staff includes every active Owner/Admin/Editor.
create or replace function public.is_bcb_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and (role in ('admin','editor') or is_owner = true)
  );
$$;

-- Owner protection at DB level. Nobody through normal authenticated app writes
-- can turn the owner off, remove owner status or demote the owner.
create or replace function public.protect_bcb_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.is_owner then
    if not public.is_bcb_owner() then
      raise exception 'Contul Owner nu poate fi șters.';
    end if;
    raise exception 'Owner-ul principal nu poate fi șters din aplicație.';
  end if;

  if tg_op = 'UPDATE' and old.is_owner then
    if new.is_owner is distinct from true
       or new.is_active is distinct from true
       or new.role is distinct from 'admin' then
      raise exception 'Contul Owner nu poate fi dezactivat, retrogradat sau deprotejat.';
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_bcb_owner_profile_trigger on public.profiles;
create trigger protect_bcb_owner_profile_trigger
before update or delete on public.profiles
for each row execute function public.protect_bcb_owner_profile();

-- Approval queue permissions.
drop policy if exists "admins create access requests" on public.user_access_requests;
create policy "admins create access requests"
on public.user_access_requests for insert to authenticated
with check (
  public.is_bcb_admin()
  and requester_id = auth.uid()
  and not exists(select 1 from public.profiles p where p.id = target_user_id and p.is_owner)
);

drop policy if exists "admins view own access requests" on public.user_access_requests;
create policy "admins view own access requests"
on public.user_access_requests for select to authenticated
using (public.is_bcb_owner() or requester_id = auth.uid());

drop policy if exists "owner reviews access requests" on public.user_access_requests;
create policy "owner reviews access requests"
on public.user_access_requests for update to authenticated
using (public.is_bcb_owner())
with check (public.is_bcb_owner());

-- Profiles: Owner can see/manage all. Existing admin policies can remain; the
-- trigger above makes the Owner profile immutable from normal app writes.
drop policy if exists "owner can manage profiles" on public.profiles;
create policy "owner can manage profiles"
on public.profiles for all to authenticated
using (public.is_bcb_owner())
with check (public.is_bcb_owner());

-- Prevent duplicate pending request for same action/target/requester.
create unique index if not exists user_access_requests_one_pending_idx
on public.user_access_requests(requester_id,target_user_id,action)
where status = 'pending';
