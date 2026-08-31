create table if not exists public.role_capabilities (
  role text not null,
  capability text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(role, capability),
  constraint role_capabilities_role_check check (role in ('admin','editor'))
);
alter table public.role_capabilities enable row level security;
revoke all on public.role_capabilities from anon, authenticated;
grant select on public.role_capabilities to authenticated;
drop policy if exists "staff can read role capabilities" on public.role_capabilities;
create policy "staff can read role capabilities" on public.role_capabilities for select to authenticated using (public.is_bcb_staff());
insert into public.role_capabilities(role,capability,enabled) values
('admin','users.manage',true),('admin','employees.manage',true),('admin','fleet.correct',true),('admin','site.manage',true),('admin','data.manage',true),
('editor','projects.work',true),('editor','time.work',true),('editor','crm.work',true),('editor','fleet.work',true),('editor','media.work',true)
on conflict(role,capability) do nothing;
create or replace function public.bcb_has_capability(p_capability text) returns boolean language sql stable security invoker set search_path=public,pg_temp as $$ select case when public.is_bcb_owner() then true when public.is_bcb_admin() then coalesce((select enabled from public.role_capabilities where role='admin' and capability=p_capability),false) when public.is_bcb_staff() then coalesce((select enabled from public.role_capabilities where role='editor' and capability=p_capability),false) else false end; $$;
revoke all on function public.bcb_has_capability(text) from public, anon; grant execute on function public.bcb_has_capability(text) to authenticated;
create or replace function public.owner_set_role_capability(p_role text,p_capability text,p_enabled boolean) returns void language plpgsql security invoker set search_path=public,pg_temp as $$ begin if not public.is_bcb_owner() then raise exception 'Owner access required'; end if; if p_role not in ('admin','editor') or coalesce(trim(p_capability),'')='' then raise exception 'Invalid capability'; end if; insert into public.role_capabilities(role,capability,enabled,updated_at,updated_by) values(p_role,trim(p_capability),p_enabled,now(),auth.uid()) on conflict(role,capability) do update set enabled=excluded.enabled,updated_at=now(),updated_by=auth.uid(); insert into public.activity_log(actor_id,action,entity_type,entity_id,summary,metadata) values(auth.uid(),'capability.updated','role_capability',p_role||':'||trim(p_capability),'Permisiune actualizată',jsonb_build_object('role',p_role,'capability',trim(p_capability),'enabled',p_enabled)); end; $$;
revoke all on function public.owner_set_role_capability(text,text,boolean) from public, anon; grant execute on function public.owner_set_role_capability(text,text,boolean) to authenticated;
create or replace function public.owner_operations_summary() returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$ declare v jsonb; begin if not public.is_bcb_owner() then raise exception 'Owner access required'; end if; select jsonb_build_object('users',jsonb_build_object('active',(select count(*) from public.profiles where is_active=true and coalesce(is_archived,false)=false),'archived',(select count(*) from public.profiles where coalesce(is_archived,false)=true),'pending_access',(select count(*) from public.user_access_requests where status='pending')),'notifications',jsonb_build_object('unread',(select count(*) from public.system_notifications where is_read=false and (user_id=auth.uid() or user_id is null) and audience in ('owner','admin','staff','user'))),'health',(select coalesce(jsonb_build_object('score',score,'status',overall_status,'created_at',created_at),'{}'::jsonb) from public.system_health_snapshots order by created_at desc limit 1),'audit',jsonb_build_object('last_24h',(select count(*) from public.activity_log where created_at>=now()-interval '24 hours'))) into v; return v; end; $$;
revoke all on function public.owner_operations_summary() from public, anon; grant execute on function public.owner_operations_summary() to authenticated;
create index if not exists role_capabilities_updated_by_idx on public.role_capabilities(updated_by);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at desc);
