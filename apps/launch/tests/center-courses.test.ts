import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, CourseSummary, ReviewGroup } from "../src/contract.ts";
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

test("各中心自行上架：會長只能管理主辦單位是自己中心的課程", async () => {
  const { call, login } = setup();
  const [admin, pres, student] = await Promise.all(["demo-admin", "demo-president", "demo-student"].map(login));
  // 一般學員不能進課程管理
  assert.equal((await call("GET", "/admin/courses", { token: student })).status, 403);
  assert.equal((await call("POST", "/admin/courses", { token: student, body: { title: "x" } })).status, 403);

  // 會長建立課程：主辦單位固定為自己的中心，就算想填別的也無效
  const made = await call<CourseDetail>("POST", "/admin/courses", { token: pres, body: { title: "台北中心讀書會", priceTwd: 100, hostUnit: "台中中心" } });
  assert.equal(made.status, 200);
  const id = made.data.id;
  assert.equal(made.data.hostUnit, "台北中心");
  assert.equal(made.data.status, "draft");
  // 不能自稱總部指導
  assert.equal((await call("PATCH", `/admin/courses/${id}`, { token: pres, body: { guidanceUnit: "寰宇總部" } })).status, 403);
  // 可以編輯、加章節、上架
  assert.equal((await call("PATCH", `/admin/courses/${id}`, { token: pres, body: { title: "台北讀書會（改）", status: "published" } })).status, 200);
  const withLesson = await call<CourseDetail>("POST", `/admin/courses/${id}/lessons`, { token: pres, body: { title: "第二堂" } });
  assert.equal(withLesson.status, 200);
  // 不能用 Mux
  const lessonId = withLesson.data.lessons[0]!.id;
  assert.equal((await call("PATCH", `/admin/lessons/${lessonId}`, { token: pres, body: { mediaType: "mux", mediaRef: "abc" } })).status, 403);
  assert.equal((await call("PATCH", `/admin/lessons/${lessonId}`, { token: pres, body: { title: "改名" } })).status, 200);

  // 清單只看到自己中心的課程；總部課程看不到也改不了
  const mine = (await call<CourseSummary[]>("GET", "/admin/courses", { token: pres })).data;
  assert.deepEqual(mine.map((c) => c.id), [id]);
  assert.ok((await call<CourseSummary[]>("GET", "/admin/courses", { token: admin })).data.length > 1);
  assert.equal((await call("PATCH", "/admin/courses/share", { token: pres, body: { title: "亂改" } })).status, 403);
  assert.equal((await call("POST", "/admin/courses/share/lessons", { token: pres, body: { title: "亂加" } })).status, 403);
  assert.equal((await call("DELETE", "/admin/courses/share", { token: pres })).status, 403);

  // 審核群組：只能用自己中心的群組
  const hq = (await call<ReviewGroup[]>("POST", "/admin/review-groups", { token: admin, body: { name: "總部群組" } })).data;
  assert.equal((await call("PATCH", `/admin/courses/${id}`, { token: pres, body: { reviewGroupId: hq[0]!.id } })).status, 403);
  const own = (await call<ReviewGroup[]>("POST", "/admin/review-groups", { token: pres, body: { name: "台北群組", ownerCenter: "台北中心" } })).data;
  const ownId = own.find((g) => g.name === "台北群組")!.id;
  assert.equal((await call("PATCH", `/admin/courses/${id}`, { token: pres, body: { reviewGroupId: ownId } })).status, 200);

  // 沒人報名可以刪；之後有人報名就只能下架
  assert.equal((await call("DELETE", `/admin/courses/${id}`, { token: pres })).status, 200);
  const again = await call<CourseDetail>("POST", "/admin/courses", { token: pres, body: { title: "第二門", priceTwd: 0, status: "published" } });
  await call("POST", "/orders", { token: student, body: { courseIds: [again.data.id] } });
  assert.equal((await call("DELETE", `/admin/courses/${again.data.id}`, { token: pres, body: { confirm: "YES" } })).status, 403);
  assert.equal((await call("DELETE", `/admin/courses/${again.data.id}`, { token: admin, body: { confirm: "YES" } })).status, 200);
});
