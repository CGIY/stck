alter table public.spaces
  add column tokens integer not null default 0 check (tokens >= 0);

create table public.challenge_archive (
  space_id uuid not null references public.spaces(id) on delete cascade,
  sticker_id text not null check (sticker_id ~ '^[1-4]-0[1-8]$'),
  copy_owner uuid not null references auth.users(id) on delete cascade,
  copy_no smallint not null check (copy_no between 1 and 3),
  placed_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid not null references auth.users(id) on delete cascade,
  zone smallint not null check (zone in (0, 1)),
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  completed_at timestamptz not null,
  primary key (space_id, copy_owner, sticker_id, copy_no),
  check (placed_by <> accepted_by)
);
create index challenge_archive_recent on public.challenge_archive(space_id, completed_at desc);
alter table public.challenge_archive enable row level security;
create policy challenge_archive_members on public.challenge_archive
  for select to authenticated using (stck_private.is_member(space_id));

grant select on public.challenge_archive to authenticated;

create function stck_private.complete_challenge(
  p_space uuid, p_sticker text, p_copy_owner uuid, p_copy_no smallint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_row public.placements%rowtype;
  wallet integer;
  archived integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if not exists (
    select 1 from public.spaces where id = p_space and uid in (owner_id, partner_id)
  ) then raise exception 'Espace introuvable'; end if;

  select * into current_row from public.placements
    where space_id = p_space and sticker_id = p_sticker
      and copy_owner = p_copy_owner and copy_no = p_copy_no
    for update;

  if not found then
    if exists (select 1 from public.challenge_archive where space_id=p_space and sticker_id=p_sticker and copy_owner=p_copy_owner and copy_no=p_copy_no) then
      select tokens into wallet from public.spaces where id=p_space;
      return jsonb_build_object('archived',true,'tokens',wallet,'already_completed',true);
    end if;
    raise exception 'Ce défi a déjà évolué.';
  end if;
  if current_row.challenge_status <> 'accepted' or current_row.accepted_by is distinct from uid then
    raise exception 'Seule la personne qui a relevé le défi peut le valider.';
  end if;

  update public.placements set challenge_status='done'
    where space_id=p_space and sticker_id=p_sticker and copy_owner=p_copy_owner and copy_no=p_copy_no;

  insert into public.challenge_archive(space_id,sticker_id,copy_owner,copy_no,placed_by,accepted_by,zone,x,y,completed_at)
    select space_id,sticker_id,copy_owner,copy_no,placed_by,accepted_by,zone,x,y,completed_at
    from public.placements where space_id=p_space and sticker_id=p_sticker and copy_owner=p_copy_owner and copy_no=p_copy_no
  on conflict do nothing;
  get diagnostics archived = row_count;

  if archived = 1 then
    update public.spaces set tokens=tokens+1 where id=p_space returning tokens into wallet;
  else
    select tokens into wallet from public.spaces where id=p_space;
  end if;
  delete from public.placements where space_id=p_space and sticker_id=p_sticker and copy_owner=p_copy_owner and copy_no=p_copy_no;
  return jsonb_build_object('archived',true,'tokens',wallet,'already_completed',false);
end;
$$;
revoke all on function stck_private.complete_challenge(uuid,text,uuid,smallint) from public, anon, authenticated;
grant execute on function stck_private.complete_challenge(uuid,text,uuid,smallint) to authenticated;
create function public.complete_challenge(
  p_space uuid, p_sticker text, p_copy_owner uuid, p_copy_no smallint
) returns jsonb language sql security invoker set search_path = '' as $$
  select stck_private.complete_challenge(p_space,p_sticker,p_copy_owner,p_copy_no);
$$;
revoke all on function public.complete_challenge(uuid,text,uuid,smallint) from public, anon;
grant execute on function public.complete_challenge(uuid,text,uuid,smallint) to authenticated;

create or replace function stck_private.draw_pouch(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  sid uuid;
  sticker text;
  retained boolean;
  quantity integer;
  wallet integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select id,tokens into sid,wallet from public.spaces where uid in(owner_id,partner_id) for update;
  if sid is null then raise exception 'Rejoins votre espace avant d’ouvrir une pochette'; end if;

  select sticker_id,kept into sticker,retained from public.pouch_draws where user_id=uid and request_id=p_request;
  if sticker is not null then
    select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
    return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,'tokens',wallet);
  end if;
  if wallet < 3 then raise exception 'Il faut 3 jetons pour ouvrir une pochette (solde : %).',wallet; end if;
  if (select count(*) from public.pouch_draws where user_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'Patiente une minute avant la prochaine pochette'; end if;

  sticker:=stck_private.pick_sticker(random(),random(),random());
  select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
  retained:=quantity<3;
  update public.spaces set tokens=tokens-3 where id=sid returning tokens into wallet;
  insert into public.pouch_draws(user_id,request_id,sticker_id,kept) values(uid,p_request,sticker,retained);
  select count(*) into quantity from public.pouch_draws where user_id=uid and sticker_id=sticker and kept;
  return jsonb_build_object('sticker_id',sticker,'kept',retained,'quantity',quantity,'tokens',wallet);
end;
$$;

-- Disable the legacy free-pouch entry point so all paid draws go through the token charge.
revoke execute on function public.open_pouch(uuid) from public, anon, authenticated;
revoke execute on function stck_private.open_pouch(uuid) from public, anon, authenticated;
