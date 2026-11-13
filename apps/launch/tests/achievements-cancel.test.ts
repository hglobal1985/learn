import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { Achievement, AdminAchievement, CourseDetail, CourseSummary, Order } from "../src/contract.ts";
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

test("費用尚未公布：不能報名、不能設為完全公開、畫面旗標正確", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  const made = await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "費用待定", priceTba: true, status: "published" } });
  assert.equal(made.data.priceTba, true);
  assert.equal(made.data.free, false, "尚未公布不算免費");
  assert.equal((await call("POST", "/orders", { token: student, body: { courseIds: [made.data.id] } })).data.error !== undefined, true);
  assert.equal((await call("PATCH", `/admin/courses/${made.data.id}`, { token: admin, body: { isPublic: true } })).status, 400);
  await call("PATCH", `/admin/courses/${made.data.id}`, { token: admin, body: { priceTba: false } });
  const list = (await call<CourseSummary[]>("GET", "/courses", { token: student })).data.find((c) => c.id === made.data.id)!;
  assert.equal(list.priceTba, false);
});

test("取消報名：審核中與免費開通可以取消，已繳費開通不行；別人的報名動不了", async () => {
  const { call, login } = setup();
  const [admin, student, other] = await Promise.all(["demo-admin", "demo-student", "demo-silver"].map(login));
  // 免費課程：報名立即開通 → 可取消
  const [free] = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["start"] } })).data;
  assert.equal(free!.status, "opened");
  assert.equal((await call("POST", `/orders/${free!.id}/cancel`, { token: other })).status, 404, "別人的報名");
  assert.equal((await call("POST", `/orders/${free!.id}/cancel`, { token: student })).status, 200);
  const after = (await call<CourseSummary[]>("GET", "/courses", { token: student })).data.find((c) => c.id === "start")!;
  assert.equal(after.enrollment, null, "取消後可以重新報名");
  // 付費課程：待審核 → 可取消；管理員審核通過後 → 不行
  const paid = await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "付費課", priceTwd: 500, status: "published" } });
  const [o1] = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: [paid.data.id] } })).data;
  assert.equal(o1!.status, "pending");
  assert.equal((await call("POST", `/courses/${paid.data.id}/cancel-registration`, { token: student, body: {} })).status, 200);
  const [o2] = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: [paid.data.id] } })).data;
  await call("POST", `/admin/orders/${o2!.id}/review`, { token: admin, body: { action: "paid", paidTwd: 500 } });
  assert.equal((await call("POST", `/orders/${o2!.id}/cancel`, { token: student })).status, 409, "已繳費開通不能自行取消");
});

test("學習成就：超級管理員設定條件、會員完成課程後自動取得並通知；一般人不能設定", async () => {
  const { call, login } = setup();
  const [admin, student, pres] = await Promise.all(["demo-admin", "demo-student", "demo-president"].map(login));
  assert.equal((await call("GET", "/admin/achievements", { token: student })).status, 403);
  assert.equal((await call("GET", "/admin/achievements", { token: pres })).status, 403);
  const defs = (await call<AdminAchievement[]>("GET", "/admin/achievements", { token: admin })).data;
  assert.ok(defs.length >= 6, "內建徽章");
  // 新增一個「學完 share 課程」的徽章
  assert.equal((await call("POST", "/admin/achievements", { token: admin, body: { name: "x", type: "course_completed" } })).status, 400, "要選課程");
  const made = await call<AdminAchievement[]>("POST", "/admin/achievements", { token: admin, body: { name: "分享達人", description: "學完分享課", icon: "🎯", type: "course_completed", courseId: "start" } });
  assert.equal(made.status, 200);
  const mine0 = (await call<Achievement[]>("GET", "/me/achievements", { token: student })).data;
  assert.equal(mine0.every((a) => !a.earned), true);
  // 報名 share 並學完所有章節
  await call("POST", "/orders", { token: student, body: { courseIds: ["start"] } });
  const course = (await call<CourseDetail>("GET", "/courses/start", { token: student })).data;
  for (const l of course.lessons) await call("POST", `/courses/start/lessons/${l.id}/complete`, { token: student });
  const mine = (await call<Achievement[]>("GET", "/me/achievements", { token: student })).data;
  const byName = (n: string) => mine.find((a) => a.name === n)!;
  assert.equal(byName("初次學習").earned, true);
  assert.equal(byName("完課成就").earned, true);
  assert.equal(byName("分享達人").earned, true);
  assert.ok(byName("分享達人").earnedAt);
  assert.equal(byName("學習達人").earned, false);
  assert.ok(byName("學習達人").current < 50);
  const notes = (await call<{ title: string; link: string }[]>("GET", "/notifications", { token: student })).data;
  assert.ok(notes.some((n) => n.title === "獲得學習徽章" && n.link === "/achievements"));
  // 停用、修改、刪除
  const id = defs[0]!.id;
  await call("PATCH", `/admin/achievements/${id}`, { token: admin, body: { active: false } });
  assert.equal((await call<Achievement[]>("GET", "/me/achievements", { token: student })).data.some((a) => a.id === id), false, "停用的不顯示");
  assert.equal((await call("DELETE", `/admin/achievements/${id}`, { token: admin })).status, 200);
});
