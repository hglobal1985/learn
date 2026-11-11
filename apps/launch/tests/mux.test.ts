import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { muxPlaybackUrl } from "../src/mux.ts";
import { createTestDb } from "./sqlite-d1.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1 = privateKey.export({ format: "pem", type: "pkcs1" }).toString();
const pkcs8 = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const pkcs8Der = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

const formats: Record<string, string> = {
  "Mux 後台格式：Base64(PKCS#1 PEM)": Buffer.from(pkcs1).toString("base64"),
  "PKCS#1 PEM": pkcs1,
  "PKCS#8 PEM": pkcs8,
  "Base64(PKCS#8 PEM)": Buffer.from(pkcs8).toString("base64"),
  "Base64 PKCS#8 DER": pkcs8Der,
  "字面 \\n 的 PEM": pkcs1.replace(/\n/g, "\\n"),
};

for (const [name, secret] of Object.entries(formats)) {
  test(`Mux 私鑰格式：${name}`, async () => {
    const url = await muxPlaybackUrl({ DB: createTestDb(), MUX_SIGNING_KEY_ID: ` key-${name.length} \n`, MUX_SIGNING_PRIVATE_KEY: secret }, "PlaybackId123");
    assert.ok(url, "應該簽出網址");
    const [h, p, s] = new URL(url!).searchParams.get("token")!.split(".");
    assert.equal(JSON.parse(Buffer.from(h, "base64url").toString()).kid, `key-${name.length}`, "金鑰 ID 去除空白");
    assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
  });
}

test("Mux 私鑰無效時回傳 null（不丟出錯誤、不洩漏內容）", async () => {
  assert.equal(await muxPlaybackUrl({ DB: createTestDb(), MUX_SIGNING_KEY_ID: "k", MUX_SIGNING_PRIVATE_KEY: "not a key" }, "x"), null);
});

test("管理員讀取 Mux 影片清單：未設定、權杖錯誤、正常分頁、只列可匯入的 Signed ID；學員不可用", async () => {
  const { handleApi } = await import("../src/api.ts");
  const { setMuxFetch } = await import("../src/mux.ts");
  const calls: string[] = [];
  setMuxFetch(async (url, init) => {
    calls.push(url);
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Basic ${Buffer.from("tid:tsecret").toString("base64")}`) return new Response("{}", { status: 401 });
    const second = new URL(url).searchParams.get("cursor") === "next1";
    return new Response(
      JSON.stringify({
        data: second
          ? [{ id: "a3", status: "ready", duration: 61.2, created_at: "1700000000", playback_ids: [{ id: "PubOnly", policy: "public" }] }]
          : [{ id: "a1", status: "ready", duration: 125.5, created_at: "1700000000", meta: { title: "第一堂：導讀" }, playback_ids: [{ id: "SignedPlaybackId01", policy: "signed" }] }],
        next_cursor: second ? null : "next1",
      }),
    );
  });
  const base = { DB: createTestDb(), DEMO_LOGIN: "on", MUX_SIGNING_KEY_ID: "k1", MUX_SIGNING_PRIVATE_KEY: pkcs8 };
  const call = async (env: object, path: string, token?: string, method = "GET", body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env as never,
    );
    return { status: res.status, data: (await res.json()) as Record<string, unknown> };
  };
  const login = async (env: object, sub: string) => (await call(env, "/auth/demo", undefined, "POST", { sub })).data.token as string;

  const admin = await login(base, "demo-admin");
  const student = await login(base, "demo-student");
  const notConfigured = await call(base, "/admin/mux/assets", admin);
  assert.equal(notConfigured.status, 503);
  assert.equal((notConfigured.data.error as { code: string }).code, "mux_api_not_configured");

  const wrong = { ...base, MUX_TOKEN_ID: "tid", MUX_TOKEN_SECRET: "nope" };
  assert.equal(((await call(wrong, "/admin/mux/assets", admin)).data.error as { code: string }).code, "mux_api_unauthorized");

  const env = { ...base, MUX_TOKEN_ID: "tid", MUX_TOKEN_SECRET: "tsecret" };
  assert.equal((await call(env, "/admin/mux/assets", student)).status, 403);
  const page1 = await call(env, "/admin/mux/assets", admin);
  const [a1] = page1.data.assets as { title: string; signedPlaybackId: string; durationSeconds: number; thumbnailUrl: string; createdAt: string }[];
  assert.equal(a1.title, "第一堂：導讀");
  assert.equal(a1.signedPlaybackId, "SignedPlaybackId01");
  assert.equal(a1.createdAt, "2023-11-14T22:13:20.000Z");
  assert.match(a1.thumbnailUrl, /^https:\/\/image\.mux\.com\/SignedPlaybackId01\/thumbnail\.jpg\?token=/);
  const thumbClaims = JSON.parse(Buffer.from(new URL(a1.thumbnailUrl).searchParams.get("token")!.split(".")[1], "base64url").toString());
  assert.equal(thumbClaims.aud, "t");
  assert.equal(page1.data.nextCursor, "next1");
  const page2 = await call(env, "/admin/mux/assets?cursor=next1", admin);
  const [a3] = page2.data.assets as { signedPlaybackId: string | null; thumbnailUrl: string | null }[];
  assert.equal(a3.signedPlaybackId, null, "只有公開 ID 的影片不可匯入");
  assert.equal(a3.thumbnailUrl, null);
  assert.equal(page2.data.nextCursor, null);
  assert.ok(calls.every((u) => u.startsWith("https://api.mux.com/video/v1/assets?limit=50")));

  // 選定後帶入章節：Playback ID 與影片長度（分鐘，無條件進位）
  assert.equal((await call(env, "/admin/lessons/start-welcome", admin, "PATCH", { mediaType: "mux", mediaRef: "SignedPlaybackId01", minutes: 3 })).status, 200);
  assert.equal((await call(env, "/admin/lessons/start-welcome", admin, "PATCH", { mediaType: "mux", mediaRef: "SignedPlaybackId01", minutes: -1 })).status, 400);
  const detail = await call(env, "/courses/start", admin);
  const lesson = (detail.data.lessons as { id: string; minutes: number; media: { ref: string } }[])[0];
  assert.equal(lesson.minutes, 3);
  assert.equal(lesson.media.ref, "SignedPlaybackId01");
});
