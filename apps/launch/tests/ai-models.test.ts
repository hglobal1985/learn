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
  const p = await call("PUT", "/admin/ai-models", admin, { selection: { keywords: "claude-haiku-5-5", transcribe: "@cf/baai/bge-m3" } });
  assert.equal(p.data.selection.keywords, "claude-haiku-5-5");
  assert.equal(p.data.selection.transcribe, "@cf/openai/whisper-large-v3-turbo"); // 種類不符被擋
  assert.equal((await call("GET", "/admin/ai-models", admin)).data.selection.keywords, "claude-haiku-5-5");
});
