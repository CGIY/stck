-- Eight sheets: the existing sticker IDs remain stable across the reorganisation.
-- Retired entries stay addressable for existing draws, collages and archives.
create table stck_private.sticker_catalog (
  id text primary key check (id ~ '^[1-9][0-9]*-[0-9]{2}$'),
  collection_key text not null check (collection_key in
    ('amour','douceurs','saveurs','plaisirs','intimite','porn-love','rouge-gorge','monoprix')),
  special boolean generated always as (collection_key in ('rouge-gorge','monoprix')) stored,
  title text not null check (length(title) between 1 and 120),
  rare boolean not null,
  active boolean not null default true,
  display_order smallint not null check (display_order > 0)
);
alter table stck_private.sticker_catalog enable row level security;
revoke all on stck_private.sticker_catalog from public, anon, authenticated;

insert into stck_private.sticker_catalog
  (id, collection_key, title, rare, active, display_order)
values
  ('1-01', 'amour', 'Bisou', false, true, 1),
  ('5-01', 'amour', 'Bisou avec la langue', false, true, 2),
  ('5-02', 'amour', 'Câlin (accolade)', false, true, 3),
  ('1-05', 'amour', 'Mot doux à cacher', false, true, 4),
  ('5-03', 'amour', 'Message d’amour sincère', true, true, 5),
  ('1-02', 'douceurs', 'Massage de la tête', false, true, 1),
  ('1-03', 'douceurs', 'Massage des épaules', false, true, 2),
  ('1-09', 'douceurs', 'Massage des mains', false, true, 3),
  ('1-10', 'douceurs', 'Massage des oreilles', false, true, 4),
  ('1-04', 'douceurs', 'Massage des cuisses', false, true, 5),
  ('1-06', 'douceurs', 'Soin complet du visage', false, true, 6),
  ('1-07', 'douceurs', 'Massage total', true, true, 7),
  ('1-08', 'douceurs', 'Soirée massage et soin', true, true, 8),
  ('2-01', 'saveurs', 'Café en ville', false, true, 1),
  ('2-02', 'saveurs', 'Burger', false, true, 2),
  ('2-09', 'saveurs', 'Pizza', false, true, 3),
  ('2-10', 'saveurs', 'Sushi', false, true, 4),
  ('2-11', 'saveurs', 'Kébab', false, true, 5),
  ('2-03', 'saveurs', 'Faire un gâteau', false, true, 6),
  ('2-12', 'saveurs', 'Faire des cookies', false, true, 7),
  ('2-13', 'saveurs', 'Faire des crêpes', false, true, 8),
  ('2-04', 'saveurs', 'Chocolat et canapé', false, true, 9),
  ('2-05', 'saveurs', 'Petit-déjeuner', false, true, 10),
  ('2-06', 'saveurs', 'Apéro sur canapé', false, true, 11),
  ('2-07', 'saveurs', 'Restaurant', true, true, 12),
  ('2-08', 'saveurs', 'Repas complet à la maison', true, true, 13),
  ('3-01', 'plaisirs', 'Petit cadeau en ville', false, true, 1),
  ('3-02', 'plaisirs', 'Cadeau moyen en ville', false, true, 2),
  ('3-04', 'plaisirs', 'Achat d’un jeu de société', false, true, 3),
  ('3-05', 'plaisirs', 'Achat d’un vêtement de seconde main', false, true, 4),
  ('3-06', 'plaisirs', 'Achat d’un livre', false, true, 5),
  ('3-07', 'plaisirs', 'Cadeau à 50 euros', true, true, 6),
  ('3-08', 'plaisirs', 'Tatouage', true, true, 7),
  ('6-01', 'intimite', 'Envoi d’une nude', false, true, 1),
  ('4-01', 'intimite', 'Masturbation avec éjaculation', false, true, 2),
  ('4-02', 'intimite', 'Léchage de chatte', false, true, 3),
  ('6-02', 'intimite', 'Séance photo nues', false, true, 4),
  ('6-03', 'intimite', 'Fellation', false, true, 5),
  ('4-05', 'intimite', 'Faciale', false, true, 6),
  ('6-05', 'intimite', 'Massage Nuru', false, true, 7),
  ('6-04', 'intimite', 'Plug anal', true, true, 8),
  ('6-06', 'intimite', 'Lovense', true, true, 9),
  ('4-03', 'porn-love', 'Exhib en ligne Reddit', false, true, 1),
  ('6-07', 'porn-love', 'Exhib en ligne WebCam', false, true, 2),
  ('4-04', 'porn-love', 'Reproduire un film porno 1:1', false, true, 3),
  ('4-06', 'porn-love', 'Séance photo', false, false, 99),
  ('4-08', 'porn-love', 'Lovense', false, false, 100),
  ('4-07', 'porn-love', 'Golden Shower', true, true, 6),
  ('6-08', 'porn-love', 'Double pénétration', true, true, 7),
  ('7-01', 'rouge-gorge', 'Soutien-gorge', false, true, 1),
  ('7-02', 'rouge-gorge', 'Culotte', false, true, 2),
  ('7-03', 'rouge-gorge', 'Body', false, true, 3),
  ('7-04', 'rouge-gorge', 'Ensemble', true, true, 4),
  ('8-01', 'monoprix', 'Chaussettes', false, true, 1),
  ('8-02', 'monoprix', 'T-shirt', false, true, 2),
  ('8-03', 'monoprix', 'Pantalon / jupe', false, true, 3),
  ('8-04', 'monoprix', 'Robe', true, true, 4),
  ('3-03', 'plaisirs', 'Cadeau surprise en ville', false, false, 99);

