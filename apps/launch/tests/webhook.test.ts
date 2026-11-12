import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { verifyWebhook } from "../src/central.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

const SECRET = "test-webhook-secret";
const sign = (ts: number, raw: string, secret = SECRET) => `v1=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;

function setup(withSecret = true) {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", ...(withSecret ? { CENTRAL_WEBHOOK_SECRET: SECRET } : {}) };
  const post = async (event: Record<string, unknown>, opts: { ts?: number; sig?: string; secret?: string } = {}) => {
    const raw = JSON.stringify(event);
    const ts = opts.ts ?? Math.floor(Date.now() / 1000);
    const res = await handleApi(
      new Request("https://learn.test/api/v2/central/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hg-timestamp": String(ts), "x-hg-signature": opts.sig ?? sign(ts, raw, opts.secret) },
        body: raw,
      }),
      env,
    );
    return { status: res.status, data: (await res.json()) as Record<string, unknown> };
  };
  return { env, post };
}

test("驗簽：正確通過；金鑰錯、內容被改、時間過期都拒絕", async () => {
  const raw = '{"id":"e1"}';
  const now = Date.now();
  const ts = Math.floor(now / 1000);
  assert.equal(await verifyWebhook(SECRET, String(ts), sign(ts, raw), raw, now), true);
  assert.equal(await verifyWebhook(SECRET, String(ts), sign(ts, raw, "other"), raw, now), false);
  assert.equal(await verifyWebhook(SECRET, String(ts), sign(ts, raw), raw + " ", now), false);
  assert.equal(await verifyWebhook(SECRET, String(ts - 301), sign(ts - 301, raw), raw, now), false);
  assert.equal(await verifyWebhook(SECRET, null, null, raw, now), false);
});

test("webhook：測試事件回 200、簽章錯回 401、沒設金鑰回 503", async () => {
  const { post } = setup();
  assert.equal((await post({ id: "t1", type: "webhook.test", app_id: "learn", member_id: "m" })).status, 200);
  assert.equal((await post({ id: "t2", type: "webhook.test" }, { secret: "wrong" })).status, 401);
  assert.equal((await post({ id: "t3", type: "webhook.test", app_id: "other" })).status, 400);
  assert.equal((await setup(false).post({ id: "t4", type: "webhook.test" })).status, 503);
});

test("webhook：會員刪除帳號 → 清掉該會員在行動大學的資料；同一事件重送只處理一次", async () => {
  const { env, post } = setup();
  const sub = "00000000-0000-4000-8000-000000000001";
  await env.DB.prepare("INSERT INTO member_contacts (member_sub, is_admin) VALUES (?, 0)").bind(sub).run();
  await env.DB.prepare("INSERT INTO notifications (id, recipient_sub, title) VALUES ('n1', ?, 't')").bind(sub).run();
  const ev = { id: "d1", type: "member.deleted", app_id: "learn", member_id: sub };
  assert.equal((await post(ev)).status, 200);
  const left = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM member_contacts WHERE member_sub = ?) + (SELECT COUNT(*) FROM notifications WHERE recipient_sub = ?) AS n").bind(sub, sub).first<{ n: number }>();
  assert.equal(left?.n, 0);
  assert.equal((await post(ev)).data.duplicate, true);
  assert.equal((await post({ id: "p1", type: "member.profile_changed", app_id: "learn", member_id: sub, fields: ["contact_email"] })).status, 200);
  assert.equal((await post({ id: "x1", type: "future.event", app_id: "learn", member_id: sub })).status, 200);
});
