create or replace function public.refresh_bcb_system_signals()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_pending integer:=0;v_archived integer:=0;v_active integer:=0;v_score integer:=100;v_status text:='healthy';
begin
 if auth.uid() is not null and not public.is_bcb_owner() then raise exception 'Owner access required'; end if;
 select count(*) into v_pending from public.user_access_requests where status='pending';
 select count(*) into v_archived from public.profiles where coalesce(is_archived,false)=true;
 select count(*) into v_active from public.profiles where is_active=true and coalesce(is_archived,false)=false;
 v_score:=greatest(70,100-least(v_pending,5)*5);if v_pending>0 then v_status:='attention';end if;
 insert into public.system_health_snapshots(overall_status,score,checks,notes,generated_by) values(v_status,v_score,jsonb_build_object('database','ok','active_profiles',v_active,'archived_profiles',v_archived,'pending_access_requests',v_pending),jsonb_build_array('Free plan: leaked-password protection unavailable; minimum password length hardened to 10.'),auth.uid());
 if v_pending>0 then insert into public.system_notifications(audience,severity,category,title,body,link,dedupe_key) values('owner','warning','access','Cereri de acces în așteptare',format('%s cereri necesită decizia Owner-ului.',v_pending),'users.html','owner:pending-access') on conflict(dedupe_key) where dedupe_key is not null do update set body=excluded.body,is_read=false,read_at=null,created_at=now(),expires_at=null;else delete from public.system_notifications where dedupe_key='owner:pending-access';end if;
 return jsonb_build_object('status',v_status,'score',v_score,'pending',v_pending,'active',v_active,'archived',v_archived);
end;$$;
revoke all on function public.refresh_bcb_system_signals() from public,anon;grant execute on function public.refresh_bcb_system_signals() to authenticated,service_role;
create or replace function public.bcb_notification_read_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$begin if current_user in ('service_role','postgres') then return new;end if;if new.id<>old.id or new.user_id is distinct from old.user_id or new.audience<>old.audience or new.severity<>old.severity or new.category<>old.category or new.title<>old.title or new.body is distinct from old.body or new.link is distinct from old.link or new.dedupe_key is distinct from old.dedupe_key or new.created_at<>old.created_at or new.expires_at is distinct from old.expires_at then raise exception 'Only notification read state can be changed';end if;if new.is_read then new.read_at:=coalesce(new.read_at,now());else new.read_at:=null;end if;return new;end;$$;
drop trigger if exists bcb_notification_read_guard on public.system_notifications;create trigger bcb_notification_read_guard before update on public.system_notifications for each row execute function public.bcb_notification_read_guard();revoke all on function public.bcb_notification_read_guard() from public,anon,authenticated;
grant select,update on public.system_notifications to authenticated;grant select on public.system_health_snapshots to authenticated;
