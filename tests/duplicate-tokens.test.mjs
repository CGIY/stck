import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='90000000-0000-4000-8000-000000000001',B='90000000-0000-4000-8000-000000000002',C='90000000-0000-4000-8000-000000000003';
let db,space,other,capMigration;
async function as(uid,sql,params=[]){await db.exec(`reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`);return db.query(sql,params);}
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params);}
async function setup(database){
 await database.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}'),('${C}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 const files=(await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f!=='20261030162000_daily_stickers_consumption.sql'&&!f.includes('_two_copy_cap_duplicate_tokens')).sort();
 for(const file of files)await database.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
}
before(async()=>{
 db=new PGlite();await setup(db);
 capMigration=await fs.readFile('supabase/migrations/'+(await fs.readdir('supabase/migrations')).find(f=>f.endsWith('_two_copy_cap_duplicate_tokens.sql')),'utf8');
 await db.exec('begin;'+capMigration+'commit;');
 space=(await as(A,'select public.create_space() as id')).rows[0].id;
 const token=(await as(A,'select public.invite_partner() as token')).rows[0].token;await as(B,'select public.join_space($1)',[token]);
 other=(await as(C,'select public.create_space() as id')).rows[0].id;
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)
   select $1,gen_random_uuid(),id,now()-interval '1 day',true,n::smallint
   from stck_private.sticker_catalog cross join generate_series(1,2)n where active`,[A]);
 await owner('update public.spaces set tokens=6 where id=$1',[space]);
});
after(()=>db?.close());
test('two copies are retained; third paid copy credits one token once despite ten retries',async()=>{
 const request='91000000-0000-4000-8000-000000000001';
 const draw=async()=> (await as(A,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 const first=await draw();assert.equal(first.kept,false);assert.equal(first.quantity,2);assert.equal(first.copy_no,null);assert.equal(first.duplicate_tokens,1);assert.equal(first.tokens,4);
 for(let i=0;i<10;i++)assert.deepEqual(await draw(),first);
 assert.equal((await as(B,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,4);
 assert.equal((await as(C,'select tokens from public.spaces where id=$1',[other])).rows[0].tokens,3);
 const stored=(await as(A,'select kept,duplicate_tokens from public.pouch_draws where request_id=$1',[request])).rows[0];assert.deepEqual(stored,{kept:false,duplicate_tokens:1});
 await assert.rejects(owner("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'1-01',true,3)",[A]),/check constraint/);
 await assert.rejects(as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no)values($1,'1-01',0,.5,.5,$2,3)",[space,A]),/plus disponible|check constraint/);
});
test('daily duplicate credits the shared wallet once and retries stay claimed:false',async()=>{
 const claim=async()=> (await as(A,'select public.claim_daily_pouch() as result')).rows[0].result;
 const first=await claim();assert.equal(first.claimed,true);assert.equal(first.kept,false);assert.equal(first.quantity,2);assert.equal(first.duplicate_tokens,1);assert.equal(first.tokens,5);
 for(let i=0;i<10;i++){const retry=await claim();assert.equal(retry.claimed,false);assert.equal(retry.sticker_id,first.sticker_id);assert.equal(retry.duplicate_tokens,1);assert.equal(retry.tokens,5);}
 assert.equal((await as(B,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,5);
 assert.equal((await as(A,'select public.daily_pouch_available() as available')).rows[0].available,false);
});
test('a retained daily sticker grants no token and rewards remain private',async()=>{
 const first=(await as(B,'select public.claim_daily_pouch() as result')).rows[0].result;
 assert.equal(first.claimed,true);assert.equal(first.kept,true);assert.equal(first.quantity,1);assert.equal(first.copy_no,1);assert.equal(first.duplicate_tokens,0);assert.equal(first.tokens,5);
 assert.equal((await as(B,'select * from public.pouch_draws')).rows.length,1);
 const outsider=(await as(C,'select public.claim_daily_pouch() as result')).rows[0].result;assert.equal(outsider.kept,true);assert.equal(outsider.duplicate_tokens,0);assert.equal(outsider.tokens,3);
 await assert.rejects(as(B,"insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no,duplicate_tokens)values($1,gen_random_uuid(),'1-01',false,null,1)",[B]),/permission denied/);
});
test('the partner can receive a duplicate refund in the same wallet, not the other account inventory',async()=>{
 await owner(`insert into public.pouch_draws(user_id,request_id,sticker_id,created_at,kept,copy_no)
   select $1,gen_random_uuid(),id,now()-interval '1 day',true,n::smallint
   from stck_private.sticker_catalog c cross join generate_series(1,2)n where active
   and not exists(select 1 from public.pouch_draws d where d.user_id=$1 and d.sticker_id=c.id and d.kept and d.copy_no=n)`,[B]);
 const draw=(await as(B,"select public.draw_pouch('91000000-0000-4000-8000-000000000002') as result")).rows[0].result;
 assert.equal(draw.kept,false);assert.equal(draw.duplicate_tokens,1);assert.equal(draw.tokens,3);
 assert.equal((await as(A,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,3);
 assert.equal((await as(C,'select tokens from public.spaces where id=$1',[other])).rows[0].tokens,3);
});
test('the ten-per-minute limit, prepayment requirement and request replay remain enforced',async()=>{
 await owner('update public.spaces set tokens=100 where id=$1',[space]);
 // A already has one paid and one daily draw in the current minute.
 for(let i=0;i<8;i++)await as(A,'select public.draw_pouch($1)',[`92000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]);
 await assert.rejects(as(A,"select public.draw_pouch('92000000-0000-4000-8000-000000000009')"),/Patiente une minute/);
 assert.equal((await as(B,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,84);
 const replay=(await as(A,"select public.draw_pouch('91000000-0000-4000-8000-000000000001') as result")).rows[0].result;
 assert.equal(replay.duplicate_tokens,1);assert.equal(replay.tokens,84);
 await owner('update public.spaces set tokens=2 where id=$1',[space]);
 await assert.rejects(as(B,"select public.draw_pouch('92000000-0000-4000-8000-000000000010')"),/Il faut 3 jetons/);
 assert.equal((await as(B,'select tokens from public.spaces where id=$1',[space])).rows[0].tokens,2);
});
test('migration refuses an active third copy without deleting or converting it',async()=>{
 const legacyDb=new PGlite();
 try{
  await setup(legacyDb);
  await legacyDb.query("insert into public.pouch_draws(user_id,request_id,sticker_id,kept,copy_no)values($1,gen_random_uuid(),'1-01',true,3)",[A]);
  await assert.rejects(legacyDb.exec('begin;'+capMigration+'commit;'),/troisième copie est encore active/);
  await legacyDb.exec('rollback');
  const rows=(await legacyDb.query("select kept,copy_no from public.pouch_draws where sticker_id='1-01'")).rows;assert.deepEqual(rows,[{kept:true,copy_no:3}]);
  assert.equal((await legacyDb.query("select * from information_schema.columns where table_schema='public' and table_name='pouch_draws' and column_name='duplicate_tokens'")).rows.length,0);
 }finally{await legacyDb.close();}
});
