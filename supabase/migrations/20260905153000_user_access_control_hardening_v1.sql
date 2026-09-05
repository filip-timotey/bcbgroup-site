-- BCB Business Manager · User Access Control hardening v1
-- Keep exposed RPCs SECURITY INVOKER and let RLS enforce Owner-only mutations.

grant insert, update, delete on public.user_capability_overrides to authenticated;

drop policy if exists user_capability_overrides_owner_insert on public.user_capability_overrides;
create policy user_capability_overrides_owner_insert on public.user_capability_overrides
for insert to authenticated
with check (public.is_bcb_owner());

drop policy if exists user_capability_overrides_owner_update on public.user_capability_overrides;
create policy user_capability_overrides_owner_update on public.user_capability_overrides
for update to authenticated
using (public.is_bcb_owner())
with check (public.is_bcb_owner());

drop policy if exists user_capability_overrides_owner_delete on public.user_capability_overrides;
create policy user_capability_overrides_owner_delete on public.user_capability_overrides
for delete to authenticated
using (public.is_bcb_owner());

alter function public.get_effective_user_capabilities(uuid) security invoker;
alter function public.owner_set_user_capability(uuid,text,boolean,boolean) security invoker;
alter function public.owner_apply_user_access_template(uuid,text) security invoker;
