import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { NotificationSettings, Order } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

type Sent = { to: string; subject: string; text: string; from: { email: string } };

function setup(withMail = true) {
  const sent: Sent[] = [];
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", ...(withMail ? { EMAIL_FROM: "noreply@mail.example.test", EMAIL: { send: async (m) => void sent.push(m as unknown as Sent) } } : {}) };
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
  const { call, login, sent } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  await call("PUT", "/me/notification-settings", { token: admin, body: { email: "hq@example.com" } });
  await call("PUT", "/me/notification-settings", { token: student, body: { email: "stu@example.com" } });
  // 非寰宇學員報名付費課 → 通知總部（角色型通知）
  const outsider = await login("demo-outsider");
  await call("PUT", "/me/notification-settings", { token: outsider, body: { email: "out@example.com" } });
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
