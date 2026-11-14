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
  // 關閉「限制免費額度」開關後不再擋（仍記錄用量）；重新開啟又會擋
  const { saveSettings, DEFAULT_AI_SETTINGS } = await import("../src/ai-models.ts");
  await saveSettings(db, { ...DEFAULT_AI_SETTINGS, capEnabled: false });
  await reserveAi(db, "@cf/baai/bge-m3", { inputTokens: 100 }, day2);
  await saveSettings(db, DEFAULT_AI_SETTINGS);
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
  assert.equal(g.data.usage.capEnabled, true);
  assert.equal((await call("PUT", "/admin/ai-models", admin, { selection: { keywords: "claude-haiku-5-5" } })).status, 409);
  const ok = await call("PUT", "/admin/ai-models", admin, { settings: { dailyCap: 5000, freeOnly: false }, selection: { keywords: "claude-haiku-5-5" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.usage.dailyCap, 5000);
  assert.equal(ok.data.selection.keywords, "claude-haiku-5-5");
  assert.equal((await call("PUT", "/admin/ai-models", admin, { settings: { dailyCap: 123 } })).data.usage.dailyCap, 5000); // 不合法的上限不採用
});

test("AI 金鑰狀態只回報有無；測試連線經過額度閘門", async () => {
  const calls: string[] = [];
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", AI: { run: async (m) => (calls.push(m), {}) }, ANTHROPIC_API_KEY: "sk-secret-value" };
  const call = async (method: string, path: string, token: string, body?: unknown) => {
    const res = await handleApi(new Request(`https://learn.test/api/v2${path}`, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: res.status, text: await res.text() };
  };
  const admin = ((await (await handleApi(new Request("https://learn.test/api/v2/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: "demo-admin" }) }), env)).json()) as any).token;
  const g = await call("GET", "/admin/ai-models", admin);
  assert.ok(!g.text.includes("sk-secret-value")); // 絕不回傳金鑰內容
  assert.deepEqual(JSON.parse(g.text).keys.map((k: any) => [k.key, k.ready]), [["workers_ai", true], ["anthropic", true]]);
  const t = await call("POST", "/admin/ai-models/test", admin, { target: "workers_ai" });
  assert.equal(t.status, 200);
  assert.deepEqual(calls, ["@cf/baai/bge-m3"]);
  assert.ok(JSON.parse(t.text).view.usage.used >= 1);
  // 預設「只用免費模型」：Claude 測試被擋，不會真的送出
  assert.equal((await call("POST", "/admin/ai-models/test", admin, { target: "anthropic" })).status, 429);
});

import { BudgetStopped, callClaude, costMicroUsd, estimateTokens, loadSettings, monthSpentMicro, reserveUsd, saveSettings as saveAiSettings, DEFAULT_AI_SETTINGS as AI_DEFAULTS } from "../src/ai-models.ts";

test("Claude 每月預算：牌價換算、超過 100 美元前一律擋下、用實際用量結算、隔月歸零", async () => {
  // 牌價：Haiku 5.5 每百萬 $0.10 進／$0.50 出；Sonnet 5.5 $2／$10
  assert.equal(costMicroUsd("claude-haiku-5-5", 100_000, 1_000_000), 510_000);
  assert.equal(costMicroUsd("claude-sonnet-5-5", 1_000_000, 1_000_000), 12_000_000);
  assert.equal(costMicroUsd("claude-haiku-5-5", 200_000, 0), 100_000); // 輸入超過 10 萬 token：$0.50
  assert.ok(estimateTokens("你好") >= 4);

  const db = createTestDb();
  const jan = new Date("2026-11-20T00:00:00Z");
  // 100 美元＝1 億微美元。Sonnet 一次最壞 100 萬進＋100 萬出＝12 美元：8 次 96 美元可以，第 9 次會超過
  for (let i = 0; i < 8; i++) await reserveUsd(db, "claude-sonnet-5-5", 1_000_000, 1_000_000, jan);
  await assert.rejects(() => reserveUsd(db, "claude-sonnet-5-5", 1_000_000, 1_000_000, jan), BudgetStopped);
  assert.equal(await monthSpentMicro(db, "2026-11"), 96_000_000);
  // 小額的還可以用到剛好 100 美元，但絕不超過
  await reserveUsd(db, "claude-haiku-5-5", 100_000, 7_000_000, jan); // 0.01+3.5=3.51 美元 → 99.51
  await assert.rejects(() => reserveUsd(db, "claude-haiku-5-5", 100_000, 1_000_000, jan), BudgetStopped); // +0.51 = 100.02 超過
  assert.ok((await monthSpentMicro(db, "2026-11")) <= 100_000_000);
  // 下個月（UTC 12/1）自動歸零恢復
  await reserveUsd(db, "claude-sonnet-5-5", 1_000_000, 1_000_000, new Date("2026-12-01T00:00:01Z"));
  assert.equal(await monthSpentMicro(db, "2026-12"), 12_000_000);
});

test("callClaude：用回應的 usage 結算、失敗還清預扣、沒設金鑰或只用免費模型時不送出", async () => {
  const db = createTestDb();
  const env: Env = { DB: db, ANTHROPIC_API_KEY: "sk-test-not-real" };
  const realFetch = globalThis.fetch;
  let sent = 0;
  let mode: "ok" | "401" = "ok";
  globalThis.fetch = (async () => {
    sent++;
    if (mode === "401") return new Response("{}", { status: 401 });
    return new Response(JSON.stringify({ content: [{ type: "text", text: "你好" }], usage: { input_tokens: 1000, output_tokens: 500 } }), { status: 200 });
  }) as typeof fetch;
  try {
    // 預設「只用免費模型」開著：不送出
    await assert.rejects(() => callClaude(env, db, "claude-haiku-5-5", { prompt: "hi", maxTokens: 100 }), AiStopped);
    assert.equal(sent, 0);
    await saveAiSettings(db, { ...AI_DEFAULTS, freeOnly: false });
    const r = await callClaude(env, db, "claude-haiku-5-5", { prompt: "hi", maxTokens: 1000 });
    assert.equal(r.text, "你好");
    // 實際：1000 進 × 0.1 + 500 出 × 0.5 = 350 微美元（預扣的差額已退回）
    assert.equal(await monthSpentMicro(db), 350);
    mode = "401";
    await assert.rejects(() => callClaude(env, db, "claude-haiku-5-5", { prompt: "hi", maxTokens: 1000 }), /金鑰不正確/);
    assert.equal(await monthSpentMicro(db), 350); // 失敗不計費
    // 預算已滿就完全不送出
    await db.prepare("UPDATE ai_spend SET micro_usd = 100000000").run();
    const before = sent;
    await assert.rejects(() => callClaude(env, db, "claude-haiku-5-5", { prompt: "hi", maxTokens: 1000 }), BudgetStopped);
    assert.equal(sent, before);
    // 沒金鑰
    await assert.rejects(() => callClaude({ DB: db }, db, "claude-haiku-5-5", { prompt: "hi", maxTokens: 10 }), /ANTHROPIC_API_KEY/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Claude 每月上限：選項最高 100，不能設更高", async () => {
  const db = createTestDb();
  assert.equal((await loadSettings(db)).claudeMonthlyCapUsd, 100);
  const { normalizeSettings } = await import("../src/ai-models.ts");
  assert.equal(normalizeSettings({ claudeMonthlyCapUsd: 500 }).claudeMonthlyCapUsd, 100);
  assert.equal(normalizeSettings({ claudeMonthlyCapUsd: 50 }).claudeMonthlyCapUsd, 50);
});
