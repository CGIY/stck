-- Replace the provisional grouping with the approved seventeen four-sticker
-- sheets. Existing sticker IDs, copies, collages, draws and earned badges survive.
-- Refuse a busy write window immediately rather than waiting while holding
-- catalogue locks against a concurrent draw/challenge transaction.
lock table stck_private.sticker_catalog in access exclusive mode nowait;
lock table public.pouch_draws in share row exclusive mode nowait;

alter table stck_private.sticker_catalog
  drop constraint sticker_catalog_collection_key_check,
  add constraint sticker_catalog_collection_key_check
    check(collection_key in ('amour','douceurs','saveurs','plaisirs','intimite','porn-love','rouge-gorge','monoprix','massage','soin','fast-food','patissier','canape','la-pussy','la-tchole','porno','online','vinted','passage-du-desir','leclerc-multimedia','jouet-enchante','columbus-cafe'));
alter table stck_private.collection_rewards
  drop constraint collection_rewards_collection_key_check,
  add constraint collection_rewards_collection_key_check
    check(collection_key in ('amour','douceurs','saveurs','plaisirs','intimite','porn-love','rouge-gorge','monoprix','massage','soin','fast-food','patissier','canape','la-pussy','la-tchole','porno','online','vinted','passage-du-desir','leclerc-multimedia','jouet-enchante','columbus-cafe'));

-- This private derived field has no independent player state. Rebuild its
-- expression to include all seven special editions; the picker keeps its
-- independent 20% edition and 10% rarity thresholds, unchanged.
alter table stck_private.sticker_catalog drop column special;
alter table stck_private.sticker_catalog add column special boolean
  generated always as (collection_key in ('vinted','passage-du-desir','leclerc-multimedia','jouet-enchante','columbus-cafe','rouge-gorge','monoprix')) stored;

-- Retired illustrations remain valid historical references and owned copies.
update stck_private.sticker_catalog set active=false
where id not in ('5-01','5-02','1-05','5-03','1-02','1-03','1-04','1-07','9-01','9-02','1-06','1-08','2-02','2-09','2-10','2-11','2-03','2-12','2-13','9-03','2-05','9-04','2-04','2-06','4-02','9-05','6-05','6-06','6-03','4-05','9-06','9-07','4-04','9-08','4-07','6-08','4-03','9-09','6-07','9-10','10-01','10-02','10-03','10-04','10-05','10-06','10-07','10-08','3-06','10-09','10-10','10-11','10-12','10-13','3-04','10-14','2-01','10-15','10-16','10-17','7-01','7-02','7-03','7-04','8-01','8-02','8-03','8-04');
insert into stck_private.sticker_catalog
  (id,collection_key,title,rare,active,display_order)
