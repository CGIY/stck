import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='80000000-0000-4000-8000-000000000001',B='80000000-0000-4000-8000-000000000002';
let db;
async function as(uid,sql,params=[]){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);return db.query(sql,params);}
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params);}
async function rewards(uid){return (await as(uid,'select * from public.collection_rewards()')).rows;}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const files=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f!=='20261030162000_daily_stickers_consumption.sql'&&!f.includes('_two_copy_cap_duplicate_tokens')&&!f.includes('_permanent_collection_rewards')).sort();
 for(const file of files)await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 // Before the reward migration, one lifetime-complete collection has no copies
 // left in stock. A second user has all but the rare and must not get a reward.
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)
   select $1,gen_random_uuid(),id,'2026-10-01'::timestamptz+display_order*interval '1 day',false,null
   from stck_private.sticker_catalog where collection_key='amour' and active`,[A]);
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)
   select $1,gen_random_uuid(),id,false,null from stck_private.sticker_catalog where collection_key='amour' and active and not rare`,[B]);
 const migration=(await fs.readdir('supabase/migrations')).find(f=>f.endsWith('_permanent_collection_rewards.sql'));
 await db.exec('reset role');await db.exec(await fs.readFile('supabase/migrations/'+migration,'utf8'));
});
after(()=>db?.close());
test('completion backfill uses lifetime discoveries even when every copy was consumed',async()=>{
 const rows=await rewards(A);assert.equal(rows.length,1);assert.equal(rows[0].collection_key,'amour');
 assert.equal(new Date(rows[0].earned_at).toISOString(),'2026-10-06T00:00:00.000Z');
 assert.equal((await as(A,'select * from public.pouch_draws where kept')).rows.length,0);
 assert.deepEqual(await rewards(B),[]);
});
test('the final discovery awards once and consumed copies keep the permanent reward',async()=>{
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)
   select $1,gen_random_uuid(),id,true,1 from stck_private.sticker_catalog
   where collection_key='rouge-gorge' and active and not rare`,[A]);
 assert.deepEqual((await rewards(A)).map(r=>r.collection_key),['amour']);
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'7-04',true,1)",[A]);
 const earned=(await rewards(A)).find(r=>r.collection_key==='rouge-gorge').earned_at;
 await owner("update public.pouch_draws set kept=false,copy_no=null where user_id=$1 and sticker_id like '7-%'",[A]);
 await owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'7-04',false,null)",[A]);
 const rows=await rewards(A);assert.equal(rows.length,2);assert.deepEqual(rows.find(r=>r.collection_key==='rouge-gorge').earned_at,earned);
 assert.equal((await as(A,"select * from public.pouch_draws where kept and sticker_id like '7-%'")).rows.length,0);
});
test('rewards are personal and cannot be forged, retargeted, or queried anonymously',async()=>{
 assert.deepEqual(await rewards(B),[]);
 await assert.rejects(as(B,'select * from stck_private.collection_rewards'),/permission denied/);
 await assert.rejects(as(B,"insert into stck_private.collection_rewards(user_id,collection_key)values($1,'saveurs')",[B]),/permission denied/);
 await assert.rejects(as(B,"delete from stck_private.collection_rewards where user_id=$1",[A]),/permission denied/);
 await assert.rejects(as(B,'select * from public.collection_rewards($1)',[A]),/does not exist/);
 await db.exec("reset role;set request.jwt.claim.sub='';set role authenticated;");
 await assert.rejects(db.query('select * from public.collection_rewards()'),/Connexion requise/);
 await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.collection_rewards()'),/permission denied/);
});

test('the new Monoprix special sheet receives its own permanent reward',async()=>{
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)
   select $1,gen_random_uuid(),id,false,null from stck_private.sticker_catalog
   where collection_key='monoprix' and active`,[B]);
 const rows=await rewards(B);assert.equal(rows.length,1);assert.equal(rows[0].collection_key,'monoprix');
 assert.equal((await rewards(A)).some(row=>row.collection_key==='monoprix'),false);
});
