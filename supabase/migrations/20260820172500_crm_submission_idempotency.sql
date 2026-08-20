-- BCB CRM · public submission idempotency
alter table public.quote_requests
  add column if not exists external_request_id uuid;

create unique index if not exists quote_requests_external_request_uidx
  on public.quote_requests(external_request_id)
  where external_request_id is not null;
