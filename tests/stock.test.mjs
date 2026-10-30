import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db,space;
const A='10000000-0000-4000-8000-000000000001', B='10000000-0000-4000-8000-000000000002';
async function as(id,sql,params=[]) { await db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`); return db.query(sql,params); }
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['20261030100716_stck_core.sql','20261030150446_stck_free_board.sql','20261030151214_stck_rare_odds.sql']) await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 space=(await as(A,'select public.create_space() as id')).rows[0].id;
 const token=(await as(A,'select public.invite_partner() as token')).rows[0].token;
 await as(B,'select public.join_space($1)',[token]);
});
after(()=>db?.close());
test('rare threshold is exactly 1% of the unit interval',async()=>{
 await db.exec('reset role');
 const result=await db.query("select count(*) filter(where right(stck_private.pick_sticker(i/10000.0,0.4,0.5),1) in ('7','8')) as rares from generate_series(0,9999) i");
 assert.equal(Number(result.rows[0].rares),100);
 const bounds=await db.query("select stck_private.pick_sticker(0.009999,0,0) as rare,stck_private.pick_sticker(0.01,0,0) as common");
 assert.equal(bounds.rows[0].rare,'1-07');assert.equal(bounds.rows[0].common,'1-01');
});
test('fourth copy is discarded and retry keeps the same outcome',async()=>{
 await db.exec('reset role');
 await db.query("insert into public.pouch_draws(user_id,request_id,sticker_id,created_at) select $1,gen_random_uuid(),c||'-0'||i,now()-interval '1 day' from generate_series(1,4)c cross join generate_series(1,8)i cross join generate_series(1,3)n",[A]);
 const request='20000000-0000-4000-8000-000000000001';
 const first=(await as(A,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 const second=(await as(A,'select public.draw_pouch($1) as result',[request])).rows[0].result;
 assert.deepEqual(first,second);assert.equal(first.kept,false);assert.equal(first.quantity,3);
 assert.equal(Number((await as(A,'select count(*) from public.pouch_draws where kept')).rows[0].count),96);
 assert.equal(Number((await as(B,'select count(*) from public.pouch_draws')).rows[0].count),0);
 await assert.rejects(as(A,"insert into public.pouch_draws values($1,gen_random_uuid(),'1-01',now(),true)",[A]),/permission denied/);
});
test('three distinct copies can be placed, moved by the partner, but not forged',async()=>{
 for(let copy=1;copy<=3;copy++) await as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,'1-01',0,$2,0.5,$3,$4)",[space,copy/5,A,copy]);
 assert.equal((await as(B,"select * from public.placements where sticker_id='1-01'")).rows.length,3);
 await as(B,"update public.placements set x=-0.1,y=1.1,placed_by=$1 where copy_no=2",[B]);
 const row=(await as(A,'select * from public.placements where copy_no=2')).rows[0];
 assert.equal(row.placed_by,A);assert.equal(row.copy_owner,A);assert.ok(row.x<0);
 await assert.rejects(as(B,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,'1-02',0,0.5,0.5,$2,1)",[space,A]),/ne t’appartient/);
 await assert.rejects(as(B,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,'1-02',0,0.5,0.5,$2,1)",[space,B]),/pas dans ta collection/);
 await assert.rejects(as(A,"insert into public.placements(space_id,sticker_id,zone,x,y,copy_owner,copy_no) values($1,'1-01',0,0.5,0.5,$2,4)",[space,A]),/pas dans ta collection|check constraint/);
 await assert.rejects(as(B,'update public.placements set copy_owner=$1 where copy_no=2',[B]),/identité/);
});
