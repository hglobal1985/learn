import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, CourseSummary, Notice, Order } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup() {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown,>(method: string, path: string, opts: { token?: string; body?: unknown; platform?: string } = {}) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.platform) headers["x-client-platform"] = opts.platform;
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", { body: { sub } })).data.token;
  return { call, login };
}

test("未登入可看課程目錄，但不能領課", async () => {
  const { call } = setup();
  const list = await call<CourseSummary[]>("GET", "/courses");
  assert.equal(list.status, 200);
  assert.equal(list.data.length, 6);
  assert.equal(list.data[0].eligible, false);
  assert.equal((await call("POST", "/orders", { body: { courseIds: ["start"] } })).status, 401);
});

test("免費課程立即開通，重複領取被拒絕，並通知學員", async () => {
  const { call, login } = setup();
  const token = await login("demo-student");
  const r = await call<Order[]>("POST", "/orders", { token, body: { courseIds: ["start"] }, platform: "ios" });
  assert.equal(r.status, 200);
  assert.equal(r.data[0].status, "opened");
  const detail = await call<CourseDetail>("GET", "/courses/start", { token });
  assert.equal(detail.data.enrollment, "opened");
  assert.equal((await call("POST", "/orders", { token, body: { courseIds: ["start"] } })).status, 409);
  const notices = await call<Notice[]>("GET", "/notifications", { token });
  assert.equal(notices.data[0].title, "課程已開通");
});

test("一次報名多門：免費立即開通、付費待審；沒有窗口時通知總部；審核通過後開通並通知學員", async () => {
  const { call, login } = setup();
  const student = await login("demo-student");
  const admin = await login("demo-admin");
  const r = await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["start", "lead"] } });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 2, "每門課各一筆報名");
  const paid = r.data.find((o) => o.status === "pending")!;
  assert.equal(paid.totalTwd, 1280);
  assert.equal(paid.centerLabel, "台北中心");
  assert.equal(r.data.find((o) => o.status === "opened")!.items[0].courseId, "start");
  assert.equal((await call("POST", "/orders", { token: student, body: { courseIds: ["lead"] } })).status, 409, "待審報名不可重複送出");
  const adminNotices = await call<Notice[]>("GET", "/notifications", { token: admin });
  assert.equal(adminNotices.data.filter((n) => n.title.startsWith("有新的報名待審核")).length, 1);
  assert.equal((await call("POST", `/admin/orders/${paid.id}/review`, { token: student, body: { action: "paid" } })).status, 404, "學員看不到審核功能");
  assert.equal((await call("POST", `/admin/orders/${paid.id}/review`, { token: admin, body: { action: "paid" }, platform: "android" })).status, 403);
  const ok = await call<Order>("POST", `/admin/orders/${paid.id}/review`, { token: admin, body: { action: "paid", payMethod: "transfer" } });
  assert.equal(ok.data.status, "opened");
  assert.equal(ok.data.paidTwd, 1280);
  assert.equal(ok.data.payMethod, "transfer");
  assert.equal((await call("POST", `/admin/orders/${paid.id}/review`, { token: admin, body: { action: "paid" } })).status, 409);
  assert.equal((await call<CourseDetail>("GET", "/courses/lead", { token: student })).data.enrollment, "opened");
  const notes = await call<Notice[]>("GET", "/notifications", { token: student });
  assert.equal(notes.data[0].title, "繳費確認完成，課程已開通");
});

test("退回需選原因且不開通；退回後可以重新報名", async () => {
  const { call, login } = setup();
  const student = await login("demo-student");
  const admin = await login("demo-admin");
  const [order] = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["share"] } })).data;
  assert.equal((await call("POST", `/admin/orders/${order.id}/review`, { token: admin, body: { action: "reject" } })).status, 400);
  assert.equal((await call("POST", `/admin/orders/${order.id}/review`, { token: admin, body: { action: "reject", reasonCode: "other" } })).status, 400, "其他原因需填寫");
  const r = await call<Order>("POST", `/admin/orders/${order.id}/review`, { token: admin, body: { action: "reject", reasonCode: "unpaid" } });
  assert.equal(r.data.status, "rejected");
  assert.equal(r.data.rejectReason, "款項未入帳");
  assert.equal((await call<CourseDetail>("GET", "/courses/share", { token: student })).data.enrollment, null);
  assert.equal((await call("POST", "/orders", { token: student, body: { courseIds: ["share"] } })).status, 200);
});