values
  ('5-01', 'amour', 'Bisou avec la langue', false, true, 1),
  ('5-02', 'amour', 'Câlin (accolade)', false, true, 2),
  ('1-05', 'amour', 'Mot doux à cacher', false, true, 3),
  ('5-03', 'amour', 'Message d’amour sincère', true, true, 4),
  ('1-02', 'massage', 'Massage de la tête', false, true, 1),
  ('1-03', 'massage', 'Massage des épaules', false, true, 2),
  ('1-04', 'massage', 'Massage des cuisses', false, true, 3),
  ('1-07', 'massage', 'Massage total', true, true, 4),
  ('9-01', 'soin', 'Pose de vernis', false, true, 1),
  ('9-02', 'soin', 'Masque (soin)', false, true, 2),
  ('1-06', 'soin', 'Soin complet du visage', false, true, 3),
  ('1-08', 'soin', 'Soirée complète de soin', true, true, 4),
  ('2-02', 'fast-food', 'Burger', false, true, 1),
  ('2-09', 'fast-food', 'Pizza', false, true, 2),
  ('2-10', 'fast-food', 'Sushi', false, true, 3),
  ('2-11', 'fast-food', 'Kébab', false, true, 4),
  ('2-03', 'patissier', 'Faire un cake', false, true, 1),
  ('2-12', 'patissier', 'Faire des cookies', false, true, 2),
  ('2-13', 'patissier', 'Faire des crêpes', false, true, 3),
  ('9-03', 'patissier', 'Faire une tarte', false, true, 4),
  ('2-05', 'canape', 'Petit-déjeuner sur canapé', false, true, 1),
  ('9-04', 'canape', 'Petit goûter sur canapé', false, true, 2),
  ('2-04', 'canape', 'Chocolat du soir et canapé', false, true, 3),
  ('2-06', 'canape', 'Apéro sur canapé', false, true, 4),
  ('4-02', 'la-pussy', 'Léchage de chatte', false, true, 1),
  ('9-05', 'la-pussy', 'Sit face total', false, true, 2),
  ('6-05', 'la-pussy', 'Massage Nuru', false, true, 3),
  ('6-06', 'la-pussy', 'Lovense', true, true, 4),
  ('6-03', 'la-tchole', 'Fellation', false, true, 1),
  ('4-05', 'la-tchole', 'Faciale', false, true, 2),
  ('9-06', 'la-tchole', 'Dans la bouche', false, true, 3),
  ('9-07', 'la-tchole', 'Avale', true, true, 4),
  ('4-04', 'porno', 'Reproduction porn 1:1', false, true, 1),
  ('9-08', 'porno', 'Anal penetration', false, true, 2),
  ('4-07', 'porno', 'Golden Shower', true, true, 3),
  ('6-08', 'porno', 'Double pénétration', true, true, 4),
  ('4-03', 'online', 'Boobs on reddit', false, true, 1),
  ('9-09', 'online', 'Pussy on reddit', false, true, 2),
  ('6-07', 'online', 'Webcam show', false, true, 3),
  ('9-10', 'online', 'Faciale on reddit', true, true, 4),
  ('10-01', 'vinted', 'Vinted - de 10 euros', false, true, 1),
  ('10-02', 'vinted', 'Vinted Chemise', false, true, 2),
  ('10-03', 'vinted', 'Vinted Jupe', false, true, 3),
  ('10-04', 'vinted', 'Vinted Robe', true, true, 4),
  ('10-05', 'passage-du-desir', 'Gel de massage', false, true, 1),
  ('10-06', 'passage-du-desir', 'Bougie basse température', false, true, 2),
  ('10-07', 'passage-du-desir', 'Dildo double densité Loulou Dildou', false, true, 3),
  ('10-08', 'passage-du-desir', 'Bora-Bora va et vient', true, true, 4),
  ('3-06', 'leclerc-multimedia', 'Achat d’un livre', false, true, 1),
  ('10-09', 'leclerc-multimedia', 'Achat d’un roman graphique', false, true, 2),
  ('10-10', 'leclerc-multimedia', 'Achat d’un manga', false, true, 3),
  ('10-11', 'leclerc-multimedia', 'Achat d’un jeu vidéo', true, true, 4),
  ('10-12', 'jouet-enchante', 'Achat d’un petit jeu de carte (15-20 euros)', false, true, 1),
  ('10-13', 'jouet-enchante', 'Achat d’un jeu d’ambiance (20 euros)', false, true, 2),
  ('3-04', 'jouet-enchante', 'Achat d’un jeu de société normal (30-40 euros)', false, true, 3),
  ('10-14', 'jouet-enchante', 'Achat d’un gros jeu (+60 euros)', true, true, 4),
  ('2-01', 'columbus-cafe', 'Petit café', false, true, 1),
  ('10-15', 'columbus-cafe', 'Muffin', false, true, 2),
  ('10-16', 'columbus-cafe', 'Petit café et Muffin', false, true, 3),
  ('10-17', 'columbus-cafe', 'Menu complet', true, true, 4),
  ('7-01', 'rouge-gorge', 'Soutien-gorge', false, true, 1),
  ('7-02', 'rouge-gorge', 'Culotte', false, true, 2),
  ('7-03', 'rouge-gorge', 'Body', false, true, 3),
  ('7-04', 'rouge-gorge', 'Ensemble', true, true, 4),
  ('8-01', 'monoprix', 'Chaussettes', false, true, 1),
  ('8-02', 'monoprix', 'T-shirt', false, true, 2),
  ('8-03', 'monoprix', 'Pantalon / jupe', false, true, 3),
  ('8-04', 'monoprix', 'Robe', true, true, 4)
on conflict(id) do update set
  collection_key=excluded.collection_key,title=excluded.title,rare=excluded.rare,
  active=excluded.active,display_order=excluded.display_order;

-- The existing completion trigger reads these new memberships automatically.
-- Backfill newly completed sheets from all lifetime discoveries, including
-- consumed draws. Older badges retain their exact original dates and keys.
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
