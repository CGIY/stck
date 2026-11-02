import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='a0000000-0000-4000-8000-000000000001',B='a0000000-0000-4000-8000-000000000002';
const copy='a1000000-0000-4000-8000-000000000001',retiredCopy='a1000000-0000-4000-8000-000000000002';
let db,space,migration,oldRewards,oldDraws,oldPlacements;
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params);}
async function as(uid,sql,params=[]){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);return db.query(sql,params);}
async function rewards(uid){return (await as(uid,'select * from public.collection_rewards()')).rows;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const files=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f!=='20261030162000_daily_stickers_consumption.sql'&&!f.includes('_small_collection_sheets')).sort();
 for(const file of files)await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 space=(await as(A,'select public.create_space() as id')).rows[0].id;
 const invitation=(await as(A,'select public.invite_partner() as token')).rows[0].token;await as(B,'select public.join_space($1)',[invitation]);
 // Real old-sheet history: copies have been used but old badges are permanent.
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)
   select $1,gen_random_uuid(),id,'2026-10-01'::timestamptz+display_order*interval '1 day',false,null
   from stck_private.sticker_catalog where active and collection_key in ('amour','saveurs')`,[A]);
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no) values($1,$2,'1-02',true,2),($1,$3,'2-07',true,1)",[A,copy,retiredCopy]);
 await as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no)values($1,'1-02',0,.4,.6,$2,2),($1,'2-07',0,.6,.4,$2,1)",[space,A]);
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)
   select $1,gen_random_uuid(),id,false,null from stck_private.sticker_catalog where not active`,[B]);
 await owner('update public.spaces set tokens=17 where id=$1',[space]);
 oldRewards=await rewards(A);
 oldDraws=(await owner('select * from public.pouch_draws order by user_id,request_id')).rows;
 oldPlacements=(await owner('select * from public.placements order by sticker_id')).rows;
 migration=await fs.readFile('supabase/migrations/'+(await fs.readdir('supabase/migrations')).find(f=>f.endsWith('_small_collection_sheets.sql')),'utf8');
 await db.exec('begin;'+migration+'commit;');
});
after(()=>db?.close());
test('approved catalogue has exactly seventeen sheets of four, 68 active / 15 rare, with seven special editions',async()=>{
 const counts=(await owner('select collection_key,count(*)::int as count from stck_private.sticker_catalog where active group by collection_key')).rows;
 assert.equal(counts.length,17);assert.equal(counts.reduce((n,row)=>n+row.count,0),68);assert.ok(counts.every(row=>row.count===4));
 const pools=(await owner('select rare,special,count(*)::int as count from stck_private.sticker_catalog where active group by rare,special order by rare,special')).rows;
 assert.deepEqual(pools,[{rare:false,special:false,count:32},{rare:false,special:true,count:21},{rare:true,special:false,count:8},{rare:true,special:true,count:7}]);
 const catalogue=JSON.parse(await fs.readFile('src/catalog.json','utf8')),collections=JSON.parse(await fs.readFile('src/collections.json','utf8'));
 assert.equal(collections.length,17);assert.equal(collections.filter(x=>x.special).length,7);
 assert.ok(collections.filter(x=>x.special).every(x=>x.logo));assert.ok(collections.filter(x=>!x.special).every(x=>!x.logo));
 assert.equal(collections.find(x=>x.key==='jouet-enchante').title,'Le Jouet Enchanté');
 assert.equal(collections.find(x=>x.key==='jouet-enchante').logo,'assets/jouet-enchante-rubber.webp');
 assert.equal(collections.find(x=>x.key==='columbus-cafe').logo,'assets/columbus-cafe-rubber.webp');
 assert.equal(collections.some(x=>x.key==='colombus-jeux'),false);
 const keys=new Map(collections.map(row=>[row.id,row.key]));
 const server=(await owner('select id,collection_key,title,rare from stck_private.sticker_catalog where active')).rows;
 for(const row of server){const item=catalogue.find(item=>item.id===row.id);assert.ok(item);assert.equal(keys.get(item.collection),row.collection_key);assert.equal(item.title,row.title);assert.equal(item.rare,row.rare);}
 assert.equal(catalogue.filter(x=>x.active).length,68);
});
test('edition and rarity remain independently 20% / 10% and all four pools are reachable',async()=>{
 const counts=(await owner(`select count(*)filter(where c.rare)::int as rares,count(*)filter(where c.special)::int as special,
   count(*)filter(where c.rare and c.special)::int as both from generate_series(0,99)i cross join generate_series(0,99)j
   cross join lateral(select stck_private.pick_sticker(i/100.0,j/100.0,.5) as id)p
   join stck_private.sticker_catalog c on c.id=p.id`)).rows[0];
 assert.deepEqual(counts,{rares:1000,special:2000,both:200});
 const reached=(await owner(`select count(distinct id)::int as count from(select stck_private.pick_sticker(r,e,i/1000.0) as id from generate_series(0,999)i cross join(values(0.0),(0.5))rarity(r) cross join(values(0.0),(0.2))edition(e))samples`)).rows[0];assert.equal(reached.count,68);
});
test('upgrade preserves stock, retired placements, tokens and old earned badges without conversion',async()=>{
 assert.deepEqual((await owner('select * from public.pouch_draws order by user_id,request_id')).rows,oldDraws);
 assert.deepEqual((await owner('select * from public.placements order by sticker_id')).rows,oldPlacements);
 assert.equal((await as(A,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,17);
 const current=await rewards(A);for(const old of oldRewards)assert.deepEqual(current.find(row=>row.collection_key===old.collection_key),old);
 assert.deepEqual(oldRewards.map(row=>row.collection_key).sort(),['amour','saveurs']);
 assert.equal((await owner("select active from stck_private.sticker_catalog where id='2-07'")).rows[0].active,false);
 assert.equal((await owner("select active from stck_private.sticker_catalog where id='1-01'")).rows[0].active,false);
});
test('existing lifetime history backfills newly due four-sticker badges idempotently',async()=>{
 assert.deepEqual((await rewards(A)).map(row=>row.collection_key).sort(),['amour','fast-food','saveurs']);
 assert.deepEqual(await rewards(B),[]);
 const before=await rewards(A);await db.exec('reset role;begin;'+migration+'commit;');assert.deepEqual(await rewards(A),before);
 assert.equal((await as(A,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,17);
});
test('the existing draw trigger awards a new complete sheet permanently and privately',async()=>{
 for(const id of ['2-02','2-09','2-10'])await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),$2,false,null)",[B,id]);
 assert.deepEqual(await rewards(B),[]);
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'2-11',false,null)",[B]);
 let result=await rewards(B);assert.equal(result.length,1);assert.equal(result[0].collection_key,'fast-food');const earned=result[0].earned_at;
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'2-11',false,null)",[B]);
 result=await rewards(B);assert.equal(result.length,1);assert.deepEqual(result[0].earned_at,earned);
 assert.equal((await as(B,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,17);
 await assert.rejects(as(B,'select * from stck_private.collection_rewards'),/permission denied/);
});
test('all new sticker IDs still obey the two-copy cap and one-token duplicate compensation',async()=>{
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)
   select $1,gen_random_uuid(),id,now()-interval '1 day',true,n::smallint
   from stck_private.sticker_catalog c cross join generate_series(1,2)n where active
   and not exists(select 1 from public.pouch_draws d where d.user_id=$1 and d.sticker_id=c.id and d.kept and d.copy_no=n)`,[B]);
 const request='a2000000-0000-4000-8000-000000000001';
 const first=(await as(B,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 assert.equal(first.kept,false);assert.equal(first.quantity,2);assert.equal(first.duplicate_tokens,1);assert.equal(first.tokens,15);
 assert.deepEqual((await as(B,'select public.draw_pouch($1) as result',[request])).rows[0].result,first);
 assert.equal((await rewards(B)).length,17);
 await assert.rejects(owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'10-17',true,3)",[B]),/check constraint/);
});
