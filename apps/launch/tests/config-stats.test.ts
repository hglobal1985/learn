import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { DEFAULT_UI_CONFIG, type CourseDetail, type MuxStats, type Order, type UiConfig } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { setMuxFetch } from "../src/mux.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup(extra: Partial<Env> = {}) {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", ...extra };
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

test("畫面設定：公開讀取、只有超級管理員能改；顏色只能用規範色表、排序自動補齊", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  const def = (await call<UiConfig>("GET", "/ui-config")).data;
  assert.deepEqual(def.sortGroups, DEFAULT_UI_CONFIG.sortGroups);
  assert.equal(def.ribbons.countdown.label, "倒數 {n} 天");
  assert.equal((await call("PUT", "/admin/ui-config", { token: student, body: { sortGroups: [] } })).status, 403);
  const put = await call<UiConfig>("PUT", "/admin/ui-config", { token: admin, body: { sortGroups: ["enrolled", "pending"], ribbons: { learning: { label: "上課中", color: "olive", enabled: true }, pending: { label: "x", color: "not-a-color", enabled: false } }, statsRoles: ["president", "hacker"] } });
  assert.equal(put.status, 200);
  assert.deepEqual(put.data.sortGroups.slice(0, 2), ["enrolled", "pending"]);
  assert.equal(put.data.sortGroups.length, DEFAULT_UI_CONFIG.sortGroups.length, "缺的分組自動補上");
  assert.deepEqual([put.data.ribbons.learning.label, put.data.ribbons.learning.color], ["上課中", "olive"]);
  assert.equal(put.data.ribbons.pending.color, DEFAULT_UI_CONFIG.ribbons.pending.color, "不在色表的顏色退回預設");
  assert.equal(put.data.ribbons.pending.enabled, false);
  assert.deepEqual(put.data.statsRoles, ["president"]);
  assert.equal((await call<UiConfig>("GET", "/ui-config")).data.ribbons.learning.label, "上課中", "已存起來");
});

test("統計分析：超級管理員／秘書可看，其他職務要被指定；Mux 某一區讀不到不影響其他區；最常用的排前面", async () => {
  const { call, login } = setup({ MUX_TOKEN_ID: "id", MUX_TOKEN_SECRET: "secret" });
  const [admin, pres, student] = await Promise.all(["demo-admin", "demo-president", "demo-student"].map(login));
  setMuxFetch(async (url) => {
    if (url.includes("/video/v1/delivery-usage")) return Response.json({ data: [{ asset_id: "a1", delivered_seconds: 6000 }, { asset_id: "a2", delivered_seconds: 600 }] });
    if (url.includes("/video/v1/assets")) return Response.json({ data: [{ id: "a1", status: "ready", duration: 120 }, { id: "a2", status: "errored", duration: 30 }] });
    if (url.includes("/video/v1/live-streams")) return Response.json({ data: [] });
    if (url.includes("/data/v1/")) return new Response("{}", { status: 403 }); // 沒有 Mux Data 權限
    return new Response("{}", { status: 404 });
  });
  assert.equal((await call("GET", "/admin/stats/mux", { token: student })).status, 403);
  assert.equal((await call("GET", "/admin/stats/mux", { token: pres })).status, 403, "會長預設不能看");
  const stats = await call<MuxStats>("GET", "/admin/stats/mux", { token: admin });
  assert.equal(stats.status, 200);
  const free = stats.data.blocks.find((b) => b.id === "free_quota")!;
  assert.match(free.stats![0]!.value, /^110 分鐘/, "6000＋600 秒＝110 分鐘");
  assert.equal(stats.data.blocks.find((b) => b.id === "top_videos")!.error?.includes("Mux Data") ?? false, true, "Data API 讀不到只在該區顯示原因");
  assert.equal(stats.data.blocks.find((b) => b.id === "assets")!.stats![0]!.value, "2");
  const levels = stats.data.blocks.map((b) => b.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => ({ core: 0, more: 1, advanced: 2 })[a] - ({ core: 0, more: 1, advanced: 2 })[b]), "最常用的在前面、進階的在最後");
  // 本 App 資料庫統計：獨立一個端點，權限相同，且不含 Mux 區塊
  assert.equal((await call("GET", "/admin/stats/app", { token: student })).status, 403);
  const app = await call<MuxStats>("GET", "/admin/stats/app", { token: admin });
  assert.equal(app.status, 200);
  assert.ok(app.data.blocks.length >= 4 && app.data.blocks.every((b) => b.id.startsWith("app_")), "資料庫統計與 Mux 統計不混合");
  assert.ok(!app.data.blocks.some((b) => b.error), "每個區塊都讀得到");
  // Cloudflare 流量統計：沒設定權杖時只顯示「尚未設定」，不報錯
  assert.equal((await call("GET", "/admin/stats/cloudflare", { token: student })).status, 403);
  const cf = await call<MuxStats>("GET", "/admin/stats/cloudflare", { token: admin });
  assert.equal(cf.status, 200);
  assert.equal(cf.data.blocks[0]!.id, "cf_setup");
  // 超級管理員指定會長可以看
  await call("PUT", "/admin/ui-config", { token: admin, body: { statsRoles: ["president"] } });
  assert.equal((await call("GET", "/admin/stats/mux", { token: pres })).status, 200);
  const me = (await call<{ member: { canViewStats?: boolean } }>("GET", "/me", { token: pres })).data;
  assert.equal(((me as unknown as { canViewStats?: boolean }).canViewStats ?? me.member?.canViewStats) ?? false, true);
});

test("課程章節：沒上傳內容的章節 ready＝false（敬請期待）；審核中的報名帶報名編號", async () => {
  const { call, login } = setup();
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  const made = await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "空課程", priceTwd: 100, status: "published" } });
  assert.equal(made.data.lessons[0]!.ready, false);
  await call("PATCH", `/admin/lessons/${made.data.lessons[0]!.id}`, { token: admin, body: { mediaType: "youtube", mediaRef: "dQw4w9WgXcQ" } });
  assert.equal((await call<CourseDetail>("GET", `/courses/${made.data.id}`, { token: student })).data.lessons[0]!.ready, true);
  const [o] = (await call<Order[]>("POST", "/orders", { token: student, body: { courseIds: [made.data.id] } })).data;
  assert.equal((await call<CourseDetail>("GET", `/courses/${made.data.id}`, { token: student })).data.pendingOrderId, o!.id);
});
