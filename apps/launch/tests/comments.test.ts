import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseComment, CourseDetail, Notice } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup() {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = Record<string, unknown>,>(method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", { body: { sub } })).data.token;
  return { call, login };
}

test("會長也可報名：開啟後會長不受獎銜限制，其他人仍依獎銜", async () => {
  const { call, login } = setup();
  const [admin, pres, silver] = await Promise.all(["demo-admin", "demo-president", "demo-silver"].map(login));
  await call("PATCH", "/admin/courses/growth", { token: admin, body: { minRankCode: "diamond" } });
  assert.equal((await call<CourseDetail>("GET", "/courses/growth", { token: pres })).data.eligible, false, "翡翠會長未達鑽石");
  assert.equal((await call("POST", "/orders", { token: pres, body: { courseIds: ["growth"] } })).status, 403);
  const c = (await call<CourseDetail>("PATCH", "/admin/courses/growth", { token: admin, body: { allowPresident: true } })).data;
  assert.equal(c.allowPresident, true);
  assert.equal((await call<CourseDetail>("GET", "/courses/growth", { token: pres })).data.eligible, true);
  assert.equal((await call("POST", "/orders", { token: pres, body: { courseIds: ["growth"] } })).status, 200);
  assert.equal((await call("POST", "/orders", { token: silver, body: { courseIds: ["growth"] } })).status, 403);
});

test("留言板：登入才能看與留言；檢舉通知總部一次；封鎖後看不到對方；管理員可隱藏；本人可刪除", async () => {
  const { call, login } = setup();
  const [admin, a, b] = await Promise.all(["demo-admin", "demo-student", "demo-silver"].map(login));
  assert.equal((await call("GET", "/courses/start/comments")).status, 401);
  assert.equal((await call("POST", "/courses/start/comments", { token: a, body: { body: "  " } })).status, 400);
  await call("POST", "/courses/start/comments", { token: a, body: { body: "這堂課很棒" } });
  const list = (await call<CourseComment[]>("POST", "/courses/start/comments", { token: b, body: { body: "不當內容" } })).data;
  assert.deepEqual(list.map((c) => [c.authorName, c.mine]), [["測試學員（銀章）", true], ["測試學員", false]]);
  const bad = list[0];
  assert.equal((await call("POST", `/comments/${bad.id}/report`, { token: b, body: {} })).status, 400, "不能檢舉自己");
  await call("POST", `/comments/${bad.id}/report`, { token: a, body: { reason: "廣告" } });
  await call("POST", `/comments/${bad.id}/report`, { token: a, body: { reason: "廣告" } });
  assert.equal((await call<Notice[]>("GET", "/notifications", { token: admin })).data.filter((n) => n.title === "有留言被檢舉").length, 1);
  // 封鎖：a 不再看到 b 的留言；b 自己仍看得到
  await call("POST", `/comments/${bad.id}/block`, { token: a });
  assert.deepEqual((await call<CourseComment[]>("GET", "/courses/start/comments", { token: a })).data.map((c) => c.body), ["這堂課很棒"]);
  assert.equal((await call<CourseComment[]>("GET", "/courses/start/comments", { token: b })).data.length, 2);
  // 管理員：檢舉清單與隱藏
  assert.equal((await call("GET", "/admin/comments", { token: a })).status, 403);
  const reported = (await call<CourseComment[]>("GET", "/admin/comments", { token: admin })).data;
  assert.deepEqual(reported.map((c) => [c.body, c.reports, c.courseTitle]), [["不當內容", 1, "把目標變成每天的行動"]]);
  await call("PATCH", `/admin/comments/${bad.id}`, { token: admin, body: { hidden: true } });
  assert.equal((await call<CourseComment[]>("GET", "/courses/start/comments", { token: b })).data.length, 1, "隱藏後一般會員都看不到");
  assert.equal((await call<CourseComment[]>("GET", "/courses/start/comments", { token: admin })).data.find((c) => c.id === bad.id)!.hidden, true);
  // 本人刪除；別人不能刪
  const mine = (await call<CourseComment[]>("GET", "/courses/start/comments", { token: a })).data[0];
  assert.equal((await call("DELETE", `/comments/${mine.id}`, { token: b })).status, 404);
  assert.equal((await call("DELETE", `/comments/${mine.id}`, { token: a })).status, 200);
  // 留言頻率限制
  for (let i = 0; i < 5; i++) await call("POST", "/courses/talk/comments", { token: a, body: { body: `第 ${i} 則` } });
  assert.equal((await call("POST", "/courses/talk/comments", { token: a, body: { body: "太多了" } })).status, 429);
});
