import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { setCentralFetch } from "../src/central.ts";
import type { NotificationSettings, Order } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

type Sent = { to: string; subject: string; text: string; from: { email: string } };

/** 模擬中央：服務金鑰換 token、聯絡信箱查詢（信箱放在測試自己的表，不經過行動大學的資料庫）。 */
function fakeCentral(emails: Map<string, string>, lookups: string[][] = []) {
  setCentralFetch(async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith("/v1/service/token")) return Response.json(body.client_secret === "svc-secret" ? { access_token: "svc-token", token_type: "Bearer", expires_in: 300 } : { error: { code: "unauthenticated" } }, { status: body.client_secret === "svc-secret" ? 200 : 401 });
    if (url.endsWith("/contacts/lookup")) {
      lookups.push(body.member_ids);
      const contacts = (body.member_ids as string[]).filter((i) => emails.has(i)).map((i) => ({ member_id: i, email: emails.get(i), email_verified: false }));
      return Response.json({ contacts, not_found: [] });
    }
    return new Response("{}", { status: 404 });
  });
}

function setup(withMail = true) {
  const sent: Sent[] = [];
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", CENTRAL_SERVICE_SECRET: "svc-secret", ...(withMail ? { EMAIL_FROM: "noreply@mail.example.test", EMAIL: { send: async (m) => void sent.push(m as unknown as Sent) } } : {}) };
  const call = async <T = Record<string, unknown>,>(method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, {
        method,
        headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", { body: { sub } })).data.token;
  return { call, login, sent, env };
}

test("通知設定：驗證格式、可關閉 Email、刪除資料時一併刪副本", async () => {
  const { call, login } = setup();
  const t = await login("demo-student");
  assert.equal((await call<NotificationSettings>("GET", "/me/notification-settings", { token: t })).data.email, null);
  assert.equal((await call("PUT", "/me/notification-settings", { token: t, body: { email: "不是信箱" } })).status, 400);
  const ok = await call<NotificationSettings>("PUT", "/me/notification-settings", { token: t, body: { email: "Student@Example.com" } });
  assert.deepEqual([ok.data.email, ok.data.notifyEmail, ok.data.emailReady], ["student@example.com", true, true]);
  assert.equal((await call<NotificationSettings>("PUT", "/me/notification-settings", { token: t, body: { notifyEmail: false } })).data.notifyEmail, false);
  await call("DELETE", "/me", { token: t });
  const t2 = await login("demo-student");
  assert.equal((await call<NotificationSettings>("GET", "/me/notification-settings", { token: t2 })).data.email, null);
});

test("Email 通知：依設定寄給學員與總部，關閉者不寄；沒綁定寄信時不寄", async () => {
  const { call, login, sent, env } = setup();
  const lookups: string[][] = [];
  fakeCentral(new Map([["demo-admin", "hq@example.com"], ["demo-student", "stu@example.com"], ["demo-outsider", "out@example.com"]]), lookups);
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  void student;
  // 非寰宇學員報名付費課 → 通知總部（角色型通知）
  const outsider = await login("demo-outsider");
  await Promise.all([admin, outsider].map((t) => call("GET", "/me", { token: t })));
  const [o] = (await call<Order[]>("POST", "/orders", { token: outsider, body: { courseIds: ["share"] } })).data;
  assert.ok(o, "已建立報名");
  assert.ok(sent.some((m) => m.to === "hq@example.com" && /待審核/.test(m.subject)), "總部收到信");
  assert.ok(sent.every((m) => m.from.email === "noreply@mail.example.test"));
  // 審核通過 → 通知學員本人
  const before = sent.length;
  await call("POST", `/admin/orders/${o.id}/review`, { token: admin, body: { action: "paid", paidTwd: 0 } });
  assert.ok(sent.slice(before).some((m) => m.to === "out@example.com" && /課程已開通/.test(m.subject)));
  // 關閉 Email → 不再寄
  await call("PUT", "/me/notification-settings", { token: outsider, body: { notifyEmail: false } });
  const n = sent.length;
  await call("POST", `/orders/${o.id}/events`, { token: admin, body: { message: "測試留言" } });
  assert.equal(sent.length, n);
});

test("沒有寄信綁定：API 照常運作、不寄信", async () => {
  const { call, login, sent } = setup(false);
  const t = await login("demo-student");
  assert.equal((await call<NotificationSettings>("GET", "/me/notification-settings", { token: t })).data.emailReady, false);
  await call("PUT", "/me/notification-settings", { token: t, body: { email: "a@example.com" } });
  assert.equal(sent.length, 0);
});

test("信箱不保存：寄信時才向中央查；沒有服務金鑰或中央查不到就不寄", async () => {
  const { call, login, sent, env } = setup();
  const lookups: string[][] = [];
  fakeCentral(new Map([["demo-admin", "hq@example.com"]]), lookups);
  const admin = await login("demo-admin");
  const outsider = await login("demo-outsider");
  await Promise.all([admin, outsider].map((t) => call("GET", "/me", { token: t })));
  await call("POST", "/orders", { token: outsider, body: { courseIds: ["share"] } });
  assert.ok(sent.some((m) => m.to === "hq@example.com"), "透過中央查到總部信箱後寄出");
  assert.ok(lookups.length > 0);
  const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM member_contacts WHERE email IS NOT NULL").first<{ n: number }>();
  assert.equal(rows?.n, 0, "資料庫沒有任何信箱副本");
  // 中央金鑰錯誤 → 不寄
  const n = sent.length;
  env.CENTRAL_SERVICE_SECRET = "wrong";
  await call("POST", `/orders/x/events`, { token: admin, body: { message: "x" } });
  assert.equal(sent.length, n);
});
