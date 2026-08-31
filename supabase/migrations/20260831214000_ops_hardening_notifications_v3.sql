-- BCB Operations hardening v3
create index if not exists system_health_snapshots_generated_by_idx on public.system_health_snapshots(generated_by);

grant insert on public.system_notifications to authenticated;
drop policy if exists "owner creates system notifications" on public.system_notifications;
create policy "owner creates system notifications" on public.system_notifications for insert to authenticated with check (public.is_bcb_owner() and (user_id is null or user_id=(select auth.uid())));

grant insert on public.system_health_snapshots to authenticated;
drop policy if exists "owner creates system health snapshots" on public.system_health_snapshots;
create policy "owner creates system health snapshots" on public.system_health_snapshots for insert to authenticated with check (public.is_bcb_owner() and generated_by=(select auth.uid()));

create or replace function public.refresh_bcb_system_signals()
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_pending integer:=0; v_archived integer:=0; v_active integer:=0; v_score integer:=100; v_status text:='healthy';
begin
 if not public.is_bcb_owner() then raise exception 'Owner access required'; end if;
 select count(*) into v_pending from public.user_access_requests where status='pending';
 select count(*) into v_archived from public.profiles where coalesce(is_archived,false)=true;
 select count(*) into v_active from public.profiles where is_active=true and coalesce(is_archived,false)=false;
 v_score:=greatest(70,100-least(v_pending,5)*5); if v_pending>0 then v_status:='attention'; end if;
 insert into public.system_health_snapshots(overall_status,score,checks,notes,generated_by) values(v_status,v_score,jsonb_build_object('database','ok','active_profiles',v_active,'archived_profiles',v_archived,'pending_access_requests',v_pending),jsonb_build_array('App-level health snapshot. Platform-level service health is monitored separately by Supabase.'),auth.uid());
 if v_pending>0 then insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner','warning','access','Cereri de acces în așteptare',format('%s cereri necesită decizia Owner-ului.',v_pending),'users.html','owner:pending-access') on conflict(dedupe_key) where dedupe_key is not null do nothing; end if;
 return jsonb_build_object('status',v_status,'score',v_score,'pending',v_pending,'active',v_active,'archived',v_archived);
end $$;
revoke all on function public.refresh_bcb_system_signals() from public,anon;
grant execute on function public.refresh_bcb_system_signals() to authenticated;

create or replace function public.emit_bcb_operational_notifications()
returns integer language plpgsql security invoker set search_path=public,auth as $$
declare n integer:=0; r record;
begin
 if not public.is_bcb_owner() then raise exception 'Owner access required'; end if;
 for r in select id,severity from public.fleet_incidents where status not in ('resolved','closed') and (severity in ('high','critical') or injuries is true) loop insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner',case when r.severity='critical' then 'critical' else 'warning' end,'Fleet','Incident Fleet necesită atenție','Există un incident activ care necesită verificare Owner.','fleet.html','fleet-incident:'||r.id) on conflict(dedupe_key) where dedupe_key is not null do nothing; if found then n:=n+1; end if; end loop;
 for r in select id,full_name,priority from public.quote_requests where status not in ('won','lost','closed') and (priority in ('high','urgent') or coalesce(lead_score,0)>=80 or (next_follow_up_at is not null and next_follow_up_at<now())) loop insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner',case when r.priority='urgent' then 'critical' else 'warning' end,'CRM','Lead CRM necesită acțiune',coalesce(r.full_name,'Solicitare ofertă')||' are prioritate ridicată sau follow-up restant.','quotes.html','crm-attention:'||r.id) on conflict(dedupe_key) where dedupe_key is not null do nothing; if found then n:=n+1; end if; end loop;
 for r in select id,score,status from public.project_health_snapshots where created_at>now()-interval '7 days' and (score<70 or status in ('attention','risk','critical','degraded')) loop insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner',case when r.score<50 or r.status='critical' then 'critical' else 'warning' end,'Projects','Proiect cu semnale de risc','Health Engine a detectat un proiect care necesită atenție.','dashboard.html#projects','project-health:'||r.id) on conflict(dedupe_key) where dedupe_key is not null do nothing; if found then n:=n+1; end if; end loop;
 for r in select id from public.hr_alert_log where sent_at>now()-interval '30 days' loop insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner','warning','HR','Alertă HR activă','Există un termen sau document HR care necesită verificare.','employees.html','hr-alert:'||r.id) on conflict(dedupe_key) where dedupe_key is not null do nothing; if found then n:=n+1; end if; end loop;
 return n;
end $$;
revoke all on function public.emit_bcb_operational_notifications() from public,anon;
grant execute on function public.emit_bcb_operational_notifications() to authenticated;

create or replace function public.refresh_bcb_operations_center()
returns jsonb language plpgsql security invoker set search_path=public,auth as $$
declare created integer; health jsonb;
begin if not public.is_bcb_owner() then raise exception 'Owner access required'; end if; created:=public.emit_bcb_operational_notifications(); health:=public.refresh_bcb_system_signals(); return jsonb_build_object('notifications_created',created,'health',health); end $$;
revoke all on function public.refresh_bcb_operations_center() from public,anon;
grant execute on function public.refresh_bcb_operations_center() to authenticated;