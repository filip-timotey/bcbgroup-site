-- BCB Business Manager · CRM Sales Pipeline v1
-- Additive migration: preserves all existing quote/project/fleet data.

alter table public.quote_requests
  add column if not exists priority text not null default 'normal',
  add column if not exists lead_score integer not null default 0,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_contact_at timestamptz,
  add column if not exists contact_count integer not null default 0,
  add column if not exists lost_reason text,
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null,
  add column if not exists converted_at timestamptz,
  add column if not exists ai_summary text,
  add column if not exists ai_summary_updated_at timestamptz;

alter table public.quote_requests drop constraint if exists quote_requests_priority_check;
alter table public.quote_requests add constraint quote_requests_priority_check
  check (priority = any (array['low'::text,'normal'::text,'high'::text,'urgent'::text]));

alter table public.quote_requests drop constraint if exists quote_requests_lead_score_check;
alter table public.quote_requests add constraint quote_requests_lead_score_check
  check (lead_score between 0 and 100);

alter table public.quote_requests drop constraint if exists quote_requests_contact_count_check;
alter table public.quote_requests add constraint quote_requests_contact_count_check
  check (contact_count >= 0);

create index if not exists quote_requests_status_created_idx
  on public.quote_requests(status, created_at desc);
create index if not exists quote_requests_follow_up_idx
  on public.quote_requests(next_follow_up_at)
  where next_follow_up_at is not null and status not in ('accepted','rejected','archived');
create index if not exists quote_requests_priority_score_idx
  on public.quote_requests(priority, lead_score desc, created_at desc);
create index if not exists quote_requests_converted_project_idx
  on public.quote_requests(converted_project_id)
  where converted_project_id is not null;

