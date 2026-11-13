import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, Playback } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup() {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
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
  return { call, login };
}

test("完全公開：訪客可看免費且已上架的公開課程與章節；其他一律要求登入；付費課程不能公開", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  const made = await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "公開講座", priceTwd: 0, status: "published", isPublic: true } });
  assert.equal(made.status, 200);
  assert.equal(made.data.isPublic, true);
  const id = made.data.id;
  const lessonId = made.data.lessons[0]!.id;

  // 訪客：能看介紹、章節沒有鎖、能取得播放授權
  const guest = await call<CourseDetail>("GET", `/courses/${id}`);
  assert.equal(guest.status, 200);
  assert.equal(guest.data.lessons[0]!.locked, false);
  assert.equal(guest.data.enrollment, null);
  assert.equal((await call<Playback>("GET", `/courses/${id}/lessons/${lessonId}/playback`)).status, 200);

  // 沒有公開的課程：訪客一律 401
  assert.equal((await call("GET", "/courses/share")).status, 401);
  assert.equal((await call("GET", "/courses/share/lessons/share-welcome/playback")).status, 401);
  // 公開但未上架：訪客看不到
  await call("PATCH", `/admin/courses/${id}`, { token: admin, body: { status: "draft" } });
  assert.equal((await call("GET", `/courses/${id}`)).status, 401);
  await call("PATCH", `/admin/courses/${id}`, { token: admin, body: { status: "published" } });
  // 付費課程不能設為公開，公開課程也不能改成付費
  assert.equal((await call("POST", "/admin/courses", { token: admin, body: { title: "付費公開", priceTwd: 100, isPublic: true } })).status, 400);
  assert.equal((await call("PATCH", `/admin/courses/${id}`, { token: admin, body: { priceTwd: 100 } })).status, 400);
  // 關閉公開後訪客又看不到
  await call("PATCH", `/admin/courses/${id}`, { token: admin, body: { isPublic: false } });
  assert.equal((await call("GET", `/courses/${id}`)).status, 401);
});

test("活動日期：課程與每一則章節都可設定、清除，格式錯誤會被擋", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  const made = await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "有日期", eventStart: "2026-12-05" } });
  assert.equal(made.data.eventStart, "2026-12-05");
  const added = await call<CourseDetail>("POST", `/admin/courses/${made.data.id}/lessons`, { token: admin, body: { title: "第二堂", eventDate: "2026-12-06" } });
  assert.deepEqual(added.data.lessons.map((l) => l.eventDate), ["2026-12-05", "2026-12-06"], "第 1 堂沿用課程開始日");
  const lid = added.data.lessons[0]!.id;
  const first = async () => (await call<CourseDetail>("GET", `/courses/${made.data.id}`, { token: admin })).data.lessons[0]!.eventDate;
  assert.equal((await call("PATCH", `/admin/lessons/${lid}`, { token: admin, body: { eventDate: "2026-12-05" } })).status, 200);
  assert.equal(await first(), "2026-12-05");
  assert.equal((await call("PATCH", `/admin/lessons/${lid}`, { token: admin, body: { eventDate: "12/05" } })).status, 400);
  assert.equal((await call("PATCH", `/admin/lessons/${lid}`, { token: admin, body: { eventDate: null } })).status, 200);
  assert.equal(await first(), null);
});
