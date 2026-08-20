-- =========================================================
-- BCB GROUP — WEB PUSH FOR ACTIVE FLEET TRIPS
-- Persistent PWA notifications while a trip remains active
-- =========================================================

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_active_idx
  on public.web_push_subscriptions(user_id, is_active);

alter table public.web_push_subscriptions enable row level security;
revoke all on public.web_push_subscriptions from anon;
grant select, insert, update, delete on public.web_push_subscriptions to authenticated;

create or replace function public.web_push_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.web_push_touch_updated_at() from public, anon, authenticated;

drop trigger if exists web_push_subscriptions_touch on public.web_push_subscriptions;
create trigger web_push_subscriptions_touch
before update on public.web_push_subscriptions
for each row execute function public.web_push_touch_updated_at();

drop policy if exists "web push own read" on public.web_push_subscriptions;
create policy "web push own read"
on public.web_push_subscriptions for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "web push own insert" on public.web_push_subscriptions;
create policy "web push own insert"
on public.web_push_subscriptions for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "web push own update" on public.web_push_subscriptions;
create policy "web push own update"
on public.web_push_subscriptions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "web push own delete" on public.web_push_subscriptions;
create policy "web push own delete"
on public.web_push_subscriptions for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Edge Functions obtain the VAPID private key only through service_role.
create or replace function public.get_bcb_web_push_vapid_private_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'bcb_web_push_vapid_private'
  limit 1;
$$;

revoke all on function public.get_bcb_web_push_vapid_private_key() from public, anon, authenticated;
grant execute on function public.get_bcb_web_push_vapid_private_key() to service_role;
