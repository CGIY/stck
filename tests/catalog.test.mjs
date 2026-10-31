import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='70000000-0000-4000-8000-000000000001',B='70000000-0000-4000-8000-000000000002',legacy='71000000-0000-4000-8000-000000000001';
let db,space;
async function as(uid,sql,params=[]){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);return db.query(sql,params);}
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params);}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 // The earlier daily_stickers_consumption.sql draft was superseded by expiry.sql.
 const files=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f!=='20261030162000_daily_stickers_consumption.sql'&&!f.includes('_two_copy_cap_duplicate_tokens')&&!f.includes('_expanded_sticker_catalog')&&!f.includes('_permanent_collection_rewards')).sort();
 for(const file of files)await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 space=(await as(A,'select public.create_space() as id')).rows[0].id;
 const token=(await as(A,'select public.invite_partner() as token')).rows[0].token;await as(B,'select public.join_space($1)',[token]);
 // Upgrade a real legacy copy already placed on the collage.
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no) values($1,$2,'3-03',true,1)",[A,legacy]);
 await as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,'3-03',0,.4,.4,$2,1)",[space,A]);
 const migration=(await fs.readdir('supabase/migrations')).find(f=>f.endsWith('_expanded_sticker_catalog.sql'));
 await db.exec('reset role');await db.exec(await fs.readFile('supabase/migrations/'+migration,'utf8'));
});
after(()=>db?.close());
test('catalog upgrade preserves owned retired copies and has 55 active stickers in eight sheets',async()=>{
 const counts=(await owner('select collection_key,count(*)::int as count from stck_private.sticker_catalog where active group by collection_key order by collection_key')).rows;
 assert.deepEqual(counts,[{collection_key:'amour',count:5},{collection_key:'douceurs',count:8},{collection_key:'intimite',count:9},{collection_key:'monoprix',count:4},{collection_key:'plaisirs',count:7},{collection_key:'porn-love',count:5},{collection_key:'rouge-gorge',count:4},{collection_key:'saveurs',count:13}]);
 assert.deepEqual((await as(A,'select sticker_id,kept,copy_no from public.pouch_draws where request_id=$1',[legacy])).rows[0],{sticker_id:'3-03',kept:true,copy_no:1});
 assert.equal((await as(B,"select * from public.placements where sticker_id='3-03'")).rows.length,1);
 assert.equal((await owner("select active from stck_private.sticker_catalog where id='3-03'")).rows[0].active,false);
 assert.equal((await owner("select title from stck_private.sticker_catalog where id='4-04'")).rows[0].title,'Reproduire un film porno 1:1');
 assert.deepEqual((await owner("select id from stck_private.sticker_catalog where not active order by id")).rows.map(x=>x.id),['3-03','4-06','4-08']);
});
test('picker has independent 20% special editions / 10% rarity and reaches all four pools',async()=>{
 const counts=(await owner(`select count(*) filter(where c.rare)::int as rares,
   count(*) filter(where c.special)::int as specials,
   count(*) filter(where c.rare and c.special)::int as special_rares,
   count(*)::int as total
   from generate_series(0,99)i cross join generate_series(0,99)j
   cross join lateral(select stck_private.pick_sticker(i/100.0,j/100.0,.5) as id)p
   join stck_private.sticker_catalog c on c.id=p.id`)).rows[0];
 assert.deepEqual(counts,{rares:1000,specials:2000,special_rares:200,total:10000});
 const boundary=(await owner(`select
   (select rare from stck_private.sticker_catalog where id=stck_private.pick_sticker(.099999,0,0)) as below,
   (select rare from stck_private.sticker_catalog where id=stck_private.pick_sticker(.1,0,0)) as at_boundary,
   (select special from stck_private.sticker_catalog where id=stck_private.pick_sticker(.5,.199999,0)) as special_below,
   (select special from stck_private.sticker_catalog where id=stck_private.pick_sticker(.5,.2,0)) as main_at_boundary`)).rows[0];
 assert.deepEqual(boundary,{below:true,at_boundary:false,special_below:true,main_at_boundary:false});
 const pools=(await owner(`select rare,special,count(*)::int as count from stck_private.sticker_catalog where active group by rare,special order by rare,special`)).rows;
 assert.deepEqual(pools,[{rare:false,special:false,count:36},{rare:false,special:true,count:6},{rare:true,special:false,count:11},{rare:true,special:true,count:2}]);
 const reached=(await owner(`select count(distinct id)::int as count,bool_and(id not in ('3-03','4-06','4-08')) as no_retired from(select stck_private.pick_sticker(r,e,i/1000.0) as id from generate_series(0,999)i cross join(values(0.0),(0.5))rarity(r) cross join(values(0.0),(0.2))edition(e))samples`)).rows[0];
 assert.deepEqual(reached,{count:55,no_retired:true});
 for(const args of [[null,.5,.5],[-.1,.5,.5],[1,.5,.5],[.5,1,.5],[.5,.5,1]])await assert.rejects(owner('select stck_private.pick_sticker($1,$2,$3)',args),/Tirage invalide/);
});
test('catalog and picker are private; forged sticker IDs are rejected',async()=>{
 await assert.rejects(as(A,'select * from stck_private.sticker_catalog'),/permission denied/);
 await assert.rejects(as(A,"update stck_private.sticker_catalog set rare=true where id='1-01'"),/permission denied/);
 await assert.rejects(as(A,'select stck_private.pick_sticker(.5,.5,.5)'),/permission denied/);
 await assert.rejects(owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no) values($1,gen_random_uuid(),'99-99',true,1)",[A]),/foreign key/);
});
test('new stickers retain copy limits, paid-draw idempotency and private ownership',async()=>{
 // All active stickers have three copies, so the next paid draw is discarded.
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)select $1,gen_random_uuid(),id,now()-interval '1 day',true,n::smallint from stck_private.sticker_catalog cross join generate_series(1,3)n where active`,[A]);
 await owner('update public.spaces set tokens=6 where id=$1',[space]);
 const request='71000000-0000-4000-8000-000000000002';
 const first=(await as(A,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 const retry=(await as(A,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 assert.equal(first.kept,false);assert.equal(first.quantity,3);assert.equal(first.tokens,3);assert.equal(first.copy_no,null);assert.deepEqual(first,retry);
 assert.equal((await as(B,'select * from public.pouch_draws')).rows.length,0);
 for(const id of ['5-03','2-13','6-08','7-04','8-04']){
  await as(A,'insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,$2,0,.5,.5,$3,1)',[space,id,A]);
  const row=(await as(B,'select * from public.placements where sticker_id=$1',[id])).rows[0];assert.equal(row.copy_owner,A);assert.ok(row.copy_request_id);
 }
 await assert.rejects(as(B,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no)values($1,'7-01',0,.5,.5,$2,1)",[space,B]),/plus disponible/);
 await assert.rejects(as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no)values($1,'7-01',0,.5,.5,$2,4)",[space,A]),/plus disponible|check constraint/);
});
test('new rare challenge archives once, rewards one token and frees its copy slot',async()=>{
 await as(B,"update public.placements set challenge_status='accepted',accepted_by=$1 where sticker_id='7-04'",[B]);
 const copy=(await as(B,"select copy_request_id from public.placements where sticker_id='7-04'")).rows[0].copy_request_id;
 const params=[space,'7-04',A,1,copy];
 const first=(await as(B,'select public.complete_challenge($1,$2,$3,$4::smallint,$5) as result',params)).rows[0].result;
 const retry=(await as(B,'select public.complete_challenge($1,$2,$3,$4::smallint,$5) as result',params)).rows[0].result;
 assert.equal(first.archived,true);assert.equal(first.already_completed,false);assert.equal(retry.already_completed,true);assert.equal(first.tokens,retry.tokens);
 assert.deepEqual((await as(A,'select kept,copy_no from public.pouch_draws where request_id=$1',[copy])).rows[0],{kept:false,copy_no:null});
 assert.equal((await as(A,"select * from public.challenge_archive where sticker_id='7-04'")).rows.length,1);
});
