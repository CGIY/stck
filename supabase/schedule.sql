-- Run only after securely provisioning stck_private.push_config.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('stck-push-dispatch','* * * * *', $$
 select net.http_post(url=>c.function_url,
 headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.dispatch_secret),
 body=>'{}'::jsonb,timeout_milliseconds=>60000)
 from stck_private.push_config c where singleton;
$$);
