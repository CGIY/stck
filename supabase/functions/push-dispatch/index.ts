import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";
import { isAllowedEndpoint, constantTimeEqual } from "./validation.js";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  try {
    const { data: config, error } = await db.rpc("dispatch_config");
    if (error || !config)
      return new Response("Not configured", { status: 503 });
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!constantTimeEqual(token, config.dispatch_secret))
      return new Response("Unauthorized", { status: 401 });
    const queued = await db.rpc("queue_notifications");
    if (queued.error) throw queued.error;
    const { data: jobs, error: claimError } = await db.rpc("claim_push_batch");
    if (claimError) throw claimError;
    webpush.setVapidDetails(
      config.subject,
      config.vapid_public,
      config.vapid_private,
    );
    let sent = 0,
      failed = 0;
    for (const job of jobs) {
      let status = 400;
      if (isAllowedEndpoint(job.endpoint)) {
        try {
          const response = await webpush.sendNotification(
            { endpoint: job.endpoint, keys: job.keys },
            JSON.stringify({ title: job.title, body: job.body, tag: job.tag }),
            { TTL: 3600, timeout: 10000, urgency: "normal" },
          );
          status = response.statusCode;
        } catch (error) {
          status = Number((error as { statusCode?: number }).statusCode) || 503;
        }
      }
      const ack = await db.rpc("finish_push", {
        p_notification: job.notification_id,
        p_subscription: job.subscription_id,
        p_lease: job.lease,
        p_status: status,
      });
      if (ack.error) throw ack.error;
      if (status >= 200 && status < 300) sent++;
      else failed++;
    }
    return Response.json({ sent, failed });
  } catch {
    console.error("STCK push dispatch failed");
    return new Response("Dispatch failed", { status: 500 });
  }
});
