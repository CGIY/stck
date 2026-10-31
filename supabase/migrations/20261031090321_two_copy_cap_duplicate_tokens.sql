-- Two retained copies per illustration. Each subsequent draw is discarded and
-- credits one shared token, exactly once for that draw's request ID.
-- Refuse an unexpected third live copy rather than altering player inventory.
lock table public.pouch_draws, public.placements in share row exclusive mode;
do $$
begin
  if exists(select 1 from public.pouch_draws where kept and copy_no>2)
    or exists(select 1 from public.placements where copy_no>2) then
    raise exception 'Une troisième copie est encore active. Migration arrêtée sans modifier les stocks.';
  end if;
end;
$$;

alter table public.pouch_draws
  add column duplicate_tokens smallint not null default 0
    check(duplicate_tokens between 0 and 1),
  drop constraint pouch_draws_copy_state_check,
  add constraint pouch_draws_copy_state_check check(
    (kept and copy_no is not null and copy_no between 1 and 2)
    or (not kept and copy_no is null)
  ),
  add constraint pouch_draws_duplicate_token_state_check
    check(duplicate_tokens=0 or (not kept and copy_no is null));
alter table public.placements drop constraint placements_copy_no_check,
  add constraint placements_copy_no_check check(copy_no between 1 and 2);
-- Historical challenge_archive.copy_no may remain 3: it does not occupy stock.

create or replace function stck_private.issue_free_pouch(p_uid uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  sid uuid; wallet integer; sticker text; slot smallint; retained boolean;
  quantity integer; compensation smallint;
begin
  if p_uid is null or p_request is null then raise exception 'Demande de pochette invalide'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text,1));
  select id,tokens into sid,wallet from public.spaces
    where p_uid in(owner_id,partner_id) for update;
  if sid is null then raise exception 'Rejoins votre espace avant de récupérer le sticker du jour'; end if;
  select sticker_id,kept,copy_no,duplicate_tokens into sticker,retained,slot,compensation
    from public.pouch_draws where user_id=p_uid and request_id=p_request;
  if sticker is not null then
    select count(*) into quantity from public.pouch_draws
      where user_id=p_uid and sticker_id=sticker and kept;
    return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,
      'copy_no',slot,'free',true,'duplicate_tokens',compensation,'tokens',wallet);
  end if;
  sticker:=stck_private.pick_sticker(random(),random(),random());
  select n::smallint into slot from pg_catalog.generate_series(1,2) n
    where not exists(select 1 from public.pouch_draws d
      where d.user_id=p_uid and d.sticker_id=sticker and d.kept and d.copy_no=n)
    order by n limit 1;
  retained:=slot is not null;
  compensation:=case when retained then 0 else 1 end;
  insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no,duplicate_tokens)
    values(p_uid,p_request,sticker,retained,slot,compensation);
  if compensation=1 then
    update public.spaces set tokens=tokens+1 where id=sid returning tokens into wallet;
  end if;
  select count(*) into quantity from public.pouch_draws
    where user_id=p_uid and sticker_id=sticker and kept;
  return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,
    'copy_no',slot,'free',true,'duplicate_tokens',compensation,'tokens',wallet);
end;
$$;
revoke all on function stck_private.issue_free_pouch(uuid,uuid) from public,anon,authenticated;

create or replace function stck_private.claim_daily_pouch() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; tz text; today date; request uuid; result jsonb;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select id into sid from public.spaces where uid in(owner_id,partner_id);
  if sid is null then raise exception 'Rejoins votre espace avant de récupérer le sticker du jour'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select coalesce((select timezone from public.notification_preferences where user_id=uid),'Europe/Paris') into tz;
  today:=(now() at time zone tz)::date;
  select request_id into request from stck_private.daily_pouch_claims
    where user_id=uid and claim_date=today;
  if request is not null then
    return stck_private.issue_free_pouch(uid,request)||jsonb_build_object('claimed',false);
  end if;
  request:=gen_random_uuid();
  insert into stck_private.daily_pouch_claims(user_id,claim_date,request_id)
    values(uid,today,request);
  result:=stck_private.issue_free_pouch(uid,request)||jsonb_build_object('claimed',true);
  return result;
end;
$$;
revoke all on function stck_private.claim_daily_pouch() from public,anon,authenticated;
grant execute on function stck_private.claim_daily_pouch() to authenticated;

create or replace function stck_private.draw_pouch(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); sid uuid; sticker text; retained boolean; quantity integer;
  wallet integer; slot smallint; compensation smallint;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_request is null then raise exception 'Demande de pochette invalide'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select id,tokens into sid,wallet from public.spaces
    where uid in(owner_id,partner_id) for update;
  if sid is null then raise exception 'Rejoins votre espace avant d’ouvrir une pochette'; end if;
  select sticker_id,kept,copy_no,duplicate_tokens into sticker,retained,slot,compensation
    from public.pouch_draws where user_id=uid and request_id=p_request;
  if sticker is not null then
    select count(*) into quantity from public.pouch_draws
      where user_id=uid and sticker_id=sticker and kept;
    return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,
      'copy_no',slot,'tokens',wallet,'duplicate_tokens',compensation);
  end if;
  if wallet<3 then raise exception 'Il faut 3 jetons pour ouvrir une pochette (solde : %).',wallet; end if;
  if (select count(*) from public.pouch_draws
    where user_id=uid and created_at>now()-interval '1 minute')>=10 then
    raise exception 'Patiente une minute avant la prochaine pochette';
  end if;
  sticker:=stck_private.pick_sticker(random(),random(),random());
  select n::smallint into slot from pg_catalog.generate_series(1,2) n
    where not exists(select 1 from public.pouch_draws d
      where d.user_id=uid and d.sticker_id=sticker and d.kept and d.copy_no=n)
    order by n limit 1;
  retained:=slot is not null;
  compensation:=case when retained then 0 else 1 end;
  update public.spaces set tokens=tokens-3+compensation
    where id=sid returning tokens into wallet;
  insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no,duplicate_tokens)
    values(uid,p_request,sticker,retained,slot,compensation);
  select count(*) into quantity from public.pouch_draws
    where user_id=uid and sticker_id=sticker and kept;
  return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,
    'copy_no',slot,'tokens',wallet,'duplicate_tokens',compensation);
end;
$$;
revoke all on function stck_private.draw_pouch(uuid) from public,anon,authenticated;
grant execute on function stck_private.draw_pouch(uuid) to authenticated;
