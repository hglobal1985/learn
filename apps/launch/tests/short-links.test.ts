import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function setup() {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub })).data.token;
  const resolve = async (slug: string) => {
    const r = await call<{ kind: string; value: string }>("GET", `/short-links/${slug}`);
    return r.status === 200 ? r.data : null;
  };
  return { env, call, login, resolve };
}
type Item = { kind: string; value: string; slug: string | null };

test("短網址：設定、重複、格式、改名跟著走、刪除，並可解析成篩選網址", async () => {
  const { call, login, resolve } = setup();
  const admin = await login("demo-admin");
  const student = await login("demo-student");
  await call("POST", "/admin/keywords", admin, { kind: "category", value: "營養" });
  await call("POST", "/admin/keywords", admin, { kind: "series", value: "新手系列" });

  assert.equal((await call("GET", "/admin/short-links", student)).status, 403);
  const list = (await call<Item[]>("GET", "/admin/short-links", admin)).data;
  assert.deepEqual(list.filter((x) => x.value === "營養" || x.value === "新手系列").map((x) => x.slug), [null, null]);

  assert.equal((await call("PUT", "/admin/short-links", admin, { kind: "category", value: "營養", slug: "Bad Slug" })).status, 400);
  assert.equal((await call("PUT", "/admin/short-links", admin, { kind: "category", value: "營養", slug: "a" })).status, 400);
  assert.equal((await call("PUT", "/admin/short-links", admin, { kind: "location", value: "x", slug: "abc" })).status, 400);

  const ok = await call<Item[]>("PUT", "/admin/short-links", admin, { kind: "category", value: "營養", slug: "Nutrition" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.find((x) => x.value === "營養")?.slug, "nutrition");
  // 同一個縮寫不能給別的項目；同一項目可以改縮寫
  assert.equal((await call("PUT", "/admin/short-links", admin, { kind: "series", value: "新手系列", slug: "nutrition" })).status, 409);
  await call("PUT", "/admin/short-links", admin, { kind: "category", value: "營養", slug: "nutri" });
  await call("PUT", "/admin/short-links", admin, { kind: "series", value: "新手系列", slug: "newbie" });

  assert.deepEqual(await resolve("nutri"), { kind: "category", value: "營養" });
  assert.equal(await resolve("nutrition"), null); // 舊縮寫失效
  assert.deepEqual(await resolve("newbie"), { kind: "series", value: "新手系列" });
  assert.equal((await call("PUT", "/admin/short-links", admin, { kind: "category", value: "營養", slug: "courses" })).status, 400); // 與網站頁面同名

  // 改名後縮寫跟著走
  await call("PATCH", "/admin/keywords", admin, { kind: "series", from: "新手系列", to: "新手入門系列" });
  assert.deepEqual(await resolve("newbie"), { kind: "series", value: "新手入門系列" });

  await call("POST", "/admin/short-links/remove", admin, { kind: "series", value: "新手入門系列" });
  assert.equal(await resolve("newbie"), null);
  // 刪除關鍵字時縮寫一併刪除
  await call("POST", "/admin/keywords/remove", admin, { kind: "category", value: "營養" });
  assert.equal(await resolve("nutri"), null);
});
