-- BCB Business Manager · Access Sync Fix v1
-- Fix Owner role-capability writes and enable realtime permission synchronization.

-- Role defaults are mutated only through the Owner RPC, which is SECURITY INVOKER.
-- Grant the minimum table privileges and let RLS enforce Owner-only writes.
grant insert, update on public.role_capabilities to authenticated;

drop policy if exists role_capabilities_owner_insert on public.role_capabilities;
create policy role_capabilities_owner_insert on public.role_capabilities
for insert to authenticated
with check (public.is_bcb_owner());

drop policy if exists role_capabilities_owner_update on public.role_capabilities;
create policy role_capabilities_owner_update on public.role_capabilities
for update to authenticated
using (public.is_bcb_owner())
with check (public.is_bcb_owner());

-- Keep all exposed access-management RPCs invoker-safe.
alter function public.owner_set_role_capability(text,text,boolean) security invoker;
alter function public.owner_set_user_capability(uuid,text,boolean,boolean) security invoker;
alter function public.owner_apply_user_access_template(uuid,text) security invoker;
alter function public.get_effective_user_capabilities(uuid) security invoker;

-- Realtime is used only for access state refresh. RLS still filters visible rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='user_capability_overrides'
  ) then
    alter publication supabase_realtime add table public.user_capability_overrides;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='role_capabilities'
  ) then
    alter publication supabase_realtime add table public.role_capabilities;
  end if;
end $$;
