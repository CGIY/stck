-- Collections begin empty. Retire the automatic starter-pack path so an
-- authenticated participant cannot receive an unrequested first batch.
drop function if exists public.grant_starter_pouches();
drop function if exists stck_private.grant_starter_pouches();
drop table if exists stck_private.starter_pouch_grants;
