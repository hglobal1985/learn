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

test("鑽石免費：鑽石以上免費自動開通，其他獎銜照原價待審核", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { diamondFree: true } });
  const asDiamond = (await call<CourseDetail>("GET", "/courses/lead", { token: admin })).data;
  assert.equal(asDiamond.diamondFree, true);
  assert.deepEqual([asDiamond.diamondFreeNow, asDiamond.priceTwd, asDiamond.free], [true, 0, true]);
  const asPlatinum = (await call<CourseDetail>("GET", "/courses/lead", { token: student })).data;
  assert.deepEqual([asPlatinum.diamondFree, asPlatinum.diamondFreeNow, asPlatinum.priceTwd], [true, false, 1280]);
  assert.equal((await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["lead"] } })).data[0].status, "pending");
  assert.equal((await call<Order[]>("POST", "/orders", { token: admin, body: { courseIds: ["lead"] } })).data[0].status, "opened");
});

test("早鳥優惠：期間內用早鳥價，過期恢復原價；早鳥價要低於原價", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  assert.equal((await call("PATCH", "/admin/courses/lead", { token: admin, body: { earlyBird: true, earlyPriceTwd: 1280, earlyUntil: "2999-12-31" } })).status, 200, "沒帶原價時只檢查格式");
  assert.equal((await call("PATCH", "/admin/courses/lead", { token: admin, body: { priceTwd: 1000, earlyBird: true, earlyPriceTwd: 1000, earlyUntil: "2999-12-31" } })).status, 400, "早鳥價不可不低於原價");
  assert.equal((await call("PATCH", "/admin/courses/lead", { token: admin, body: { priceTwd: 1280, earlyBird: true, earlyPriceTwd: 900, earlyUntil: "2999-12-31" } })).status, 200);
  const on = (await call<CourseDetail>("GET", "/courses/lead", { token: student })).data;
  assert.deepEqual([on.priceTwd, on.originalPriceTwd, on.earlyBird?.active, on.earlyBird?.until], [900, 1280, true, "2999-12-31"]);
  const order = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: ["lead"] } })).data[0];
  assert.equal(order.totalTwd, 900);
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { earlyBird: true, earlyPriceTwd: 900, earlyUntil: "2000-01-01" } });
  const off = (await call<CourseDetail>("GET", "/courses/lead", { token: admin })).data;
  assert.deepEqual([off.priceTwd, off.earlyBird?.active], [1280, false]);
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { earlyBird: false } });
  assert.equal((await call<CourseDetail>("GET", "/courses/lead", { token: admin })).data.earlyBird, null);
});

test("系列：存系列名稱、列出系列；複製這門課建立下一梯（草稿、不帶日期與音檔）", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  assert.equal((await call("PATCH", "/admin/courses/share", { token: admin, body: { series: "分享達標班", eventStart: "2026-11-08" } })).status, 200);
  assert.deepEqual((await call<string[]>("GET", "/admin/series", { token: admin })).data, ["分享達標班"]);
  assert.equal((await call("GET", "/admin/series", { token: student })).status, 403);
  assert.equal((await call("POST", "/admin/courses/share/duplicate", { token: student })).status, 403);
  const copy = (await call<CourseDetail>("POST", "/admin/courses/share/duplicate", { token: admin })).data;
  assert.notEqual(copy.id, "share");
  assert.equal(copy.status, "draft");
  assert.equal(copy.series, "分享達標班");
  assert.equal(copy.eventStart, null, "活動日期不帶過去");
  assert.match(copy.title, /（複製）$/);
  const orig = (await call<CourseDetail>("GET", "/courses/share", { token: admin })).data;
  assert.equal(copy.lessons.length, orig.lessons.length);
  // 原本沒有系列：複製時兩邊都設成課程名稱
  const c2 = (await call<CourseDetail>("POST", "/admin/courses/lead/duplicate", { token: admin })).data;
  const lead = (await call<CourseDetail>("GET", "/courses/lead", { token: admin })).data;
  assert.equal(c2.series, lead.series);
  assert.notEqual(lead.series, "");
});

