-- Rare stickers now have a 10% chance per pouch draw, shared equally among
-- the eight rare stickers in the current catalog.
create or replace function stck_private.pick_sticker(
  p_rarity double precision,
  p_collection double precision,
  p_item double precision
) returns text
language plpgsql immutable security invoker set search_path='' as $$
begin
  if p_rarity<0 or p_rarity>=1 or p_collection<0 or p_collection>=1 or p_item<0 or p_item>=1 then
    raise exception 'Tirage invalide';
  end if;
  return (1+floor(p_collection*4))::int::text||'-0'||
    (case when p_rarity<0.1 then 7+floor(p_item*2) else 1+floor(p_item*6) end)::int::text;
end;
$$;
revoke all on function stck_private.pick_sticker(double precision,double precision,double precision) from public,anon,authenticated;
