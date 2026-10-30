-- STCK: a separate application. No dependency on existing projects.
create schema if not exists stck_private;
revoke all on schema stck_private from public;
grant usage on schema stck_private to authenticated, service_role;

create table public.spaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 partner_id uuid references auth.users(id) on delete set null,
 left_label text not null default 'Moi' check(length(left_label) between 1 and 30),
 right_label text not null default 'Toi' check(length(right_label) between 1 and 30),
 created_at timestamptz not null default now(),
 check(owner_id is distinct from partner_id)
);
create unique index spaces_owner_idx on public.spaces(owner_id);
create unique index spaces_partner_idx on public.spaces(partner_id) where partner_id is not null;
alter table public.spaces enable row level security;
create policy space_members on public.spaces for select to authenticated using ((select auth.uid()) in (owner_id,partner_id));

create function stck_private.is_member(p_space uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.spaces where id=p_space and auth.uid() in(owner_id,partner_id));
$$;
revoke all on function stck_private.is_member(uuid) from public;
grant execute on function stck_private.is_member(uuid) to authenticated;

create table stck_private.invitations (
 space_id uuid primary key references public.spaces(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null
);
alter table stck_private.invitations enable row level security;

create function stck_private.create_space(p_left text, p_right text) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid; uid uuid:=auth.uid();
 begin
 if uid is null then raise exception 'Connexion requise'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select id into result from public.spaces where uid in(owner_id,partner_id);
 if result is not null then return result; end if;
 insert into public.spaces(owner_id,left_label,right_label) values(uid,trim(p_left),trim(p_right)) returning id into result;
 return result;
 end;
$$;
create function public.create_space(p_left text default 'Moi', p_right text default 'Toi') returns uuid language sql security invoker set search_path='' as $$select stck_private.create_space(p_left,p_right);$$;

create function stck_private.invite_partner() returns text language plpgsql security definer set search_path='' as $$
 declare sid uuid; token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select id into sid from public.spaces where owner_id=auth.uid() and partner_id is null for update;
 if sid is null then raise exception 'Invitation indisponible'; end if;
 insert into stck_private.invitations values(sid,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '48 hours')
 on conflict(space_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
 return token;
 end;
$$;
create function public.invite_partner() returns text language sql security invoker set search_path='' as $$select stck_private.invite_partner();$$;

create function stck_private.join_space(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
 declare sid uuid; uid uuid:=auth.uid();
 begin
 if uid is null then raise exception 'Connexion requise'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if exists(select 1 from public.spaces where uid in(owner_id,partner_id)) then raise exception 'Tu as déjà un espace'; end if;
 select space_id into sid from stck_private.invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now() for update;
 if sid is null then raise exception 'Invitation expirée ou invalide'; end if;
 update public.spaces set partner_id=uid where id=sid and partner_id is null and owner_id<>uid;
 if not found then raise exception 'Cet espace est déjà complet'; end if;
 delete from stck_private.invitations where space_id=sid;
 return sid;
 end;
$$;
create function public.join_space(p_token text) returns uuid language sql security invoker set search_path='' as $$select stck_private.join_space(p_token);$$;

create table public.placements (
 space_id uuid not null references public.spaces(id) on delete cascade,
 sticker_id text not null check(sticker_id ~ '^[1-4]-0[1-8]$'),
 zone smallint not null check(zone in(0,1)),
 x real not null check(x between 0 and 1), y real not null check(y between 0 and 1),
 primary key(space_id,sticker_id)
);
alter table public.placements enable row level security;
create policy placements_members on public.placements for all to authenticated using(stck_private.is_member(space_id)) with check(stck_private.is_member(space_id));

create table public.pouch_draws (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 sticker_id text not null check(sticker_id ~ '^[1-4]-0[1-8]$'),
 created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table public.pouch_draws enable row level security;
create policy own_draws on public.pouch_draws for select to authenticated using(user_id=(select auth.uid()));
create index draws_user_time on public.pouch_draws(user_id,created_at desc);
create function stck_private.open_pouch(p_request uuid) returns text language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); sticker text;
 begin
 if uid is null then raise exception 'Connexion requise'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select sticker_id into sticker from public.pouch_draws where user_id=uid and request_id=p_request;
 if sticker is not null then return sticker; end if;
 if (select count(*) from public.pouch_draws where user_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Patiente une minute avant la prochaine pochette'; end if;
 sticker:=(1+floor(random()*4))::int::text||'-0'||(1+floor(random()*8))::int::text;
 insert into public.pouch_draws values(uid,p_request,sticker,now());
 return sticker;
 end;
$$;
create function public.open_pouch(p_request uuid) returns text language sql security invoker set search_path='' as $$select stck_private.open_pouch(p_request);$$;

create table public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 daily boolean not null default false, news boolean not null default false,
 reminder_time time not null default '18:30', timezone text not null default 'Europe/Paris'
);
alter table public.notification_preferences enable row level security;
create policy own_preferences on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function stck_private.validate_timezone() returns trigger language plpgsql set search_path='' as $$begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Fuseau horaire inconnu'; end if; return new; end;$$;
create trigger valid_timezone before insert or update on public.notification_preferences for each row execute function stck_private.validate_timezone();

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<4096 and endpoint ~ '^https://([A-Za-z0-9-]+\.)?(push\.apple\.com|web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/'),
 p256dh text not null check(length(p256dh) between 80 and 100), auth text not null check(length(auth) between 20 and 30),
 created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy own_subscriptions on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('daily','news','test')), title text not null, body text not null,
 dedupe_key text not null, created_at timestamptz not null default now(), read_at timestamptz,
 unique(user_id,dedupe_key)
);
create index notifications_inbox on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
create policy own_notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy own_notifications_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 100),
 body text not null check(length(body) between 1 and 300), published_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy published_announcements on public.announcements for select to authenticated using(published_at<=now());