test("獎銜不足、下架課程不能領；管理員可調整獎銜限制", async () => {
  const { call, login } = setup();
  const silver = await login("demo-silver");
  const admin = await login("demo-admin");
  assert.equal((await call("POST", "/orders", { token: silver, body: { courseIds: ["growth"] } })).status, 403);
  const patched = await call<CourseDetail>("PATCH", "/admin/courses/growth", { token: admin, body: { minRankCode: "silver" } });
  assert.equal(patched.data.minRank.name, "銀章");
  assert.equal((await call("POST", "/orders", { token: silver, body: { courseIds: ["growth"] } })).status, 200);
  await call("PATCH", "/admin/courses/talk", { token: admin, body: { status: "draft" } });
  assert.equal((await call("POST", "/orders", { token: silver, body: { courseIds: ["talk"] } })).status, 409);
  assert.equal((await call("GET", "/courses/talk", { token: silver })).status, 404);
  assert.equal((await call("GET", "/courses/start")).status, 401, "未登入不能看課程介紹");
  assert.equal((await call("PATCH", "/admin/courses/talk", { token: silver, body: { status: "published" } })).status, 403);
  assert.equal((await call("PATCH", "/admin/courses/talk", { token: admin, body: { minRankCode: "nope" } })).status, 400);
});

test("App（iOS/Android）不回傳價格，也不能建立付費訂單", async () => {
  const { call, login } = setup();
  const token = await login("demo-student");
  const native = await call<CourseSummary[]>("GET", "/courses", { token, platform: "ios" });
  assert.ok(native.data.every((c) => c.priceTwd === null));
  const web = await call<CourseSummary[]>("GET", "/courses", { token });
  assert.equal(web.data.find((c) => c.id === "lead")!.priceTwd, 1280);
  assert.equal((await call("POST", "/orders", { token, body: { courseIds: ["lead"] }, platform: "android" })).status, 403);
});

test("播放與進度：付費課程需先開通；設定免費且符合資格的課程直接看（第一次播放自動完成免費報名）", async () => {
  const { call, login } = setup();
  const [token, admin] = await Promise.all(["demo-student", "demo-admin"].map(login));
  // 付費課程：未開通不能看
  assert.equal((await call("GET", "/courses/lead/lessons/lead-welcome/playback", { token })).status, 403);
  // 費用尚未公布：免費的直接看不適用
  await call("PATCH", "/admin/courses/start", { token: admin, body: { priceTba: true } });
  assert.equal((await call("GET", "/courses/start/lessons/start-welcome/playback", { token })).status, 403);
  await call("PATCH", "/admin/courses/start", { token: admin, body: { priceTba: false } });
  // 設定免費、符合資格：不用報名就能看
  const before = (await call<CourseDetail>("GET", "/courses/start", { token })).data;
  assert.deepEqual([before.watchFree, before.enrollment, before.lessons.every((l) => !l.locked)], [true, null, true]);
  const p = await call<{ url: string }>("GET", "/courses/start/lessons/start-welcome/playback", { token });
  assert.equal(p.data.url, "/media/orientation.mp4");
  assert.equal((await call("GET", "/courses/start/lessons/talk-welcome/playback", { token })).status, 404, "章節必須屬於該課程");
  // 第一次播放後自動完成免費報名（學習中、進度、成就才記得到）
  assert.equal((await call<CourseDetail>("GET", "/courses/start", { token })).data.enrollment, "opened");
  await call("POST", "/courses/start/lessons/start-welcome/complete", { token });
  await call("POST", "/courses/start/lessons/start-welcome/complete", { token });
  assert.equal((await call<CourseDetail>("GET", "/courses/start", { token })).data.completedLessons, 1);
});

test("通知已讀、登出、刪除 App 資料", async () => {
  const { call, login } = setup();
  const token = await login("demo-student");
  await call("POST", "/orders", { token, body: { courseIds: ["start"] } });
  const [n] = (await call<Notice[]>("GET", "/notifications", { token })).data;
  await call("POST", `/notifications/${n.id}/read`, { token });
  assert.equal((await call<Notice[]>("GET", "/notifications", { token })).data[0].read, true);
  assert.equal((await call("DELETE", "/me", { token })).status, 200);
  assert.equal((await call<{ member: unknown }>("GET", "/me", { token })).data.member, null);
  const again = await login("demo-student");
  assert.equal((await call<Order[]>("GET", "/orders", { token: again })).data.length, 0);
  await call("POST", "/auth/logout", { token: again });
  assert.equal((await call("GET", "/orders", { token: again })).status, 401);
});

test("未知路徑 404、錯誤方法 405、壞 JSON 400", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/nope")).status, 404);
  assert.equal((await call("PUT", "/courses")).status, 405);
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const res = await handleApi(new Request("https://x/api/v2/auth/demo", { method: "POST", body: "{" }), env);
  assert.equal(res.status, 400);
});
