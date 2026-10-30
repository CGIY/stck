alter table public.pouch_draws add column copy_no smallint;
with ranked as (
  select user_id,request_id,row_number() over(partition by user_id,sticker_id order by created_at,request_id) as copy_no
  from public.pouch_draws where kept
)
update public.pouch_draws d set copy_no=r.copy_no::smallint
from ranked r where d.user_id=r.user_id and d.request_id=r.request_id;
alter table public.pouch_draws add constraint pouch_draws_copy_state_check
  check ((kept and copy_no is not null and copy_no between 1 and 3) or (not kept and copy_no is null));
create unique index pouch_draws_copy_slot on public.pouch_draws(user_id,sticker_id,copy_no) where kept;
alter table public.pouch_draws add constraint pouch_draws_reference_unique unique(user_id,request_id,sticker_id);

alter table public.placements add column copy_request_id uuid;
with ranked as (
  select user_id,sticker_id,request_id,row_number() over(partition by user_id,sticker_id order by created_at,request_id) as copy_no
  from public.pouch_draws where kept
)
update public.placements p set copy_request_id=r.request_id
from ranked r where r.user_id=p.copy_owner and r.sticker_id=p.sticker_id and r.copy_no=p.copy_no;
alter table public.placements alter column copy_request_id set not null;
alter table public.placements add constraint placements_copy_draw_fk
  foreign key(copy_owner,copy_request_id,sticker_id) references public.pouch_draws(user_id,request_id,sticker_id);
create unique index placements_copy_draw_unique on public.placements(space_id,copy_owner,copy_request_id);

alter table public.challenge_archive add column copy_request_id uuid;
update public.challenge_archive a set copy_request_id=coalesce(
  (select d.request_id from public.pouch_draws d where d.user_id=a.copy_owner and d.sticker_id=a.sticker_id and d.copy_no=a.copy_no limit 1),gen_random_uuid());
alter table public.challenge_archive drop constraint challenge_archive_pkey;
alter table public.challenge_archive alter column copy_request_id set not null;
alter table public.challenge_archive add constraint challenge_archive_copy_draw_fk
  foreign key(copy_owner,copy_request_id,sticker_id) references public.pouch_draws(user_id,request_id,sticker_id);
alter table public.challenge_archive add primary key(space_id,copy_owner,copy_request_id);

alter table public.placements add column expires_at timestamptz not null default (now()+interval '48 hours');
create index placements_open_expiry on public.placements(space_id,expires_at) where challenge_status='open';

create table stck_private.starter_pouch_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table stck_private.starter_pouch_grants enable row level security;
create table stck_private.daily_pouch_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_date date not null,
  request_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key(user_id,claim_date), unique(user_id,request_id)
);
alter table stck_private.daily_pouch_claims enable row level security;

create function stck_private.issue_free_pouch(p_uid uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sticker text; slot smallint; retained boolean;
begin
  sticker:=stck_private.pick_sticker(random(),random(),random());
  select n::smallint into slot from pg_catalog.generate_series(1,3) n
    where not exists(select 1 from public.pouch_draws d where d.user_id=p_uid and d.sticker_id=sticker and d.kept and d.copy_no=n)
    order by n limit 1;
  retained:=slot is not null;
  insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no) values(p_uid,p_request,sticker,retained,slot);
  return jsonb_build_object('sticker_id',sticker,'kept',retained,'copy_no',slot,'free',true);
end;$$;
revoke all on function stck_private.issue_free_pouch(uuid,uuid) from public,anon,authenticated;

create function stck_private.grant_starter_pouches() returns integer
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; inserted integer; n integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select id into sid from public.spaces where uid in(owner_id,partner_id);
  if sid is null then raise exception 'Rejoins votre espace avant de recevoir tes pochettes'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  insert into stck_private.starter_pouch_grants(user_id) values(uid) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return 0; end if;
  for n in 1..3 loop perform stck_private.issue_free_pouch(uid,gen_random_uuid()); end loop;
  return 3;
end;$$;
revoke all on function stck_private.grant_starter_pouches() from public,anon,authenticated;
grant execute on function stck_private.grant_starter_pouches() to authenticated;
create function public.grant_starter_pouches() returns integer language sql security invoker set search_path='' as $$select stck_private.grant_starter_pouches();$$;
revoke all on function public.grant_starter_pouches() from public,anon;
grant execute on function public.grant_starter_pouches() to authenticated;