-- Foreign keys replace the obsolete four-sheets/eight-items regular expressions.
-- No user-owned rows are renumbered, deleted or marked as used.
alter table public.pouch_draws
  drop constraint pouch_draws_sticker_id_check,
  add constraint pouch_draws_sticker_catalog_fk
    foreign key (sticker_id) references stck_private.sticker_catalog(id);
alter table public.placements
  drop constraint placements_sticker_id_check,
  add constraint placements_sticker_catalog_fk
    foreign key (sticker_id) references stck_private.sticker_catalog(id);
alter table public.challenge_archive
  drop constraint challenge_archive_sticker_id_check,
  add constraint challenge_archive_sticker_catalog_fk
    foreign key (sticker_id) references stck_private.sticker_catalog(id);

-- Index the referencing columns to keep catalogue integrity checks inexpensive.
create index pouch_draws_sticker_catalog_reference on public.pouch_draws(sticker_id);
create index placements_sticker_catalog_reference on public.placements(sticker_id);
create index challenge_archive_sticker_catalog_reference on public.challenge_archive(sticker_id);

-- Preserve the three-argument internal API used by both paid and daily pouches.
-- Edition and rarity are independent: 20% special editions, 80% main sheets;
-- within either edition group, 10% rare and 90% common. Each sticker has an
-- equal share of its edition/rarity pool, independent of sheet size.
create or replace function stck_private.pick_sticker(
  p_rarity double precision,
  p_collection double precision,
  p_item double precision
) returns text
language plpgsql stable security invoker set search_path='' as $$
declare
  is_rare boolean;
  is_special boolean;
  pool_size integer;
  result text;
begin
  if p_rarity is null or p_collection is null or p_item is null
    or p_rarity < 0 or p_rarity >= 1
    or p_collection < 0 or p_collection >= 1
    or p_item < 0 or p_item >= 1 then
    raise exception 'Tirage invalide';
  end if;
  is_rare := p_rarity < 0.1;
  is_special := p_collection < 0.2;
  select count(*) into pool_size from stck_private.sticker_catalog
    where active and rare = is_rare and special = is_special;
  if pool_size = 0 then raise exception 'Catalogue de stickers indisponible'; end if;
  select id into result from stck_private.sticker_catalog
    where active and rare = is_rare and special = is_special order by id
    limit 1 offset floor(p_item * pool_size)::integer;
  return result;
end;
$$;
revoke all on function stck_private.pick_sticker(double precision,double precision,double precision)
  from public, anon, authenticated;
