-- Rare chance is 1% per draw, shared equally between the eight rare artworks.
alter table public.pouch_draws add column kept boolean not null default true;
with ranked as (
 select user_id,request_id,row_number() over(partition by user_id,sticker_id order by created_at,request_id) as n from public.pouch_draws
) update public.pouch_draws d set kept=false from ranked r
where d.user_id=r.user_id and d.request_id=r.request_id and r.n>3;
create index draws_kept_stock on public.pouch_draws(user_id,sticker_id) where kept;

create function stck_private.pick_sticker(p_rarity double precision,p_collection double precision,p_item double precision)
returns text language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_rarity<0 or p_rarity>=1 or p_collection<0 or p_collection>=1 or p_item<0 or p_item>=1 then raise exception 'Tirage invalide'; end if;
 return (1+floor(p_collection*4))::int::text||'-0'||
 (case when p_rarity<0.01 then 7+floor(p_item*2) else 1+floor(p_item*6) end)::int::text;
end;$$;
revoke all on function stck_private.pick_sticker(double precision,double precision,double precision) from public,anon,authenticated;

create function stck_private.draw_pouch(p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sticker text; retained boolean; quantity integer;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select sticker_id,kept into sticker,retained from public.pouch_draws where user_id=uid and request_id=p_request;
 if sticker is null then
   if (select count(*) from public.pouch_draws where user_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Patiente une minute avant la prochaine pochette'; end if;
   sticker:=stck_private.pick_sticker(random(),random(),random());
   select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
   retained:=quantity<3;
   insert into public.pouch_draws(user_id,request_id,sticker_id,kept) values(uid,p_request,sticker,retained);
 end if;
 select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
 return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity);
end;$$;
revoke all on function stck_private.draw_pouch(uuid) from public,anon;
grant execute on function stck_private.draw_pouch(uuid) to authenticated;
create function public.draw_pouch(p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select stck_private.draw_pouch(p_request);$$;
revoke all on function public.draw_pouch(uuid) from public,anon;
grant execute on function public.draw_pouch(uuid) to authenticated;
create or replace function stck_private.open_pouch(p_request uuid) returns text language sql security definer set search_path='' as $$select stck_private.draw_pouch(p_request)->>'sticker_id';$$;

-- Each retained copy can be placed once; both people may move shared copies.
alter table public.placements add column copy_owner uuid references auth.users(id) on delete cascade,
  add column copy_no smallint not null default 1 check(copy_no between 1 and 3);
update public.placements p set copy_owner=coalesce(p.placed_by,s.owner_id) from public.spaces s where s.id=p.space_id;
alter table public.placements alter column copy_owner set not null;
alter table public.placements drop constraint placements_pkey;
alter table public.placements add primary key(space_id,copy_owner,sticker_id,copy_no);
create index placements_copy_owner_idx on public.placements(copy_owner);
create function stck_private.validate_placement_copy() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if auth.uid() is null or new.copy_owner<>auth.uid() then raise exception 'Cet exemplaire ne t’appartient pas'; end if;
   if new.copy_no>(select count(*) from public.pouch_draws where user_id=auth.uid() and sticker_id=new.sticker_id and kept) then raise exception 'Cet exemplaire n’est pas dans ta collection'; end if;
 elsif (new.space_id,new.copy_owner,new.sticker_id,new.copy_no) is distinct from (old.space_id,old.copy_owner,old.sticker_id,old.copy_no) then
   raise exception 'L’identité d’un exemplaire ne peut pas changer';
 end if;
 return new;
end;$$;
revoke all on function stck_private.validate_placement_copy() from public,anon,authenticated;
create trigger validate_placement_copy before insert or update on public.placements for each row execute function stck_private.validate_placement_copy();
