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

test("播放進度：沒看完的章節也讓課程進度前進（只進不退），看完後以完成為準", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const admin = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-admin" })).data.token;
  const student = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-student" })).data.token;
  const created = (await call<CourseDetail>("POST", "/admin/courses", admin, { title: "進度課", priceTwd: 0, isPublic: true })).data;
  await call("PATCH", `/admin/courses/${created.id}`, admin, { status: "published" });
  // 第一堂（預設空白章節）＋第二堂；兩堂都設長度，方便驗算
  const l2 = (await call<CourseDetail>("POST", `/admin/courses/${created.id}/lessons`, admin, { title: "第二堂" })).data.lessons;
  const [a, b] = [l2[0]!, l2[1]!];
  await call("PATCH", `/admin/lessons/${a.id}`, admin, { minutes: 10 });
  await call("PATCH", `/admin/lessons/${b.id}`, admin, { minutes: 10 });
  const pct = async () => (await call<CourseSummary[]>("GET", "/courses", student)).data.find((c) => c.id === created.id)!.progressPercent;

  assert.equal((await call<CourseSummary[]>("GET", "/courses", student)).data.find((c) => c.id === created.id)!.paid, false); // 價格 0＝不是付費課程
  assert.equal(await pct(), 0);
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${a.id}/watch`, student, { ratio: 0.5 })).status, 200);
  assert.equal(await pct(), 25); // 20 分鐘裡看了 5 分鐘
  const mine = (await call<CourseSummary[]>("GET", "/courses", student)).data.find((c) => c.id === created.id)!;
  assert.match(mine.lastLearnedAt ?? "", /^\d{4}-\d{2}-\d{2}T/); // 最近一次學習時間（學習中依此排序）
  await call("POST", `/courses/${created.id}/lessons/${a.id}/watch`, student, { ratio: 0.2 }); // 倒轉重看：不退步
  assert.equal(await pct(), 25);
  await call("POST", `/courses/${created.id}/lessons/${b.id}/watch`, student, { ratio: 1 });
  assert.equal(await pct(), 75);
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${a.id}/watch`, student, { ratio: -1 })).status, 400);
  assert.equal((await call("POST", `/courses/${created.id}/lessons/${a.id}/watch`, undefined, { ratio: 0.5 })).status, 401);
  // 看完第一堂：以完成計（不重複加上播放比例）
  await call("POST", `/courses/${created.id}/lessons/${a.id}/complete`, student);
  assert.equal(await pct(), 100); // 第一堂完成＋第二堂播放到 100%＝兩堂都滿
});

test("搜尋索引：已上架課程的章節標題、分享者與日期（未上架不出現）", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const admin = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-admin" })).data.token;
  const pub = (await call<CourseDetail>("POST", "/admin/courses", admin, { title: "上架課", priceTwd: 0 })).data;
  const draft = (await call<CourseDetail>("POST", "/admin/courses", admin, { title: "草稿課", priceTwd: 0 })).data;
  await call("PATCH", `/admin/courses/${pub.id}`, admin, { status: "published" });
  await call("POST", `/admin/courses/${pub.id}/lessons`, admin, { title: "搜尋章節", sharer: "李講師", sharerTitle: "經理", eventDate: "2026-11-03" });
  await call("POST", `/admin/courses/${draft.id}/lessons`, admin, { title: "不該出現" });
  const r = await call<{ lessons: { courseId: string; title: string; sharer: string; sharerTitle: string; eventDate: string | null }[] }>("GET", "/search-index");
  assert.equal(r.status, 200); // 不用登入
  assert.ok(r.data.lessons.some((l) => l.courseId === pub.id && l.title === "搜尋章節" && l.sharer === "李講師" && l.sharerTitle === "經理" && l.eventDate === "2026-11-03"));
  assert.ok(!r.data.lessons.some((l) => l.courseId === draft.id));
});