create function stck_private.claim_daily_pouch() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; tz text; today date; request uuid; result jsonb;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select id into sid from public.spaces where uid in(owner_id,partner_id);
  if sid is null then raise exception 'Rejoins votre espace avant de récupérer le sticker du jour'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select coalesce((select timezone from public.notification_preferences where user_id=uid),'Europe/Paris') into tz;
  today:=(now() at time zone tz)::date;
  select request_id into request from stck_private.daily_pouch_claims where user_id=uid and claim_date=today;
  if request is not null then
    select jsonb_build_object('claimed',false,'sticker_id',sticker_id,'kept',kept,'copy_no',copy_no,'free',true)
      into result from public.pouch_draws where user_id=uid and request_id=request;
    return result;
  end if;
  request:=gen_random_uuid();
  insert into stck_private.daily_pouch_claims(user_id,claim_date,request_id) values(uid,today,request);
  result:=stck_private.issue_free_pouch(uid,request)||jsonb_build_object('claimed',true);
  return result;
end;$$;
revoke all on function stck_private.claim_daily_pouch() from public,anon,authenticated;
grant execute on function stck_private.claim_daily_pouch() to authenticated;
create function public.claim_daily_pouch() returns jsonb language sql security invoker set search_path='' as $$select stck_private.claim_daily_pouch();$$;
revoke all on function public.claim_daily_pouch() from public,anon;
grant execute on function public.claim_daily_pouch() to authenticated;

create function stck_private.consume_challenge_copy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.pouch_draws set kept=false,copy_no=null
    where user_id=new.copy_owner and sticker_id=new.sticker_id and copy_no=new.copy_no and kept;
  if not found then raise exception 'Cet exemplaire a déjà été utilisé.'; end if;
  return new;
end;$$;
revoke all on function stck_private.consume_challenge_copy() from public,anon,authenticated;
create trigger consume_archived_challenge_copy after insert on public.challenge_archive
for each row execute function stck_private.consume_challenge_copy();

create or replace function stck_private.validate_placement_copy() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    if auth.uid() is null or new.copy_owner<>auth.uid() then raise exception 'Cet exemplaire ne t’appartient pas'; end if;
    select request_id into new.copy_request_id from public.pouch_draws
      where user_id=auth.uid() and sticker_id=new.sticker_id and copy_no=new.copy_no and kept;
    if new.copy_request_id is null then raise exception 'Cet exemplaire a déjà été utilisé ou n’est plus disponible'; end if;
  elsif (new.space_id,new.copy_owner,new.sticker_id,new.copy_no,new.copy_request_id)
    is distinct from (old.space_id,old.copy_owner,old.sticker_id,old.copy_no,old.copy_request_id) then
    raise exception 'L’identité d’un exemplaire ne peut pas changer';
  end if;
  return new;
end;$$;

drop function public.complete_challenge(uuid,text,uuid,smallint);
drop function stck_private.complete_challenge(uuid,text,uuid,smallint);
create function stck_private.complete_challenge(
  p_space uuid,p_sticker text,p_copy_owner uuid,p_copy_no smallint,p_copy_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_row public.placements%rowtype; wallet integer; archived integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.spaces where id=p_space and uid in(owner_id,partner_id)) then raise exception 'Espace introuvable'; end if;
  select * into current_row from public.placements where space_id=p_space and sticker_id=p_sticker
    and copy_owner=p_copy_owner and copy_no=p_copy_no and copy_request_id=p_copy_request for update;
  if not found then
    if exists(select 1 from public.challenge_archive where space_id=p_space and copy_owner=p_copy_owner and copy_request_id=p_copy_request) then
      select tokens into wallet from public.spaces where id=p_space;
      return jsonb_build_object('archived',true,'tokens',wallet,'already_completed',true);
    end if;
    raise exception 'Ce défi a déjà évolué.';
  end if;
  if current_row.challenge_status<>'accepted' or current_row.accepted_by is distinct from uid then
    raise exception 'Seule la personne qui a relevé le défi peut le valider.';
  end if;
  update public.placements set challenge_status='done' where space_id=p_space and copy_owner=p_copy_owner
    and sticker_id=p_sticker and copy_no=p_copy_no and copy_request_id=p_copy_request;
  insert into public.challenge_archive(space_id,sticker_id,copy_owner,copy_no,copy_request_id,placed_by,accepted_by,zone,x,y,completed_at)
    select space_id,sticker_id,copy_owner,copy_no,copy_request_id,placed_by,accepted_by,zone,x,y,completed_at
    from public.placements where space_id=p_space and copy_request_id=p_copy_request on conflict do nothing;
  get diagnostics archived=row_count;
  if archived=1 then update public.spaces set tokens=tokens+1 where id=p_space returning tokens into wallet;
  else select tokens into wallet from public.spaces where id=p_space; end if;
  delete from public.placements where space_id=p_space and copy_request_id=p_copy_request;
  return jsonb_build_object('archived',true,'tokens',wallet,'already_completed',false);
