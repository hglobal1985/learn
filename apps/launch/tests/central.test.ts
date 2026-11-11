import assert from "node:assert/strict";
import { generateKeyPairSync, createSign, createVerify } from "node:crypto";
import { test, beforeEach } from "node:test";
import { handleApi, youtubeId } from "../src/api.ts";
import { setCentralFetch } from "../src/central.ts";
import type { CourseDetail, CourseSummary, Member, Order, Playback } from "../src/contract.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

const ISS = "https://id.hglobal1985.com";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "RS256", typ: "at+jwt", kid: "k1", ...header });
  const p = b64({ iss: ISS, aud: ISS, app_id: "learn", sub: "m_alice", exp: now + 600, ...claims });
  const sig = createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey).toString("base64url");
  return `${h}.${p}.${sig}`;
}

/** 模擬中央：alice 是白金（符合 ≤ platinum），bob 是超級管理員。 */
let central = { down: false, eligibilityCalls: 0 };
const ladder = ["none", "silver", "gold", "platinum", "emerald", "diamond"];
function fakeCentral(url: string, init?: RequestInit): Promise<Response> {
  const auth = new Headers(init?.headers).get("authorization") ?? "";
  const sub = auth ? JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString()).sub : null;
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  if (url.endsWith("/oauth/jwks")) return ok({ keys: [jwk] });
  if (central.down) return Promise.reject(new Error("offline"));
  if (url.endsWith("/v1/me/profile")) return ok({ fields: { display_name: { value: sub === "m_bob" ? "課務小明" : "愛麗絲" } } });
  if (url.endsWith("/v1/admin/me")) return Promise.resolve(new Response("{}", { status: 401 })); // 中央只接受網站本身的登入
  if (url.endsWith("/v1/apps/learn/handoff"))
    return sub === "m_bob" ? ok({ app_id: "learn", version: "x", text: "…" }) : Promise.resolve(new Response("{}", { status: 403 }));
  if (url.endsWith("/v1/eligibility/check-batch")) {
    central.eligibilityCalls++;
    const { rules } = JSON.parse(String(init?.body)) as { rules: { min_rank: string }[] };
    const mine = sub === "m_alice" ? ladder.indexOf("platinum") : 0;
    return ok({ results: rules.map((r) => ({ allowed: ladder.indexOf(r.min_rank) !== -1 && ladder.indexOf(r.min_rank) <= mine, reason: "x" })) });
  }
  return Promise.resolve(new Response("{}", { status: 404 }));
}

