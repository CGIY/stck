-- One continuous board. Existing half-board coordinates keep their positions.
update public.placements set x=(zone+x)/2, zone=0;
alter table public.placements drop constraint placements_zone_check,
  drop constraint placements_x_check, drop constraint placements_y_check;
alter table public.placements add constraint placements_zone_check check(zone=0),
  add constraint placements_x_check check(x between -0.5 and 1.5),
  add constraint placements_y_check check(y between -0.5 and 1.5),
  add column placed_by uuid references auth.users(id) on delete set null;
create index placements_placed_by_idx on public.placements(placed_by);

-- The author comes from the session and survives later moves by either person.
create function stck_private.stamp_placement_author() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then new.placed_by=auth.uid();
  else new.placed_by=old.placed_by;
  end if;
  return new;
end;
$$;
revoke all on function stck_private.stamp_placement_author() from public, anon, authenticated;
create trigger stamp_placement_author before insert or update on public.placements
for each row execute function stck_private.stamp_placement_author();
