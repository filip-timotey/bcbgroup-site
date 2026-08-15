-- =========================================================
-- BCB GROUP — OWNER APPROVAL ENFORCEMENT
-- Normal app writes cannot remove access unless caller is Owner.
-- Service-role backend may execute an Owner-approved action.
-- =========================================================

create or replace function public.enforce_bcb_account_removal_governance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_owner boolean := false;
begin
  -- service-role/backend/SQL maintenance has no end-user auth.uid(); backend
  -- functions still perform their own Owner approval checks before using it.
  if actor is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select coalesce(is_owner,false)
  into actor_is_owner
  from public.profiles
  where id = actor and is_active = true;

  if old.is_owner then
    if tg_op='DELETE'
       or (tg_op='UPDATE' and (
         new.is_owner is distinct from true
         or new.is_active is distinct from true
         or new.role is distinct from 'admin'
       )) then
      raise exception 'Contul Owner este protejat permanent.';
    end if;
    return case when tg_op='DELETE' then old else new end;
  end if;

  -- Removing access from any non-owner account is an Owner action. Admins
  -- must create an approval request instead of performing it directly.
  if not actor_is_owner then
    if tg_op='DELETE' then
      raise exception 'Ștergerea unui cont necesită aprobarea Owner-ului.';
    end if;
    if old.is_active = true and new.is_active = false then
      raise exception 'Dezactivarea unui cont necesită aprobarea Owner-ului.';
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists enforce_bcb_account_removal_governance_trigger on public.profiles;
create trigger enforce_bcb_account_removal_governance_trigger
before update or delete on public.profiles
for each row execute function public.enforce_bcb_account_removal_governance();
