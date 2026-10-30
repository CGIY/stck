alter table public.placements
  add column challenge_status text not null default 'open'
    check (challenge_status in ('open', 'accepted', 'done')),
  add column accepted_by uuid,
  add column completed_at timestamptz,
  add constraint placements_challenge_progress_check check (
    (challenge_status = 'open' and accepted_by is null and completed_at is null)
    or (challenge_status = 'accepted' and accepted_by is not null and completed_at is null)
    or (challenge_status = 'done' and accepted_by is not null and completed_at is not null)
  );

create function stck_private.validate_challenge_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.challenge_status <> 'open' or new.accepted_by is not null or new.completed_at is not null then
      raise exception 'Un challenge commence en attente.';
    end if;
    return new;
  end if;

  if new.challenge_status is not distinct from old.challenge_status then
    if new.accepted_by is distinct from old.accepted_by
      or new.completed_at is distinct from old.completed_at then
      raise exception 'Le suivi du challenge ne peut changer que par une transition valide.';
    end if;
    return new;
  end if;

  if old.challenge_status = 'open' and new.challenge_status = 'accepted' then
    if auth.uid() is null or auth.uid() = old.placed_by then
      raise exception 'Seul l’autre participant peut relever ce challenge.';
    end if;
    new.accepted_by := auth.uid();
    new.completed_at := null;
    return new;
  end if;

  if old.challenge_status = 'accepted' and new.challenge_status = 'open' then
    if auth.uid() is distinct from old.accepted_by then
      raise exception 'Seule la personne qui a accepté peut changer son choix.';
    end if;
    new.accepted_by := null;
    new.completed_at := null;
    return new;
  end if;

  if old.challenge_status = 'accepted' and new.challenge_status = 'done' then
    if auth.uid() is distinct from old.accepted_by then
      raise exception 'Seule la personne qui a accepté peut marquer ce challenge comme réalisé.';
    end if;
    new.accepted_by := old.accepted_by;
    new.completed_at := now();
    return new;
  end if;

  raise exception 'Transition de challenge invalide.';
end;
$$;

revoke all on function stck_private.validate_challenge_progress() from public, anon, authenticated;
create trigger z_validate_challenge_progress
before insert or update of challenge_status, accepted_by, completed_at on public.placements
for each row execute function stck_private.validate_challenge_progress();
