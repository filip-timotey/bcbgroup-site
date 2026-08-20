-- BCB CRM performance hardening (new CRM objects only)
-- Preserve historical indexes; remove only the duplicate index introduced by crm_sales_pipeline_v1.

drop index if exists public.quote_requests_status_created_idx;

create index if not exists quote_requests_assigned_to_idx
  on public.quote_requests(assigned_to)
  where assigned_to is not null;

create index if not exists quote_request_events_actor_idx
  on public.quote_request_events(actor_id)
  where actor_id is not null;

drop policy if exists "staff can insert quote request events" on public.quote_request_events;
create policy "staff can insert quote request events"
  on public.quote_request_events for insert to authenticated
  with check (
    public.is_bcb_staff()
    and (actor_id is null or actor_id = (select auth.uid()))
  );
