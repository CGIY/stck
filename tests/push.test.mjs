import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedEndpoint,
  constantTimeEqual,
} from "../supabase/functions/push-dispatch/validation.js";
test("push only reaches recognized HTTPS providers", () => {
  for (const u of [
    "https://fcm.googleapis.com/fcm/send/token",
    "https://web.push.apple.com/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
  ])
    assert.equal(isAllowedEndpoint(u), true, u);
  for (const u of [
    "http://fcm.googleapis.com/token",
    "https://fcm.googleapis.com.attacker.test/token",
    "https://127.0.0.1/token",
    "https://fcm.googleapis.com:444/token",
    "https://user@web.push.apple.com/token",
    "file:///tmp/x",
  ])
    assert.equal(isAllowedEndpoint(u), false, u);
});
test("dispatch secret comparison rejects truncated and mismatched values", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "ab"), false);
  assert.equal(constantTimeEqual("abc", "abd"), false);
});
