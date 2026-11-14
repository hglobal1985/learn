import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { setCentralFetch } from "../src/central.ts";
import type { Member } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

const ISS = "https://id.hglobal1985.com";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function token(sub: string) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "RS256", typ: "at+jwt", kid: "k1" });
  const p = b64({ iss: ISS, aud: ISS, app_id: "learn", sub, exp: now + 600 });
  return `${h}.${p}.${createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey).toString("base64url")}`;
}

test("新會員：沒勾 Amway 也會提醒；會員中心暫時查不到不記住；fresh=1 立刻拿最新獎銜", async () => {
  // 模擬會員中心：amway 內容可隨時改，也可模擬暫時故障。
  let amway: unknown = { enabled: false, fields: {} };
  let amwayDown = false;
  setCentralFetch((url) => {
    const ok = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
    if (url.endsWith("/oauth/jwks")) return ok({ keys: [jwk] });
    if (url.endsWith("/v1/me/amway")) return amwayDown ? Promise.resolve(new Response("{}", { status: 503 })) : ok(amway);
    if (url.endsWith("/v1/amway/field-definitions")) return ok([{ key: "rank", options: [{ value: "none", label: "無" }, { value: "gold", label: "金章" }] }]);
    if (url.endsWith("/v1/me/profile")) return ok({ fields: { display_name: { value: "新會員" } } });
    if (url.endsWith("/v1/eligibility/context")) return ok({ member_id: "m_new", roles: [], hglobal_verified: false, center: null });
    if (url.includes("/v1/vocab/suggestions")) return ok({ suggestions: [] });
    return Promise.resolve(new Response("{}", { status: 404 }));
  });
  const env: Env = { DB: createTestDb() };
  const me = async (qs = "") =>
    ((await (await handleApi(new Request(`https://learn.test/api/v2/me${qs}`, { headers: { authorization: `Bearer ${token("m_new")}` } }), env)).json()) as { member: Member }).member;

  // ① 會員中心暫時查不到：不提醒，但也不能把「沒有缺漏」記住
  amwayDown = true;
  assert.deepEqual((await me("?fresh=1")).profileMissing ?? [], []);
  amwayDown = false;
  // ② 恢復後（不用等快取過期）：新會員還沒勾選 Amway → 提醒
  assert.ok(((await me()).profileMissing ?? []).length > 0);

  // ③ 會員中心審核通過獎銜後：一般請求可能還是舊的快取，fresh=1 一定拿到最新
  amway = { enabled: true, fields: { education_system: { value: "寰宇" }, education_center: { value: "台北 100" }, rank: { value: "gold" } } };
  const fresh = await me("?fresh=1");
  assert.equal(fresh.rankLabel, "金章");
  assert.deepEqual(fresh.profileMissing ?? [], []);
});