test("已有的分類清單：管理員看全部、學員不行", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  await call("PATCH", "/admin/courses/share", { token: admin, body: { category: "達標班" } });
  assert.ok((await call<string[]>("GET", "/admin/categories", { token: admin })).data.includes("達標班"));
  assert.equal((await call("GET", "/admin/categories", { token: student })).status, 403);
});

test("關鍵字管理：只有超級管理員；新增、改名會一併更新課程、刪除會清空課程欄位", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  type KW = Record<"category" | "series" | "location", { value: string; count: number; preset: boolean }[]>;
  assert.equal((await call("GET", "/admin/keywords", { token: student })).status, 403);
  await call("PATCH", "/admin/courses/share", { token: admin, body: { category: "達標班", series: "翡翠達標班", location: "台北教室" } });
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { category: "達標班" } });
  let kw = (await call<KW>("GET", "/admin/keywords", { token: admin })).data;
  assert.deepEqual(kw.category.find((k) => k.value === "達標班"), { value: "達標班", count: 2, preset: false });
  // 預先新增（還沒有課程使用）
  kw = (await call<KW>("POST", "/admin/keywords", { token: admin, body: { kind: "location", value: "高雄教室" } })).data;
  assert.deepEqual(kw.location.find((k) => k.value === "高雄教室"), { value: "高雄教室", count: 0, preset: true });
  assert.ok((await call<string[]>("GET", "/admin/locations", { token: admin })).data.includes("高雄教室"), "預先建立的也會出現在課程編輯頁的選項");
  // 改名：課程跟著變
  kw = (await call<KW>("PATCH", "/admin/keywords", { token: admin, body: { kind: "category", from: "達標班", to: "達標系列班" } })).data;
  assert.equal(kw.category.find((k) => k.value === "達標系列班")?.count, 2);
  assert.equal(kw.category.some((k) => k.value === "達標班"), false);
  assert.equal((await call<{ category: string }>("GET", "/courses/share", { token: admin })).data.category, "達標系列班");
  // 刪除：課程欄位清空
  kw = (await call<KW>("POST", "/admin/keywords/remove", { token: admin, body: { kind: "series", value: "翡翠達標班" } })).data;
  assert.equal(kw.series.some((k) => k.value === "翡翠達標班"), false);
  assert.equal((await call<{ series: string }>("GET", "/courses/share", { token: admin })).data.series, "");
  assert.equal((await call("POST", "/admin/keywords", { token: admin, body: { kind: "bad", value: "x" } })).status, 400);
});

test("分類可複選：存成「、」分隔，關鍵字改名與刪除會處理每一個", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  type KW = { category: { value: string; count: number }[] };
  await call("PATCH", "/admin/courses/share", { token: admin, body: { category: ["達標班", "會議", "達標班"] } });
  await call("PATCH", "/admin/courses/lead", { token: admin, body: { category: "會議，講座" } });
  assert.equal((await call<{ category: string }>("GET", "/courses/share", { token: admin })).data.category, "達標班、會議");
  assert.equal((await call<{ category: string }>("GET", "/courses/lead", { token: admin })).data.category, "會議、講座");
  let kw = (await call<KW>("GET", "/admin/keywords", { token: admin })).data;
  assert.equal(kw.category.find((k) => k.value === "會議")?.count, 2);
  assert.ok((await call<string[]>("GET", "/admin/categories", { token: admin })).data.includes("講座"));
  kw = (await call<KW>("PATCH", "/admin/keywords", { token: admin, body: { kind: "category", from: "會議", to: "月會" } })).data;
  assert.equal((await call<{ category: string }>("GET", "/courses/share", { token: admin })).data.category, "達標班、月會");
  assert.equal(kw.category.find((k) => k.value === "月會")?.count, 2);
  await call("POST", "/admin/keywords/remove", { token: admin, body: { kind: "category", value: "月會" } });
  assert.equal((await call<{ category: string }>("GET", "/courses/share", { token: admin })).data.category, "達標班");
  assert.equal((await call<{ category: string }>("GET", "/courses/lead", { token: admin })).data.category, "講座");
});
