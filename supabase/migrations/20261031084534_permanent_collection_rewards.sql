-- A sheet's emblem and finish belong permanently to the player who discovered
-- every active sticker on it. Completing challenges never removes this reward.
create table stck_private.collection_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_key text not null check (collection_key in
    ('amour','douceurs','saveurs','plaisirs','intimite','porn-love','rouge-gorge','monoprix')),
  earned_at timestamptz not null default now(),
  primary key (user_id, collection_key)
);
alter table stck_private.collection_rewards enable row level security;
revoke all on stck_private.collection_rewards from public, anon, authenticated;

create function stck_private.award_completed_collection() returns trigger
language plpgsql security definer set search_path='' as $$
declare sheet text;
begin
  select collection_key into sheet from stck_private.sticker_catalog
    where id = new.sticker_id and active;
  if sheet is null then return new; end if;
  -- Match the existing per-player pouch lock so simultaneous draws cannot
  -- leave the final two discoveries without their permanent completion reward.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,1));
  if not exists (
    select 1 from stck_private.sticker_catalog c
    where c.collection_key=sheet and c.active and not exists (
      select 1 from public.pouch_draws d
      where d.user_id=new.user_id and d.sticker_id=c.id
    )
  ) then
    insert into stck_private.collection_rewards(user_id,collection_key)
      values(new.user_id,sheet) on conflict(user_id,collection_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function stck_private.award_completed_collection()
  from public, anon, authenticated;
create trigger award_completed_collection_after_draw
  after insert on public.pouch_draws for each row
  execute function stck_private.award_completed_collection();

-- Backfill from lifetime discovery history, including consumed copies. The
-- timestamp is when the last required illustration was first discovered.
with first_discoveries as (
  select user_id,sticker_id,min(created_at) as discovered_at
  from public.pouch_draws group by user_id,sticker_id
)
insert into stck_private.collection_rewards(user_id,collection_key,earned_at)
select d.user_id,c.collection_key,max(d.discovered_at)
from stck_private.sticker_catalog c
join first_discoveries d on d.sticker_id=c.id
where c.active
group by d.user_id,c.collection_key
having count(*) = (
  select count(*) from stck_private.sticker_catalog required
  where required.active and required.collection_key=c.collection_key
)
on conflict(user_id,collection_key) do nothing;

-- No user ID argument: the only readable rewards are those of auth.uid().
create function stck_private.get_collection_rewards()
returns table(collection_key text,earned_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  return query select r.collection_key,r.earned_at
    from stck_private.collection_rewards r
    where r.user_id=uid order by r.earned_at,r.collection_key;
end;
$$;
revoke all on function stck_private.get_collection_rewards()
  from public, anon, authenticated;
grant execute on function stck_private.get_collection_rewards() to authenticated;
create function public.collection_rewards()
returns table(collection_key text,earned_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select * from stck_private.get_collection_rewards();
$$;
revoke all on function public.collection_rewards() from public, anon;
grant execute on function public.collection_rewards() to authenticated;
