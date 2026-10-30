alter table public.spaces alter column tokens set default 3;

update public.spaces s
set tokens = 3
where s.tokens = 0
  and not exists (
    select 1 from public.pouch_draws d
    where d.user_id in (s.owner_id, s.partner_id)
  )
  and not exists (
    select 1 from public.placements p where p.space_id = s.id
  )
  and not exists (
    select 1 from public.challenge_archive a where a.space_id = s.id
  );
