import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { Env, R2Bucket } from "../src/d1.ts";
import { RANK_BADGE_FILES, rankBadgeUrl } from "../src/rank-badges.ts";
import { createTestDb } from "./sqlite-d1.ts";

test("獎銜對應徽章：代碼、中文名稱都能對到；沒有徽章的獎銜回 null；24 張各不重複", () => {
  assert.equal(rankBadgeUrl("diamond"), "/api/v2/media/badge?f=13-Diamond");
  assert.equal(rankBadgeUrl("f_crown_ambassador"), "/api/v2/media/badge?f=24-Founders-Crown-Ambassador");
  assert.equal(rankBadgeUrl("鑽石"), "/api/v2/media/badge?f=13-Diamond");
  assert.equal(rankBadgeUrl("x", "雙鑽石"), "/api/v2/media/badge?f=17-Double-Diamond");
  assert.equal(rankBadgeUrl("r12"), null);
  assert.equal(rankBadgeUrl("none"), null);
  assert.equal(rankBadgeUrl(null), null);
  assert.equal(new Set(Object.values(RANK_BADGE_FILES)).size, 24);
});

test("徽章圖網址：只服務白名單檔名；/me 會帶 rankBadge", async () => {
  const bucket = { get: async (k: string) => (k === "Pin-Level/13-Diamond.png" ? { httpMetadata: {}, size: 3, body: new Response("png").body } : null) } as unknown as R2Bucket;
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", MEDIA: bucket };
  const get = (path: string, token?: string) => handleApi(new Request(`https://learn.test/api/v2${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }), env);
  const ok = await get("/media/badge?f=13-Diamond");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/png");
  assert.equal((await get("/media/badge?f=../secret")).status, 404);
  assert.equal((await get("/media/badge?f=99-Nothing")).status, 404);
  assert.equal((await get("/media/badge?f=01-Bronze")).status, 404); // 白名單內但檔案不存在
  const login = await handleApi(new Request("https://learn.test/api/v2/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: "demo-admin" }) }), env);
  const { token } = (await login.json()) as { token: string };
  const me = (await (await get("/me", token)).json()) as { member: { rankBadge?: string | null; rank: { code: string } | null } };
  assert.equal(me.member.rankBadge, rankBadgeUrl(me.member.rank?.code));
});