create table stck_private.push_deliveries (
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 attempts int not null default 0, available_at timestamptz not null default now(),
 claimed_until timestamptz, lease uuid, delivered_at timestamptz, last_status int,
 primary key(notification_id,subscription_id)
);
alter table stck_private.push_deliveries enable row level security;
create index push_due on stck_private.push_deliveries(available_at) where delivered_at is null and attempts<5;
create index push_delivery_subscription on stck_private.push_deliveries(subscription_id);
create table stck_private.push_config (
 singleton boolean primary key default true check(singleton), vapid_public text not null, vapid_private text not null,
 subject text not null, dispatch_secret text not null, function_url text not null
);
alter table stck_private.push_config enable row level security;

create function public.dispatch_config() returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(c) from stck_private.push_config c where singleton;
$$;
create function stck_private.reminder_key(p_now timestamptz,p_time time,p_timezone text) returns date language plpgsql stable set search_path='' as $$
 declare local_now timestamp:=p_now at time zone p_timezone; scheduled timestamp;
 begin
 scheduled:=local_now::date+p_time;
 if scheduled>local_now then scheduled:=scheduled-interval '1 day';end if;
 if local_now<scheduled+interval '15 minutes' then return scheduled::date;end if;
 return null;
 end;$$;
create function public.queue_notifications() returns void language plpgsql security definer set search_path='' as $$begin
 insert into public.notifications(user_id,kind,title,body,dedupe_key)
 select user_id,'daily','Un petit moment STCK','Ta bibliothèque et une pochette t’attendent.','daily:'||stck_private.reminder_key(now(),reminder_time,timezone)
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
 where n.created_at>now()-interval '24 hours' and s.created_at<=n.created_at and ((n.kind='daily' and p.daily) or (n.kind='news' and p.news) or n.kind='test')
 on conflict do nothing;
 -- Disabling preferences also cancels already queued deliveries.
 delete from stck_private.push_deliveries d using public.notifications n,public.notification_preferences p
 where d.notification_id=n.id and p.user_id=n.user_id and d.delivered_at is null and ((n.kind='daily' and not p.daily) or(n.kind='news' and not p.news));
 delete from public.notifications where created_at<now()-interval '90 days';
 end;$$;
create function public.claim_push_batch() returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 with due as (
 select notification_id,subscription_id from stck_private.push_deliveries where delivered_at is null and attempts<5 and available_at<=now() and (claimed_until is null or claimed_until<now())
 order by available_at for update skip locked limit 5
 ), claimed as (
 update stck_private.push_deliveries d set attempts=attempts+1,claimed_until=now()+interval '2 minutes',lease=gen_random_uuid()
 from due where d.notification_id=due.notification_id and d.subscription_id=due.subscription_id returning d.*
 ) select coalesce(jsonb_agg(jsonb_build_object('notification_id',n.id,'subscription_id',s.id,'lease',c.lease,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'title',n.title,'body',n.body,'tag',n.dedupe_key)),'[]') into result
 from claimed c join public.notifications n on n.id=c.notification_id join public.push_subscriptions s on s.id=c.subscription_id;
 return result;end;$$;
create function public.finish_push(p_notification uuid,p_subscription uuid,p_lease uuid,p_status int) returns void language plpgsql security definer set search_path='' as $$begin
 if p_status in(404,410) then delete from public.push_subscriptions where id=p_subscription and exists(select 1 from stck_private.push_deliveries where notification_id=p_notification and subscription_id=p_subscription and lease=p_lease);return;end if;
 update stck_private.push_deliveries set delivered_at=case when p_status between 200 and 299 then now() end,last_status=p_status,claimed_until=null,available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int))
 where notification_id=p_notification and subscription_id=p_subscription and lease=p_lease;
 end;$$;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.spaces,public.pouch_draws,public.announcements,public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select,insert,update,delete on public.placements,public.notification_preferences,public.push_subscriptions to authenticated;
grant all on all tables in schema public to service_role;
revoke execute on all functions in schema stck_private from public,anon,authenticated;
grant execute on function stck_private.is_member(uuid),stck_private.create_space(text,text),stck_private.invite_partner(),stck_private.join_space(text),stck_private.open_pouch(uuid) to authenticated;
revoke execute on function public.create_space(text,text),public.invite_partner(),public.join_space(text),public.open_pouch(uuid),public.dispatch_config(),public.queue_notifications(),public.claim_push_batch(),public.finish_push(uuid,uuid,uuid,int) from public,anon,authenticated;
grant execute on function public.create_space(text,text),public.invite_partner(),public.join_space(text),public.open_pouch(uuid) to authenticated;
grant execute on function public.dispatch_config(),public.queue_notifications(),public.claim_push_batch(),public.finish_push(uuid,uuid,uuid,int) to service_role;
create function public.push_public_key() returns text language sql security definer set search_path='' as $$select vapid_public from stck_private.push_config where singleton and auth.uid() is not null;$$;
revoke execute on function public.push_public_key() from public,anon;
grant execute on function public.push_public_key() to authenticated;
