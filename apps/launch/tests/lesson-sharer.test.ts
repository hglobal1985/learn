import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

test("章節分享者與課程主講人：新增、修改、複製課程都會帶著", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const admin = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-admin" })).data.token;
  const created = await call<CourseDetail>("POST", "/admin/courses", admin, { title: "測試課", teacher: "王老師" });
  assert.equal(created.status, 200);
  assert.equal(created.data.teacher, "王老師");
  const id = created.data.id;

  const withLesson = await call<CourseDetail>("POST", `/admin/courses/${id}/lessons`, admin, { title: "第一堂", sharer: " 李講師 " });
  const l = withLesson.data.lessons.find((x) => x.title === "第一堂")!;
  assert.equal(l.sharer, "李講師");
  assert.equal(withLesson.data.lessons.find((x) => x.title !== "第一堂")?.sharer, ""); // 預設空白

  await call("PATCH", `/admin/lessons/${l.id}`, admin, { sharer: "陳博士" });
  let d = (await call<CourseDetail>("GET", `/courses/${id}`, admin)).data;
  assert.equal(d.lessons.find((x) => x.id === l.id)?.sharer, "陳博士");
  await call("PATCH", `/admin/lessons/${l.id}`, admin, { title: "改名" }); // 沒帶 sharer 不會被清掉
  d = (await call<CourseDetail>("GET", `/courses/${id}`, admin)).data;
  assert.equal(d.lessons.find((x) => x.id === l.id)?.sharer, "陳博士");
  await call("PATCH", `/admin/lessons/${l.id}`, admin, { sharer: "" });
  d = (await call<CourseDetail>("GET", `/courses/${id}`, admin)).data;
  assert.equal(d.lessons.find((x) => x.id === l.id)?.sharer, "");

  // 獎銜（選單）與職稱
  const opts = (await call<{ ranks: { value: string; label: string }[] }>("GET", "/admin/central-options", admin)).data.ranks;
  assert.ok(opts.length > 3 && !opts.some((o) => o.value === "none"));
  const rank = opts[2]!;
  await call("PATCH", `/admin/courses/${id}`, admin, { teacherRank: rank.value, teacherTitle: " 經理 " });
  await call("PATCH", `/admin/lessons/${l.id}`, admin, { sharer: "複製我", sharerRank: rank.value, sharerTitle: "講師" });
  d = (await call<CourseDetail>("GET", `/courses/${id}`, admin)).data;
  assert.equal(d.teacherRank, rank.value);
  assert.equal(d.teacherRankName, rank.label);
  assert.equal(d.teacherTitle, "經理");
  const l1 = d.lessons.find((x) => x.id === l.id)!;
  assert.deepEqual([l1.sharerRank, l1.sharerRankName, l1.sharerTitle], [rank.value, rank.label, "講師"]);
  await call("PATCH", `/admin/lessons/${l.id}`, admin, { title: "只改名" }); // 沒帶就不動
  assert.equal((await call<CourseDetail>("GET", `/courses/${id}`, admin)).data.lessons.find((x) => x.id === l.id)?.sharerTitle, "講師");
  assert.equal((await call("GET", "/admin/central-options", await (async () => (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-student" })).data.token)())).status, 403);
  await call("PATCH", `/admin/lessons/${l.id}`, admin, { sharer: "複製我" });
  const copy = (await call<CourseDetail>("POST", `/admin/courses/${id}/duplicate`, admin)).data;
  assert.equal(copy.teacher, "王老師");
  assert.ok(copy.lessons.some((x) => x.sharer === "複製我" && x.sharerRank === rank.value && x.sharerTitle === "講師"));
  assert.deepEqual([copy.teacherRank, copy.teacherTitle], [rank.value, "經理"]);
});
