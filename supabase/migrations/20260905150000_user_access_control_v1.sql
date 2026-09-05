-- BCB Business Manager · User Access Control v1
-- Additive, owner-controlled per-user capability overrides.

create table if not exists public.capability_catalog (
  capability text primary key,
  label text not null,
  description text not null default '',
  icon text not null default 'fa-circle',
  href text,
  category text not null default 'workspace',
  sort_order integer not null default 100,
  min_role text not null default 'editor' check (min_role in ('editor','admin')),
  is_navigation boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_capability_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null references public.capability_catalog(capability) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (user_id, capability)
);

create index if not exists user_capability_overrides_capability_idx
  on public.user_capability_overrides(capability);

alter table public.capability_catalog enable row level security;
alter table public.user_capability_overrides enable row level security;

revoke all on public.capability_catalog from anon;
revoke all on public.user_capability_overrides from anon;
revoke insert, update, delete on public.capability_catalog from authenticated;
revoke insert, update, delete on public.user_capability_overrides from authenticated;
grant select on public.capability_catalog to authenticated;
grant select on public.user_capability_overrides to authenticated;

drop policy if exists capability_catalog_staff_read on public.capability_catalog;
create policy capability_catalog_staff_read on public.capability_catalog
for select to authenticated
using (public.is_bcb_staff());

drop policy if exists user_capability_overrides_visible on public.user_capability_overrides;
create policy user_capability_overrides_visible on public.user_capability_overrides
for select to authenticated
using (user_id = (select auth.uid()) or public.is_bcb_owner());

insert into public.capability_catalog(capability,label,description,icon,href,category,sort_order,min_role,is_navigation)
values
 ('projects.work','Proiecte','Acces la proiecte, jurnal și operațiuni de șantier.','fa-building','dashboard.html#projects','workspace',10,'editor',true),
 ('time.work','Pontaj & Teren','Pontaj, prezență, teren și timesheet.','fa-user-clock','time.html','workspace',20,'editor',true),
 ('crm.work','CRM & Oferte','Clienți, pipeline și oferte comerciale.','fa-chart-line','quotes.html','workspace',30,'editor',true),
 ('fleet.work','Fleet','Curse, vehicule, alimentări și foi de parcurs.','fa-car-side','fleet.html','operations',40,'editor',true),
 ('media.work','Media','Biblioteca media și resursele proiectelor.','fa-images','media.html','workspace',50,'editor',true),
 ('activity.view','Activitate','Vizualizare jurnal operațional și activitate.','fa-clock-rotate-left','activity.html','workspace',60,'editor',true),
 ('employees.manage','Angajați','Administrarea dosarelor și operațiunilor HR.','fa-users-gear','employees.html','administration',100,'admin',true),
 ('site.manage','Site Editor','Administrarea conținutului și setărilor site-ului.','fa-pen-ruler','site-editor.html','administration',110,'admin',true),
 ('data.manage','Control date','Instrumente administrative pentru controlul datelor.','fa-database','data-control.html','administration',120,'admin',true),
 ('users.manage','Utilizatori','Administrarea accesului și conturilor.','fa-user-shield','users.html','administration',130,'admin',true),
 ('fleet.correct','Corecții Fleet','Corecții administrative ale curselor și reconcilierilor Fleet.','fa-screwdriver-wrench',null,'advanced',200,'admin',false)
on conflict (capability) do update set
 label=excluded.label,
 description=excluded.description,
 icon=excluded.icon,
 href=excluded.href,
 category=excluded.category,
 sort_order=excluded.sort_order,
 min_role=excluded.min_role,
 is_navigation=excluded.is_navigation,
 is_active=true,
 updated_at=now();

-- Preserve existing role choices; only fill missing defaults that match current product access.
insert into public.role_capabilities(role,capability,enabled)
values
 ('editor','projects.work',true),('editor','time.work',true),('editor','crm.work',true),
 ('editor','fleet.work',true),('editor','media.work',true),('editor','activity.view',true),
 ('admin','projects.work',true),('admin','time.work',true),('admin','crm.work',true),
 ('admin','fleet.work',true),('admin','media.work',true),('admin','activity.view',true),
 ('admin','employees.manage',true),('admin','site.manage',true),('admin','data.manage',true),
 ('admin','users.manage',true),('admin','fleet.correct',true)
on conflict (role,capability) do nothing;