create table if not exists public.quote_request_events (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_request_events_quote_created_idx
  on public.quote_request_events(quote_request_id, created_at desc);

alter table public.quote_request_events enable row level security;

drop policy if exists "staff can read quote request events" on public.quote_request_events;
create policy "staff can read quote request events"
  on public.quote_request_events for select to authenticated
  using (public.is_bcb_staff());

drop policy if exists "staff can insert quote request events" on public.quote_request_events;
create policy "staff can insert quote request events"
  on public.quote_request_events for insert to authenticated
  with check (public.is_bcb_staff() and (actor_id is null or actor_id = auth.uid()));

drop policy if exists "admins can delete quote request events" on public.quote_request_events;
create policy "admins can delete quote request events"
  on public.quote_request_events for delete to authenticated
  using (public.is_bcb_admin());

create or replace function public.bcb_compute_quote_lead_score()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  score integer := 15;
  budget text := lower(coalesce(new.estimated_budget,''));
  desired text := lower(coalesce(new.desired_start,''));
  stage text := lower(coalesce(new.project_stage,''));
begin
  if nullif(trim(coalesce(new.email,'')), '') is not null then score := score + 8; end if;
  if nullif(trim(coalesce(new.location,'')), '') is not null then score := score + 7; end if;
  if nullif(trim(coalesce(new.project_type,'')), '') is not null then score := score + 10; end if;
  if length(trim(coalesce(new.message,''))) >= 80 then score := score + 10; end if;

  if budget like '%peste 100%' then score := score + 20;
  elsif budget like '%50.000%' then score := score + 16;
  elsif budget like '%20.000%' then score := score + 11;
  elsif budget like '%sub 20%' then score := score + 6;
  end if;

  if desired like '%cât mai curând%' or desired like '%cat mai curand%' then score := score + 15;
  elsif desired like '%1-3%' then score := score + 11;
  elsif desired like '%3-6%' then score := score + 6;
  end if;

  if stage like '%autoriza%' or stage like '%se poate începe%' or stage like '%se poate incepe%' then score := score + 10;
  elsif stage like '%început%' or stage like '%inceput%' then score := score + 8;
  elsif stage like '%proiect%' or stage like '%plan%' then score := score + 5;
  end if;

  new.lead_score := greatest(0, least(100, score));
  return new;
end;
$$;

revoke all on function public.bcb_compute_quote_lead_score() from public, anon, authenticated;

DROP TRIGGER IF EXISTS quote_requests_compute_lead_score ON public.quote_requests;
create trigger quote_requests_compute_lead_score
before insert or update of email, location, project_type, estimated_budget, desired_start, project_stage, message
on public.quote_requests
for each row execute function public.bcb_compute_quote_lead_score();

create or replace function public.bcb_log_quote_crm_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.quote_request_events(quote_request_id, actor_id, event_type, to_status, metadata)
    values (new.id, auth.uid(), 'created', new.status, jsonb_build_object('source', new.source));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.quote_request_events(quote_request_id, actor_id, event_type, from_status, to_status)
    values (new.id, auth.uid(), 'status_changed', old.status, new.status);
  end if;

  if old.next_follow_up_at is distinct from new.next_follow_up_at then
    insert into public.quote_request_events(quote_request_id, actor_id, event_type, note, metadata)
    values (new.id, auth.uid(), 'follow_up_changed', 'Follow-up actualizat', jsonb_build_object('next_follow_up_at', new.next_follow_up_at));
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.quote_request_events(quote_request_id, actor_id, event_type, metadata)
    values (new.id, auth.uid(), 'assignment_changed', jsonb_build_object('assigned_to', new.assigned_to));
  end if;

  return new;
end;
$$;

revoke all on function public.bcb_log_quote_crm_event() from public, anon, authenticated;

DROP TRIGGER IF EXISTS quote_requests_crm_event ON public.quote_requests;
create trigger quote_requests_crm_event
after insert or update of status, next_follow_up_at, assigned_to
on public.quote_requests
for each row execute function public.bcb_log_quote_crm_event();

create or replace function public.bcb_record_quote_contact(
  p_quote_id uuid,
  p_note text default null,
  p_channel text default 'manual',
  p_next_follow_up_at timestamptz default null
)
returns public.quote_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.quote_requests;
begin
  if auth.uid() is null or not public.is_bcb_staff() then
    raise exception 'BCB staff access required';
  end if;

  update public.quote_requests
  set last_contact_at = now(),
      contact_count = contact_count + 1,
      next_follow_up_at = coalesce(p_next_follow_up_at, next_follow_up_at),
      status = case when status = 'new' then 'contacted' else status end
  where id = p_quote_id
  returning * into updated;

  if updated.id is null then raise exception 'Quote request not found'; end if;

  insert into public.quote_request_events(quote_request_id, actor_id, event_type, note, metadata)
  values (p_quote_id, auth.uid(), 'contact_recorded', nullif(trim(coalesce(p_note,'')),''), jsonb_build_object('channel', coalesce(nullif(trim(p_channel),''),'manual')));

  return updated;
end;
$$;

revoke all on function public.bcb_record_quote_contact(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.bcb_record_quote_contact(uuid,text,text,timestamptz) to authenticated;

create or replace function public.bcb_convert_quote_to_project(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  q public.quote_requests;
  project_id uuid;
  base_slug text;
  final_slug text;
  suffix integer := 1;
begin
  if auth.uid() is null or not public.is_bcb_staff() then
    raise exception 'BCB staff access required';
  end if;

  select * into q from public.quote_requests where id = p_quote_id for update;
  if q.id is null then raise exception 'Quote request not found'; end if;
  if q.converted_project_id is not null then return q.converted_project_id; end if;

  base_slug := lower(regexp_replace(coalesce(q.project_type,'proiect') || '-' || coalesce(q.full_name,'client'), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'proiect'; end if;
  final_slug := base_slug;
  while exists(select 1 from public.projects where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.projects(title, slug, location, short_description, description, status, progress, current_stage, created_by, updated_by)
  values (
    coalesce(nullif(trim(q.project_type),''),'Proiect') || ' · ' || q.full_name,
    final_slug,
    q.location,
    left(q.message, 220),
    q.message,
    'draft',
    0,
    'Lead convertit · analiză inițială',
    auth.uid(),
    auth.uid()
  ) returning id into project_id;

  update public.quote_requests
  set converted_project_id = project_id,
      converted_at = now(),
      status = 'accepted',
      next_follow_up_at = null
  where id = q.id;

  insert into public.quote_request_events(quote_request_id, actor_id, event_type, to_status, metadata)
  values (q.id, auth.uid(), 'converted_to_project', 'accepted', jsonb_build_object('project_id', project_id));

  return project_id;
end;
$$;

revoke all on function public.bcb_convert_quote_to_project(uuid) from public, anon;
grant execute on function public.bcb_convert_quote_to_project(uuid) to authenticated;

-- Backfill scores for existing rows without altering their workflow state.
update public.quote_requests
set message = message
where lead_score = 0;
