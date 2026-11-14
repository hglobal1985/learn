import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, CourseSummary } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

test("播放超過 1%：納入學習中（含沒有報名紀錄的管理員）；可隱藏，再播又回來", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub })).data.token;
  const admin = await login("demo-admin");
  const student = await login("demo-student");
  const created = (await call<CourseDetail>("POST", "/admin/courses", admin, { title: "免費課", priceTwd: 0, isPublic: true })).data;
  await call("PATCH", `/admin/courses/${created.id}`, admin, { status: "published" });
  const lessonId = (await call<CourseDetail>("GET", `/courses/${created.id}`, admin)).data.lessons[0]!.id;
  const find = async (token: string) => (await call<CourseSummary[]>("GET", "/courses", token)).data.find((c) => c.id === created.id)!;

  // 管理員（不會產生報名紀錄）還沒播放：不在學習中
  assert.equal((await find(admin)).started, false);
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${lessonId}/started`, admin)).status, 200);
  let c = await find(admin);
  assert.equal(c.started, true);
  assert.equal(c.enrollment, null);
  assert.equal(c.hiddenFromLearning, false);

  // 隱藏 → 再播放超過 1% 又回來
  assert.equal((await call("POST", `/courses/${created.id}/hide-learning`, admin)).status, 200);
  assert.equal((await find(admin)).hiddenFromLearning, true);
  await call("POST", `/courses/${created.id}/lessons/${lessonId}/started`, admin);
  assert.equal((await find(admin)).hiddenFromLearning, false);

  // 學員：公開免費課程播放後自動報名＋列入
  assert.equal((await find(student)).started, false);
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${lessonId}/started`, student)).status, 200);
  c = await find(student);
  assert.equal(c.started, true);
  assert.equal(c.enrollment, "opened");
  // 沒登入不行
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${lessonId}/started`)).status, 401);
});
