-- BCB CRM hardening: CRM actions already satisfy RLS, so elevated privileges are unnecessary.
alter function public.bcb_record_quote_contact(uuid,text,text,timestamptz) security invoker;
alter function public.bcb_convert_quote_to_project(uuid) security invoker;