create or replace function public.get_effective_user_capabilities(p_user_id uuid default auth.uid())
returns table(
  capability text,
  label text,
  description text,
  icon text,
  href text,
  category text,
  sort_order integer,
  min_role text,
  is_navigation boolean,
  enabled boolean,
  source text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_role text;
  v_owner boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_target <> auth.uid() and not public.is_bcb_owner() then raise exception 'Owner access required'; end if;

  select p.role, p.is_owner into v_role, v_owner
  from public.profiles p
  where p.id=v_target and p.is_active=true;
  if v_role is null then raise exception 'Active profile not found'; end if;

  return query
  select c.capability,c.label,c.description,c.icon,c.href,c.category,c.sort_order,c.min_role,c.is_navigation,
    case
      when v_owner then true
      when c.min_role='admin' and v_role<>'admin' then false
      else coalesce(u.enabled,r.enabled,false)
    end as enabled,
    case
      when v_owner then 'owner'
      when c.min_role='admin' and v_role<>'admin' then 'role_required'
      when u.user_id is not null then 'user'
      else 'role'
    end as source
  from public.capability_catalog c
  left join public.role_capabilities r on r.role=v_role and r.capability=c.capability
  left join public.user_capability_overrides u on u.user_id=v_target and u.capability=c.capability
  where c.is_active=true
  order by c.sort_order,c.label;
end;
$$;

create or replace function public.owner_set_user_capability(
  p_user_id uuid,
  p_capability text,
  p_enabled boolean,
  p_inherit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.profiles%rowtype;
  v_catalog public.capability_catalog%rowtype;
begin
  if not public.is_bcb_owner() then raise exception 'Owner access required'; end if;
  select * into v_target from public.profiles where id=p_user_id and is_active=true;
  if v_target.id is null then raise exception 'Active profile not found'; end if;
  if v_target.is_owner then raise exception 'Owner bypass is immutable'; end if;
  select * into v_catalog from public.capability_catalog where capability=trim(p_capability) and is_active=true;
  if v_catalog.capability is null then raise exception 'Unknown capability'; end if;
  if v_catalog.min_role='admin' and v_target.role<>'admin' and not p_inherit then
    raise exception 'Administrator role required for this capability';
  end if;

  if p_inherit then
    delete from public.user_capability_overrides where user_id=p_user_id and capability=v_catalog.capability;
  else
    insert into public.user_capability_overrides(user_id,capability,enabled,updated_at,updated_by)
    values(p_user_id,v_catalog.capability,p_enabled,now(),auth.uid())
    on conflict(user_id,capability) do update
      set enabled=excluded.enabled,updated_at=now(),updated_by=auth.uid();
  end if;

  insert into public.activity_log(actor_id,action,entity_type,entity_id,summary,metadata)
  values(auth.uid(),'user_capability.updated','user_access',p_user_id::text,
    'Acces individual actualizat',
    jsonb_build_object('user_id',p_user_id,'capability',v_catalog.capability,'enabled',p_enabled,'inherit',p_inherit));
end;
$$;

create or replace function public.owner_apply_user_access_template(p_user_id uuid,p_template text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.profiles%rowtype;
  v_cap record;
  v_enabled boolean;
  v_template text := lower(trim(p_template));
begin
  if not public.is_bcb_owner() then raise exception 'Owner access required'; end if;
  select * into v_target from public.profiles where id=p_user_id and is_active=true;
  if v_target.id is null then raise exception 'Active profile not found'; end if;
  if v_target.is_owner then raise exception 'Owner bypass is immutable'; end if;

  if v_template='role_default' then
    delete from public.user_capability_overrides where user_id=p_user_id;
  elsif v_template in ('field','office','fleet','restricted') then
    for v_cap in select capability,min_role from public.capability_catalog where is_active=true loop
      if v_cap.min_role='admin' and v_target.role<>'admin' then
        continue;
      end if;
      v_enabled := case v_template
        when 'field' then v_cap.capability in ('projects.work','time.work','fleet.work','media.work','activity.view')
        when 'office' then v_cap.capability in ('projects.work','crm.work','media.work','activity.view')
        when 'fleet' then v_cap.capability in ('fleet.work','time.work','activity.view')
        when 'restricted' then v_cap.capability in ('time.work')
        else false end;
      insert into public.user_capability_overrides(user_id,capability,enabled,updated_at,updated_by)
      values(p_user_id,v_cap.capability,v_enabled,now(),auth.uid())
      on conflict(user_id,capability) do update set enabled=excluded.enabled,updated_at=now(),updated_by=auth.uid();
    end loop;
  else
    raise exception 'Unknown access template';
  end if;

  insert into public.activity_log(actor_id,action,entity_type,entity_id,summary,metadata)
  values(auth.uid(),'user_access_template.applied','user_access',p_user_id::text,
    'Șablon de acces aplicat',jsonb_build_object('user_id',p_user_id,'template',v_template));
end;
$$;

revoke all on function public.get_effective_user_capabilities(uuid) from public, anon;
revoke all on function public.owner_set_user_capability(uuid,text,boolean,boolean) from public, anon;
revoke all on function public.owner_apply_user_access_template(uuid,text) from public, anon;
grant execute on function public.get_effective_user_capabilities(uuid) to authenticated;
grant execute on function public.owner_set_user_capability(uuid,text,boolean,boolean) to authenticated;
grant execute on function public.owner_apply_user_access_template(uuid,text) to authenticated;
