import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, CourseSummary, Member, Notice, Order, ReviewGroup } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup() {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const raw = (method: string, path: string, opts: { token?: string; body?: unknown } = {}) =>
    handleApi(
      new Request(`https://learn.test/api/v2${path}`, {
        method,
        headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      }),
      env,
    );
  const call = async <T = Record<string, unknown>,>(method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await raw(method, path, opts);
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", { body: { sub } })).data.token;
  return { raw, call, login, env };
}
const titles = (n: Notice[]) => n.map((x) => x.title);

test("審核群組：依中心通知窗口與會長；只能審核自己中心；學員看得到收費窗口與處理紀錄", async () => {
  const { call, login } = setup();
  const [admin, desk, pres, taipei, taichung, outsider] = await Promise.all(["demo-admin", "demo-desk", "demo-president", "demo-student", "demo-silver", "demo-outsider"].map(login));
  // 窗口先登入過（名單才有姓名）
  await call("GET", "/me", { token: desk });
  assert.equal((await call("POST", "/admin/review-groups", { token: desk, body: { name: "x" } })).status, 403);
  let groups = (await call<ReviewGroup[]>("POST", "/admin/review-groups", { token: admin, body: { name: "分享課" } })).data;
  const gid = groups[0].id;
  assert.equal(groups[0].ownerCenter, null, "總部群組");
  assert.equal((await call("POST", `/admin/review-groups/${gid}/members`, { token: pres, body: { memberSub: "demo-desk", duty: "collect", center: "台北中心" } })).status, 403, "總部群組只有秘書／超管可指派");
  groups = (await call<ReviewGroup[]>("POST", `/admin/review-groups/${gid}/members`, { token: admin, body: { memberSub: "demo-desk", duty: "collect", center: "台北中心" } })).data;
  assert.equal(groups[0].members[0].centerLabel, "台北中心");
  await call("PATCH", "/admin/courses/share", { token: admin, body: { reviewGroupId: gid, guidanceUnit: "寰宇總部", hostUnit: "台北中心" } });
  const me = (await call<{ member: Member }>("GET", "/me", { token: desk })).data.member;
  assert.deepEqual([me.reviewer, me.titles], [true, ["收費窗口"]]);

  // 台北學員報名 → 通知台北窗口與台北會長，不通知總部
  const [o1] = (await call<Order[]>("POST", "/orders", { token: taipei, body: { courseIds: ["share"] } })).data;
  assert.ok(titles((await call<Notice[]>("GET", "/notifications", { token: desk })).data).includes("有新的報名待審核"));
  assert.ok(titles((await call<Notice[]>("GET", "/notifications", { token: pres })).data).includes("有新的報名待審核"));
  assert.equal((await call<Notice[]>("GET", "/notifications", { token: admin })).data.length, 0, "總部不被一般報名通知打擾");
  // 台中學員（該中心沒有窗口）與非寰宇學員 → 通知總部
  const [o2] = (await call<Order[]>("POST", "/orders", { token: taichung, body: { courseIds: ["share"] } })).data;
  const [o3] = (await call<Order[]>("POST", "/orders", { token: outsider, body: { courseIds: ["share"] } })).data;
  const hq = titles((await call<Notice[]>("GET", "/notifications", { token: admin })).data);
  assert.ok(hq.includes("有新的報名待審核（該中心尚未設定窗口）") && hq.includes("有新的報名待審核（非寰宇系統學員）"));

  // 範圍：窗口與會長只看得到台北；總部看得到全部，並可篩選非寰宇
  assert.deepEqual((await call<Order[]>("GET", "/admin/orders", { token: desk })).data.map((o) => o.id), [o1.id]);
  assert.deepEqual((await call<Order[]>("GET", "/admin/orders", { token: pres })).data.map((o) => o.id), [o1.id]);
  assert.equal((await call<Order[]>("GET", "/admin/orders", { token: admin })).data.length, 3);
  assert.deepEqual((await call<Order[]>("GET", "/admin/orders?hglobal=0", { token: admin })).data.map((o) => o.id), [o3.id]);
  assert.equal((await call("GET", "/admin/orders", { token: taipei })).status, 403);
  assert.equal((await call("POST", `/admin/orders/${o2.id}/review`, { token: desk, body: { action: "paid" } })).status, 404, "不能審核別的中心");

  // 學員看得到收費窗口；延後再審＋私人備註；學員看不到備註
  let mine = (await call<Order>("GET", `/orders/${o1.id}`, { token: taipei })).data;
  assert.deepEqual(mine.collectors, ["測試窗口"]);
  const deferred = (await call<Order>("POST", `/admin/orders/${o1.id}/review`, { token: desk, body: { action: "defer", reasonCode: "wrong_amount", note: "少 100", message: "請補差額" } })).data;
  assert.deepEqual([deferred.status, deferred.deferred, deferred.events!.at(-1)!.note], ["pending", true, "少 100"]);
  mine = (await call<Order>("GET", `/orders/${o1.id}`, { token: taipei })).data;
  const last = mine.events!.at(-1)!;
  assert.deepEqual([last.actorName, last.actorTitle, last.reason, last.message, last.note], ["測試窗口", "收費窗口", "款項金額不正確", "請補差額", undefined]);
  assert.deepEqual((await call<Order[]>("GET", "/admin/orders?status=deferred", { token: desk })).data.map((o) => o.id), [o1.id]);
  // 留言：學員 → 通知處理過的窗口；窗口私人備註不通知學員、學員看不到
  await call("POST", `/orders/${o1.id}/events`, { token: taipei, body: { message: "已補繳" } });
  assert.ok(titles((await call<Notice[]>("GET", "/notifications", { token: desk })).data).includes("學員在報名紀錄留言"));
  await call("POST", `/orders/${o1.id}/events`, { token: desk, body: { note: "已收現金" } });
  assert.equal((await call<Order>("GET", `/orders/${o1.id}`, { token: taipei })).data.events!.some((e) => e.action === "note"), false);
  assert.equal((await call("POST", `/orders/${o1.id}/events`, { token: taichung, body: { message: "x" } })).status, 404);
  // 開通
  const paid = (await call<Order>("POST", `/admin/orders/${o1.id}/review`, { token: desk, body: { action: "paid", paidTwd: 680 } })).data;
  assert.deepEqual([paid.status, paid.deferred, paid.paidTwd, paid.payMethod], ["opened", false, 680, "cash"]);
  assert.equal((await call("POST", `/admin/orders/${o1.id}/review`, { token: desk, body: { action: "revoke", reasonCode: "unpaid" } })).status, 403);

  // 指導單位為寰宇總部 → 不能改用中心自辦群組
  const own = (await call<ReviewGroup[]>("POST", "/admin/review-groups", { token: pres, body: { name: "台北自辦", ownerCenter: "台北中心" } })).data;
  assert.equal(own.length, 1, "會長只看得到自己中心的群組");
  assert.equal(own[0].ownerCenter, "台北中心");
  assert.equal((await call("PATCH", "/admin/courses/share", { token: admin, body: { reviewGroupId: own[0].id } })).status, 400);
  assert.equal((await call("POST", `/admin/review-groups/${own[0].id}/members`, { token: pres, body: { memberSub: "demo-desk", duty: "review" } })).status, 200);
});

test("自己的報名：超級管理員／秘書可自己審核，會長與窗口不行", async () => {
  const { call, login } = setup();
  const [admin, pres] = await Promise.all(["demo-admin", "demo-president"].map(login));
  await call("PATCH", "/admin/courses/share", { token: admin, body: { guidanceUnit: "寰宇總部", hostUnit: "台北中心" } });
  const [a] = (await call<Order[]>("POST", "/orders", { token: admin, body: { courseIds: ["share"] } })).data;
  const detail = (await call<Order>("GET", `/orders/${a.id}`, { token: admin })).data;
  assert.equal(detail.canReview, true);
  assert.equal((await call("POST", `/admin/orders/${a.id}/review`, { token: admin, body: { action: "paid", paidTwd: 0 } })).status, 200);
  const [p] = (await call<Order[]>("POST", "/orders", { token: pres, body: { courseIds: ["share"] } })).data;
  assert.equal((await call("POST", `/admin/orders/${p.id}/review`, { token: pres, body: { action: "paid" } })).status, 403, "會長不能審核自己");
});

test("對帳報表 CSV：依權限範圍匯出，含實收與審核人員", async () => {
  const { call, raw, login } = setup();
  const [admin, pres, taipei, taichung] = await Promise.all(["demo-admin", "demo-president", "demo-student", "demo-silver"].map(login));
  const [a] = (await call<Order[]>("POST", "/orders", { token: taipei, body: { courseIds: ["share"] } })).data;
  await call<Order[]>("POST", "/orders", { token: taichung, body: { courseIds: ["share"] } });
  await call("POST", `/admin/orders/${a.id}/review`, { token: pres, body: { action: "paid", payMethod: "transfer" } });
  const res = await raw("GET", "/admin/orders.csv", { token: admin });
  assert.match(res.headers.get("content-type")!, /text\/csv/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "含 BOM，Excel 才會正確顯示中文");
  const csv = new TextDecoder().decode(bytes);
  assert.ok(csv.startsWith("報名編號,"));
  assert.equal(csv.trim().split("\r\n").length, 3);
  assert.match(csv, new RegExp(`${a.id},.*,台北中心,是,已開通,680,680,轉帳,會長 測試會長`));
  const mineOnly = await (await raw("GET", "/admin/orders.csv", { token: pres })).text();
  assert.equal(mineOnly.trim().split("\r\n").length, 2, "會長只匯出自己中心");
  assert.equal((await raw("GET", "/admin/orders.csv", { token: taipei })).status, 403);
});

test("限時免費：期間內付費課程免費且自動開通；過期恢復原價", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  // 限時免費：期間內付費課程免費且自動開通；過期恢復原價
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { freeFrom: "2000-01-01T00:00:00Z", freeUntil: "2999-01-01T00:00:00Z" } });
  const lead = (await call<CourseDetail>("GET", "/courses/lead", { token: student })).data;
  assert.deepEqual([lead.free, lead.freeNow, lead.priceTwd, lead.originalPriceTwd], [true, true, 0, 1280]);
  assert.equal((await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["lead"] } })).data[0].status, "opened");
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { freeUntil: "2001-01-01T00:00:00Z" } });
  assert.equal((await call<CourseDetail>("GET", "/courses/lead", { token: admin })).data.priceTwd, 1280);
});
