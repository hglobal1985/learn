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

import { generateKeyPairSync, createSign } from "node:crypto";
import { parseRankBadges, setCentralFetch } from "../src/central.ts";
import type { Member } from "../src/contract.ts";

test("中央徽章資料解析：只收 https 完整網址與完整範圍，沒有徽章為 null", () => {
  const m = parseRankBadges([
    { key: "rank", options: [
      { value: "none", label: "無", badge_url: null, badge: null },
      { value: "diamond", label: "鑽石", badge_url: "https://id.hglobal1985.com/badges/diamond.png?v=1", badge: { width: 380, height: 720, art_top: 137, art_bottom: 593 } },
      { value: "bad1", label: "x", badge_url: "http://insecure/x.png", badge: { width: 380, height: 720, art_top: 1, art_bottom: 2 } },
      { value: "bad2", label: "y", badge_url: "https://ok/y.png", badge: { width: 380, height: 0, art_top: 1, art_bottom: 2 } },
    ] },
  ]);
  assert.equal(m.get("none"), null);
  assert.deepEqual(m.get("diamond"), { url: "https://id.hglobal1985.com/badges/diamond.png?v=1", width: 380, height: 720, top: 137, bottom: 593 });
  assert.equal(m.get("bad1"), null);
  assert.equal(m.get("bad2"), null);
});

test("/me：徽章用中央給的網址與圖案範圍；中央說沒有徽章就不顯示；中央讀不到才暫用本地備援", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" };
  const ISS = "https://id.hglobal1985.com";
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = (sub: string) => {
    const now = Math.floor(Date.now() / 1000);
    const h = b64({ alg: "RS256", typ: "at+jwt", kid: "k1" });
    const p = b64({ iss: ISS, aud: ISS, app_id: "learn", sub, exp: now + 600 });
    return `${h}.${p}.${createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey).toString("base64url")}`;
  };
  let rankValue = "diamond";
  const defsDown = false;
  const options = [
    { value: "none", label: "無", badge_url: null, badge: null },
    { value: "diamond", label: "鑽石", badge_url: "https://id.hglobal1985.com/badges/diamond.png?v=3", badge: { width: 380, height: 720, art_top: 137, art_bottom: 593 } },
  ];
  setCentralFetch((url) => {
    const ok = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
    if (url.endsWith("/oauth/jwks")) return ok({ keys: [jwk] });
    if (url.endsWith("/v1/me/amway")) return ok({ enabled: true, fields: { education_system: { value: "寰宇" }, education_center: { value: "台北 100" }, rank: { value: rankValue } } });
    if (url.endsWith("/v1/amway/field-definitions")) return defsDown ? Promise.resolve(new Response("{}", { status: 503 })) : ok([{ key: "rank", options }]);
    if (url.endsWith("/v1/me/profile")) return ok({ fields: { display_name: { value: "會員" } } });
    if (url.endsWith("/v1/eligibility/context")) return ok({ member_id: "m_b", roles: [], hglobal_verified: true, center: null });
    if (url.includes("/v1/vocab/suggestions")) return ok({ suggestions: [] });
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
  const env: Env = { DB: createTestDb() };
  const me = async () => ((await (await handleApi(new Request("https://learn.test/api/v2/me?fresh=1", { headers: { authorization: `Bearer ${token("m_b")}` } }), env)).json()) as { member: Member }).member;
  const a = await me();
  assert.equal(a.rankBadge, "https://id.hglobal1985.com/badges/diamond.png?v=3");
  assert.deepEqual(a.rankBadgeArt, { width: 380, height: 720, top: 137, bottom: 593 });
  rankValue = "none";
  const b = await me();
  assert.equal(b.rankBadge, null); // 中央說沒有徽章
  assert.equal(b.rankBadgeArt, null);
});
