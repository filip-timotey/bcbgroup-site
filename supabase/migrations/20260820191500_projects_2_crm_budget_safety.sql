create or replace function public.bcb_convert_quote_to_project(p_quote_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  q public.quote_requests%rowtype;
  p_id uuid;
  base_slug text;
begin
  if not is_bcb_staff() then raise exception 'Not authorized'; end if;
  select * into q from public.quote_requests where id = p_quote_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if q.converted_project_id is not null then return q.converted_project_id; end if;

  base_slug := regexp_replace(lower(coalesce(q.project_type,'proiect') || '-' || coalesce(q.location,'bcb')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug) || '-' || substr(replace(q.id::text,'-',''),1,8);

  insert into public.projects(
    title,slug,location,short_description,description,status,progress,current_stage,
    client_name,client_phone,client_email,health_status,risk_level,internal_notes,
    source_quote_id,created_by,updated_by
  ) values (
    coalesce(nullif(q.project_type,''),'Proiect BCB') || case when q.location is not null then ' — '||q.location else '' end,
    base_slug,q.location,
    left(coalesce(q.message,'Proiect creat din CRM.'),300),q.message,'draft',0,q.project_stage,
    q.full_name,q.phone,q.email,'on_track','normal',
    case when q.estimated_budget is not null then 'Buget declarat în CRM: '||q.estimated_budget else null end,
    q.id,(select auth.uid()),(select auth.uid())
  ) returning id into p_id;

  update public.quote_requests
    set converted_project_id=p_id, converted_at=now(), status='accepted', updated_at=now()
    where id=q.id;
  insert into public.quote_request_events(quote_id,actor_id,event_type,summary,metadata)
    values(q.id,(select auth.uid()),'converted','Lead transformat în proiect',jsonb_build_object('project_id',p_id));
  return p_id;
end;
$$;

grant execute on function public.bcb_convert_quote_to_project(uuid) to authenticated;