end;$$;
revoke all on function stck_private.complete_challenge(uuid,text,uuid,smallint,uuid) from public,anon,authenticated;
grant execute on function stck_private.complete_challenge(uuid,text,uuid,smallint,uuid) to authenticated;
create function public.complete_challenge(p_space uuid,p_sticker text,p_copy_owner uuid,p_copy_no smallint,p_copy_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
select stck_private.complete_challenge(p_space,p_sticker,p_copy_owner,p_copy_no,p_copy_request);$$;
revoke all on function public.complete_challenge(uuid,text,uuid,smallint,uuid) from public,anon;
grant execute on function public.complete_challenge(uuid,text,uuid,smallint,uuid) to authenticated;

create or replace function stck_private.draw_pouch(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; sticker text; retained boolean; quantity integer; wallet integer; slot smallint;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select id,tokens into sid,wallet from public.spaces where uid in(owner_id,partner_id) for update;
  if sid is null then raise exception 'Rejoins votre espace avant d’ouvrir une pochette'; end if;
  select sticker_id,kept,copy_no into sticker,retained,slot from public.pouch_draws where user_id=uid and request_id=p_request;
  if sticker is not null then
    select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
    return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,'copy_no',slot,'tokens',wallet);
  end if;
  if wallet<3 then raise exception 'Il faut 3 jetons pour ouvrir une pochette (solde : %).',wallet; end if;
  if (select count(*) from public.pouch_draws where user_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Patiente une minute avant la prochaine pochette'; end if;
  sticker:=stck_private.pick_sticker(random(),random(),random());
  select n::smallint into slot from pg_catalog.generate_series(1,3) n
    where not exists(select 1 from public.pouch_draws d where d.user_id=uid and d.sticker_id=sticker and d.kept and d.copy_no=n)
    order by n limit 1;
  retained:=slot is not null;
  update public.spaces set tokens=tokens-3 where id=sid returning tokens into wallet;
  insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no) values(uid,p_request,sticker,retained,slot);
  select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
  return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,'copy_no',slot,'tokens',wallet);
end;$$;

create function stck_private.expire_challenges() returns integer
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); expired integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  delete from public.placements p using public.spaces s
    where p.space_id=s.id and s.id=p.space_id and uid in(s.owner_id,s.partner_id)
      and p.challenge_status='open' and p.expires_at<=now();
  get diagnostics expired=row_count;
  return expired;
end;$$;
revoke all on function stck_private.expire_challenges() from public,anon,authenticated;
grant execute on function stck_private.expire_challenges() to authenticated;
create function public.expire_challenges() returns integer language sql security invoker set search_path='' as $$select stck_private.expire_challenges();$$;
revoke all on function public.expire_challenges() from public,anon;
grant execute on function public.expire_challenges() to authenticated;

create or replace function public.queue_notifications() returns void language plpgsql security definer set search_path='' as $$begin
  insert into public.notifications(user_id,kind,title,body,dedupe_key)
  select user_id,'daily','Ton sticker du jour t’attend','Ta pochette gratuite du jour est prête. Un défi à deux peut aussi faire gagner des jetons.','daily:'||stck_private.reminder_key(now(),reminder_time,timezone)
  from public.notification_preferences p where daily and stck_private.reminder_key(now(),reminder_time,timezone) is not null
    and exists(select 1 from public.push_subscriptions s where s.user_id=p.user_id)
  on conflict(user_id,dedupe_key) do nothing;
  insert into public.notifications(user_id,kind,title,body,dedupe_key)
  select p.user_id,'news',a.title,a.body,'news:'||a.id from public.notification_preferences p cross join public.announcements a
  where p.news and a.published_at<=now() and a.published_at>now()-interval '24 hours'
  on conflict(user_id,dedupe_key) do nothing;
  insert into stck_private.push_deliveries(notification_id,subscription_id)
  select n.id,s.id from public.notifications n join public.push_subscriptions s on s.user_id=n.user_id
  join public.notification_preferences p on p.user_id=n.user_id
  where n.created_at>now()-interval '24 hours' and s.created_at<=n.created_at
    and ((n.kind='daily' and p.daily) or (n.kind='news' and p.news) or n.kind='test') on conflict do nothing;
  delete from stck_private.push_deliveries d using public.notifications n,public.notification_preferences p
  where d.notification_id=n.id and p.user_id=n.user_id and d.delivered_at is null and ((n.kind='daily' and not p.daily) or (n.kind='news' and not p.news));
  delete from public.notifications where created_at<now()-interval '90 days';
end;$$;
