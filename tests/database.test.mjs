import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  C = "00000000-0000-4000-8000-000000000003";
let space;
async function as(uid, sql, params = []) {
  await db.exec(
    `reset role;set request.jwt.claim.sub='${uid}';set role authenticated;`,
  );
  return db.query(sql, params);
}
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}'),('${C}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await fs.readFile(
      "supabase/migrations/20261030100716_stck_core.sql",
      "utf8",
    ),
  );
  await db.exec(
    await fs.readFile(
      "supabase/migrations/20261030150446_stck_free_board.sql",
      "utf8",
    ),
  );
});
after(async () => db?.close());
test("spaces, invitations and cross-account isolation", async () => {
  space = (await as(A, "select public.create_space('A','B') as id")).rows[0].id;
  assert.equal(
    (await as(A, "select public.create_space() as id")).rows[0].id,
    space,
  );
  assert.equal((await as(C, "select * from public.spaces")).rows.length, 0);
  await assert.rejects(
    as(
      C,
      "insert into public.placements(space_id,sticker_id,zone,x,y) values($1,'1-01',0,0.5,0.5)",
      [space],
    ),
    /row-level security/,
  );
  const token = (await as(A, "select public.invite_partner() as token")).rows[0]
    .token;
  await assert.rejects(
    as(B, "select public.join_space($1)", ["bad-token"]),
    /invalide/,
  );
  assert.equal(
    (await as(B, "select public.join_space($1) as id", [token])).rows[0].id,
    space,
  );
  await assert.rejects(
    as(C, "select public.join_space($1)", [token]),
    /invalide/,
  );
  await as(
    B,
    "insert into public.placements(space_id,sticker_id,zone,x,y) values($1,'1-01',0,0.3,0.7)",
    [space],
  );
  assert.equal((await as(A, "select * from public.placements")).rows.length, 1);
  assert.equal((await as(C, "select * from public.placements")).rows.length, 0);
  await assert.rejects(
    as(B, "update public.spaces set owner_id=$1 where id=$2", [B, space]),
    /permission denied/,
  );
});
test("pouch retries are idempotent; ownership cannot be forged", async () => {
  const request = "00000000-0000-4000-9000-000000000001";
  const one = (
    await as(A, "select public.open_pouch($1) as sticker", [request])
  ).rows[0].sticker;
  assert.match(one, /^[1-4]-0[1-8]$/);
  assert.equal(
    (await as(A, "select public.open_pouch($1) as sticker", [request])).rows[0]
      .sticker,
    one,
  );
  assert.equal(
    (await as(A, "select * from public.pouch_draws")).rows.length,
    1,
  );
  assert.equal(
    (await as(B, "select * from public.pouch_draws")).rows.length,
    0,
  );
  await assert.rejects(
    as(
      A,
      "insert into public.pouch_draws values($1,gen_random_uuid(),'1-01',now())",
      [A],
    ),
    /permission denied/,
  );
});
test("notification preferences, subscriptions and inbox are private", async () => {
  await as(
    A,
    "insert into public.notification_preferences(user_id,daily,news) values($1,false,true)",
    [A],
  );
  await assert.rejects(
    as(A, "insert into public.notification_preferences(user_id) values($1)", [
      B,
    ]),
    /row-level security/,
  );
  await assert.rejects(
    as(
      A,
      "update public.notification_preferences set timezone='Invalid/Timezone'",
    ),
    /Fuseau/,
  );
  await as(
    A,
    "insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://web.push.apple.com/token',repeat('a',87),repeat('b',22))",
    [A],
  );
  assert.equal(
    (await as(B, "select * from public.push_subscriptions")).rows.length,
    0,
  );
  await assert.rejects(
    as(A, "select public.dispatch_config()"),
    /permission denied/,
  );
  await assert.rejects(
    as(A, "select * from stck_private.push_config"),
    /permission denied/,
  );
  await assert.rejects(
    as(A, "select public.queue_notifications()"),
    /permission denied/,
  );
  await assert.rejects(
    as(
      A,
      "insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://127.0.0.1/token',repeat('a',87),repeat('b',22))",
      [A],
    ),
    /check constraint/,
  );
});
test("delivery queue deduplicates, locks and cancels after opt-out", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.announcements(title,body) values('Nouveau','À découvrir')",
  );
  await db.exec("set role service_role");
  await db.query("select public.queue_notifications()");
  await db.query("select public.queue_notifications()");
  let batch = (await db.query("select public.claim_push_batch() as jobs"))
    .rows[0].jobs;
  assert.equal(batch.length, 1);
  assert.equal(
    (await db.query("select public.claim_push_batch() as jobs")).rows[0].jobs
      .length,
    0,
  );
  const job = batch[0];
  await db.query("select public.finish_push($1,$2,$3,503)", [
    job.notification_id,
    job.subscription_id,
    job.lease,
  ]);
  await as(A, "update public.notification_preferences set news=false");
  await db.exec("reset role;set role service_role");
  await db.query("select public.queue_notifications()");
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from stck_private.push_deliveries")).rows.length,
    0,
  );
});
test("notification content is immutable to users; read state is writable", async () => {
  await as(A, "update public.notifications set read_at=now()");
  await assert.rejects(
    as(A, "update public.notifications set body='forged'"),
    /permission denied/,
  );
  assert.equal(
    (await as(B, "select * from public.notifications")).rows.length,
    0,
  );
});

test("reminders survive midnight and daylight saving changes without moving the local hour", async () => {
  await db.exec("reset role");
  const key = async (now, time, zone) =>
    (
      await db.query(
        "select stck_private.reminder_key($1,$2,$3)::text as day",
        [now, time, zone],
      )
    ).rows[0].day;
  assert.equal(
    await key("2026-10-31T23:02:00Z", "23:59", "Europe/Paris"),
    "2026-10-31",
  );
  assert.equal(
    await key("2026-10-25T17:31:00Z", "18:30", "Europe/Paris"),
    "2026-10-25",
  );
  assert.equal(
    await key("2026-10-24T16:31:00Z", "18:30", "Europe/Paris"),
    "2026-10-24",
  );
  assert.equal(
    await key("2026-10-25T18:00:00Z", "18:30", "Europe/Paris"),
    null,
  );
});

test("free board accepts overflow and keeps the original author", async () => {
  await as(
    A,
    "insert into public.placements(space_id,sticker_id,zone,x,y,placed_by) values($1,'2-01',0,-0.1,1.1,$2)",
    [space, B],
  );
  let row = (
    await as(B, "select * from public.placements where sticker_id='2-01'")
  ).rows[0];
  assert.equal(row.placed_by, A);
  await as(
    B,
    "update public.placements set x=0.8,placed_by=$1 where sticker_id='2-01'",
    [B],
  );
  row = (await as(A, "select * from public.placements where sticker_id='2-01'"))
    .rows[0];
  assert.equal(row.placed_by, A);
  assert.ok(Math.abs(row.x - 0.8) < 0.00001);
  await assert.rejects(
    as(B, "update public.placements set x=10 where sticker_id='2-01'"),
    /check constraint/,
  );
  await assert.rejects(
    as(
      C,
      "insert into public.placements(space_id,sticker_id,zone,x,y) values($1,'2-02',0,0,0)",
      [space],
    ),
    /row-level security/,
  );
});
