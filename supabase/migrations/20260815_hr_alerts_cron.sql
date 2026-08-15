-- =========================================================
-- BCB GROUP — HR ALERTS CRON
-- Daily automated People Operations expiry notifications
-- =========================================================

-- Requires pg_cron + pg_net, already enabled for Fleet automation.
-- Reuses the same secured Vault secret used by Fleet Cron.

do $$
begin
  if exists(select 1 from cron.job where jobname='bcb-hr-daily-alerts') then
    perform cron.unschedule('bcb-hr-daily-alerts');
  end if;
end $$;

select cron.schedule(
  'bcb-hr-daily-alerts',
  '15 4 * * *',
  $$
  select net.http_post(
    url := 'https://igxkzgsxokdsfgkatkud.supabase.co/functions/v1/send-hr-alerts',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-bcb-cron-secret',(
        select decrypted_secret
        from vault.decrypted_secrets
        where name='fleet_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
