create or replace function stck_private.daily_pouch_available() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); tz text; today date;
begin
  if uid is null then return false; end if;
  if not exists(select 1 from public.spaces s where uid in(s.owner_id,s.partner_id)) then return false; end if;
  select coalesce((select timezone from public.notification_preferences where user_id=uid),'Europe/Paris') into tz;
  today:=(now() at time zone tz)::date;
  return not exists(select 1 from stck_private.daily_pouch_claims where user_id=uid and claim_date=today);
end;$$;
revoke all on function stck_private.daily_pouch_available() from public,anon,authenticated;
grant execute on function stck_private.daily_pouch_available() to authenticated;

create or replace function public.daily_pouch_available() returns boolean
language sql security invoker set search_path='' as $$select stck_private.daily_pouch_available();$$;
revoke all on function public.daily_pouch_available() from public,anon,authenticated;
grant execute on function public.daily_pouch_available() to authenticated;
