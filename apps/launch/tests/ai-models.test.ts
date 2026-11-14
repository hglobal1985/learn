import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

test("AI 模型：預設、切換、擋掉種類不符的模型、只有超級管理員能改", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = any>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: res.status, data: (await res.json()) as T };
  };
  const admin = (await call("POST", "/auth/demo", undefined, { sub: "demo-admin" })).data.token;
  const member = (await call("POST", "/auth/demo", undefined, { sub: "demo-student" })).data.token;
  assert.equal((await call("GET", "/admin/ai-models", member)).status, 403);
  const g = await call("GET", "/admin/ai-models", admin);
  assert.equal(g.status, 200);
  assert.equal(g.data.selection.transcribe, "@cf/openai/whisper-large-v3-turbo");
  const p = await call("PUT", "/admin/ai-models", admin, { settings: { freeOnly: false }, selection: { keywords: "claude-haiku-5-5", transcribe: "@cf/baai/bge-m3" } });
  assert.equal(p.data.selection.keywords, "claude-haiku-5-5");
  assert.equal(p.data.selection.transcribe, "@cf/openai/whisper-large-v3-turbo"); // 種類不符被擋
  assert.equal((await call("GET", "/admin/ai-models", admin)).data.selection.keywords, "claude-haiku-5-5");
});

import { AiStopped, estimateNeurons, markExhausted, refundAi, reserveAi, todayUsed, usageDay } from "../src/ai-models.ts";

test("AI 每日額度：超過上限自動停止、隔天自動恢復、只用免費額度時擋外部模型", async () => {
  const db = createTestDb();
  const day1 = new Date("2026-11-14T10:00:00Z");
  const day2 = new Date("2026-11-15T00:00:01Z");
  const whisper = "@cf/openai/whisper-large-v3-turbo";
  assert.equal(estimateNeurons(whisper, { minutes: 60 }), 2798); // 46.63 × 60
  // 上限 9000 點：3 個 60 分鐘（2798×3=8394）可以，第 4 個會超過而被擋
  for (let i = 0; i < 3; i++) await reserveAi(db, whisper, { minutes: 60 }, day1);
  await assert.rejects(() => reserveAi(db, whisper, { minutes: 60 }, day1), AiStopped);
  assert.equal(await todayUsed(db, usageDay(day1)), 8394);
  // 隔天（UTC 00:00＝台灣 08:00）自動恢復
  await reserveAi(db, whisper, { minutes: 60 }, day2);
  assert.equal(await todayUsed(db, usageDay(day2)), 2798);
  // 失敗還額度
  await refundAi(db, 2798, day2);
  assert.equal(await todayUsed(db, usageDay(day2)), 0);
  // Cloudflare 回報額度用完 → 當天直接停
  await markExhausted(db, day2);
  await assert.rejects(() => reserveAi(db, "@cf/baai/bge-m3", { inputTokens: 100 }, day2), AiStopped);
  // 只用免費額度（預設）時，外部模型被擋
  await assert.rejects(() => reserveAi(db, "claude-haiku-5-5", { inputTokens: 100 }, day1), AiStopped);
});

test("AI 設定：只用免費額度時不能選外部模型；可調每日上限", async () => {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on" };
  const call = async <T = any>(method: string, path: string, token: string, body?: unknown) => {
    const res = await handleApi(new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: res.status, data: (await res.json()) as T };
  };
  const admin = (await (await handleApi(new Request("https://learn.test/api/v2/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: "demo-admin" }) }), env)).json() as any).token;
  const g = await call("GET", "/admin/ai-models", admin);
  assert.equal(g.data.usage.freeOnly, true);
  assert.equal(g.data.usage.dailyCap, 9000);
  assert.equal(g.data.usage.used, 0);
  assert.equal((await call("PUT", "/admin/ai-models", admin, { selection: { keywords: "claude-haiku-5-5" } })).status, 409);
  const ok = await call("PUT", "/admin/ai-models", admin, { settings: { dailyCap: 5000, freeOnly: false }, selection: { keywords: "claude-haiku-5-5" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.usage.dailyCap, 5000);
  assert.equal(ok.data.selection.keywords, "claude-haiku-5-5");
  assert.equal((await call("PUT", "/admin/ai-models", admin, { settings: { dailyCap: 123 } })).data.usage.dailyCap, 5000); // 不合法的上限不採用
});