function setup(extra: Partial<Env> = {}) {
  const env: Env = { DB: createTestDb(), ...extra };
  return async <T = unknown,>(method: string, path: string, opts: { token?: string; body?: unknown; platform?: string } = {}) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.platform) headers["x-client-platform"] = opts.platform;
    const res = await handleApi(new Request(`https://learn.test/api/v2${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), env);
    return { status: res.status, data: (await res.json()) as T };
  };
}

beforeEach(() => {
  central = { down: false, eligibilityCalls: 0 };
  setCentralFetch(fakeCentral);
});

test("中央會員：驗證 Token，取得顯示名稱，不回傳獎銜", async () => {
  const call = setup();
  const me = await call<{ member: Member }>("GET", "/me", { token: token() });
  assert.equal(me.data.member.sub, "m_alice");
  assert.equal(me.data.member.name, "愛麗絲");
  assert.equal(me.data.member.rank, null);
  assert.equal(me.data.member.demo, false);
  assert.equal(me.data.member.role, "student");
});

test("不合格的 Token 一律視為未登入", async () => {
  const call = setup();
  const bad = [
    token({ app_id: "other" }),
    token({ aud: "https://evil.example" }),
    token({ exp: Math.floor(Date.now() / 1000) - 5 }),
    token({}, { typ: "JWT" }),
    token({}, { kid: "unknown" }),
    token().slice(0, -4) + "AAAA",
  ];
  for (const t of bad) assert.equal((await call<{ member: unknown }>("GET", "/me", { token: t })).data.member, null);
});

test("獎銜資格向中央查詢；中央連不上時一律不符合（fail closed）", async () => {
  const call = setup();
  const t = token();
  const list = await call<CourseSummary[]>("GET", "/courses", { token: t });
  assert.equal(list.data.find((c) => c.id === "lead")!.eligible, true, "白金課程");
  assert.equal(list.data.find((c) => c.id === "growth")!.eligible, false, "翡翠課程");
  assert.equal((await call("POST", "/orders", { token: t, body: { courseIds: ["growth"] } })).status, 403);
  setCentralFetch(fakeCentral); // 清空快取
  await call("GET", "/me", { token: t }); // 先載入金鑰
  central.down = true;
  const offline = await call<CourseSummary[]>("GET", "/courses", { token: t });
  assert.equal(offline.data.find((c) => c.id === "lead")!.eligible, false);
  assert.equal(offline.data.find((c) => c.id === "start")!.eligible, true, "不限獎銜只需登入");
});

test("中央會員領課、資料只以 sub 關聯；超級管理員可審核", async () => {
  const call = setup();
  const alice = token();
  const bob = token({ sub: "m_bob" });
  const [order] = (await call<Order[]>("POST", "/orders", { token: alice, body: { courseIds: ["share"] } })).data;
  assert.equal(order.memberName, "愛麗絲");
  assert.equal((await call("POST", `/admin/orders/${order.id}/review`, { token: alice, body: { approve: true } })).status, 403);
  const approved = await call<Order>("POST", `/admin/orders/${order.id}/review`, { token: bob, body: { approve: true } });
  assert.equal(approved.data.status, "opened");
  assert.equal((await call<CourseDetail>("GET", "/courses/share", { token: alice })).data.enrollment, "opened");
});

test("關閉模擬登入後，模擬帳號 API 與舊 Token 都失效", async () => {
  const on = setup({ DEMO_LOGIN: "on" });
  assert.equal((await on<{ demoLogin: boolean }>("GET", "/config")).data.demoLogin, true);
  const off = setup();
  assert.equal((await off<{ demoLogin: boolean }>("GET", "/config")).data.demoLogin, false);
  assert.equal((await off("GET", "/demo-members")).status, 404);
  assert.equal((await off("POST", "/auth/demo", { body: { sub: "demo-admin" } })).status, 404);
});

test("YouTube 網址解析", () => {
  for (const u of ["dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/embed/dQw4w9WgXcQ"])
    assert.equal(youtubeId(u), "dQw4w9WgXcQ", u);
  for (const u of ["https://evil.com/watch?v=dQw4w9WgXcQ", "abc", "javascript:alert(1)"]) assert.equal(youtubeId(u), null, u);
});

test("管理員設定章節影片：YouTube 直接播放；Mux 未設金鑰回 503、設定後簽出播放網址", async () => {
  const { publicKey: mp, privateKey: mk } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = mk.export({ format: "pem", type: "pkcs8" }).toString();
  for (const secrets of [{}, { MUX_SIGNING_KEY_ID: "sk1", MUX_SIGNING_PRIVATE_KEY: Buffer.from(pem).toString("base64") }]) {
    const call = setup(secrets);
    const admin = token({ sub: "m_bob" });
    const alice = token();
    assert.equal((await call("PATCH", "/admin/lessons/start-welcome", { token: alice, body: { mediaType: "youtube", mediaRef: "dQw4w9WgXcQ" } })).status, 403);
    assert.equal((await call("PATCH", "/admin/lessons/start-welcome", { token: admin, body: { mediaType: "youtube", mediaRef: "not a video" } })).status, 400);
    await call("PATCH", "/admin/lessons/start-welcome", { token: admin, body: { mediaType: "youtube", mediaRef: "https://youtu.be/dQw4w9WgXcQ" } });
    await call("PATCH", "/admin/lessons/start-foundation", { token: admin, body: { mediaType: "mux", mediaRef: "AbCdEfGhIjKlMn012" } });
    const detail = await call<CourseDetail>("GET", "/courses/start", { token: admin });
    assert.deepEqual(detail.data.lessons[0].media, { type: "youtube", ref: "dQw4w9WgXcQ" });
    assert.equal((await call<CourseDetail>("GET", "/courses/start", { token: alice })).data.lessons[0].media, undefined, "學員看不到影片來源");
    await call("POST", "/orders", { token: alice, body: { courseIds: ["start"] } });
    const yt = await call<Playback>("GET", "/courses/start/lessons/start-welcome/playback", { token: alice });
    assert.deepEqual(yt.data, { kind: "youtube", videoId: "dQw4w9WgXcQ" });
    const mux = await call<Playback>("GET", "/courses/start/lessons/start-foundation/playback", { token: alice });
    if (!("MUX_SIGNING_KEY_ID" in secrets)) {
      assert.equal(mux.status, 503);
      assert.doesNotMatch(JSON.stringify(mux.data), /AbCdEfGh/, "未設定時不洩漏 Playback ID");
    } else {
      assert.equal(mux.data.kind, "hls");
      const url = new URL((mux.data as { url: string }).url);
      assert.equal(url.pathname, "/AbCdEfGhIjKlMn012.m3u8");
      const [h, p, s] = url.searchParams.get("token")!.split(".");
      assert.equal(JSON.parse(Buffer.from(h, "base64url").toString()).kid, "sk1");
      assert.equal(JSON.parse(Buffer.from(p, "base64url").toString()).aud, "v");
      assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(mp, Buffer.from(s, "base64url")));
    }
  }
});

test("LEARN_ADMIN_SUBS 指定的會員也是管理員；其他人不是", async () => {
  const call = setup({ LEARN_ADMIN_SUBS: " m_carol , m_dave" });
  const carol = await call<{ member: Member }>("GET", "/me", { token: token({ sub: "m_carol" }) });
  assert.equal(carol.data.member.role, "admin");
  const erin = await call<{ member: Member }>("GET", "/me", { token: token({ sub: "m_erin" }) });
  assert.equal(erin.data.member.role, "student");
});
