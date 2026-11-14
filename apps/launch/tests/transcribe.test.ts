import assert from "node:assert/strict";
import { test } from "node:test";
import { AiStopped } from "../src/ai-models.ts";
import type { Env, R2Bucket } from "../src/d1.ts";
import { PART_BYTES, SINGLE_MAX, TranscribeError, findMp3Sync, planParts, transcribeNext, transcriptView } from "../src/transcribe.ts";
import { createTestDb } from "./sqlite-d1.ts";

function fakeBucket(files: Record<string, { data: Uint8Array; type: string }>): R2Bucket {
  return {
    head: async (k: string) => (files[k] ? { size: files[k].data.length, httpMetadata: { contentType: files[k].type } } : null),
    get: async (k: string, o?: { range?: { offset: number; length: number } }) => {
      const f = files[k];
      if (!f) return null;
      const d = o?.range ? f.data.subarray(o.range.offset, o.range.offset + o.range.length) : f.data;
      return { size: f.data.length, httpMetadata: { contentType: f.type }, body: new Response(d as unknown as BodyInit).body! };
    },
  } as unknown as R2Bucket;
}

/** 假 MP3：每 1000 位元組放一個同步字 FF FB。 */
function fakeMp3(size: number): Uint8Array {
  const d = new Uint8Array(size);
  for (let i = 0; i < size; i += 1000) (d[i] = 0xff), (d[i + 1] = 0xfb);
  return d;
}

async function setup(files: Record<string, { data: Uint8Array; type: string }>, lessonMinutes = 0) {
  const db = createTestDb();
  const sizes: number[] = [];
  const env: Env = {
    DB: db,
    MEDIA: fakeBucket(files),
    AI: { run: async (_m: string, input: any) => (sizes.push(Math.floor((input.audio.length * 3) / 4)), { text: `第${sizes.length}段` }) },
  };
  const course = await db.prepare("SELECT id FROM courses LIMIT 1").first<{ id: string }>();
  const id = "lesson-test-1";
  await db.prepare("INSERT INTO lessons (id, course_id, position, title, duration_minutes, media_type, media_ref) VALUES (?, ?, 99, '測試', ?, 'audio', ?)").bind(id, course!.id, lessonMinutes, Object.keys(files)[0]).run();
  return { db, env, id, sizes };
}

test("MP3 同步字與分段規劃", () => {
  assert.equal(findMp3Sync(new Uint8Array([1, 2, 0xff, 0xfb, 3])), 2);
  assert.equal(planParts(SINGLE_MAX, "a.m4a", "audio/mp4", 0).total, 1);
  assert.equal(planParts(PART_BYTES * 3 + 1, "a.mp3", "audio/mpeg", 0).total, 4);
  assert.throws(() => planParts(SINGLE_MAX + 1, "a.m4a", "audio/mp4", 0), TranscribeError);
});

test("小檔：一次轉完", async () => {
  const { db, env, id } = await setup({ "audio/x/a.m4a": { data: new Uint8Array(1000), type: "audio/mp4" } });
  const v = await transcribeNext(env, db, id);
  assert.equal(v.status, "done");
  assert.equal(v.text, "第1段");
  assert.equal((await transcriptView(db, id)).partsTotal, 1);
});

test("大 MP3：依序一段一段轉，每段位元組不重疊、加起來等於整檔，已完成不重做", async () => {
  const size = 7 * 1024 * 1024;
  const { db, env, id, sizes } = await setup({ "audio/x/a.mp3": { data: fakeMp3(size), type: "audio/mpeg" } });
  let v = await transcribeNext(env, db, id);
  assert.equal(v.partsTotal, 3);
  assert.equal(v.status, "partial");
  v = await transcribeNext(env, db, id);
  v = await transcribeNext(env, db, id);
  assert.equal(v.status, "done");
  assert.equal(v.text, "第1段\n第2段\n第3段");
  assert.equal(sizes.reduce((a, b) => a + b, 0) >= size - 4 && sizes.reduce((a, b) => a + b, 0) <= size + 4, true); // base64 長度換算有 ±3 位元組誤差
  const before = sizes.length;
  await transcribeNext(env, db, id); // 已完成：不再呼叫 AI
  assert.equal(sizes.length, before);
  const again = await transcribeNext(env, db, id, { restart: true });
  assert.equal(again.partsDone, 1); // 重來只做第一段
});

test("大 M4A（非 MP3）直接說明原因；非音檔章節不支援", async () => {
  const { db, env, id } = await setup({ "audio/x/a.m4a": { data: new Uint8Array(SINGLE_MAX + 10), type: "audio/mp4" } });
  await assert.rejects(() => transcribeNext(env, db, id), /MP3/);
  await db.prepare("UPDATE lessons SET media_type = 'youtube' WHERE id = ?").bind(id).run();
  await assert.rejects(() => transcribeNext(env, db, id), /音檔/);
});

test("每日額度用完就停、隔天接著做", async () => {
  const size = 7 * 1024 * 1024;
  // 章節長 300 分鐘 → 每段約 100 分鐘 ≈ 4663 點；今日上限 9000 點：第 1 段可以、第 2 段超過被擋
  const { db, env, id } = await setup({ "audio/x/a.mp3": { data: fakeMp3(size), type: "audio/mpeg" } }, 300);
  const day1 = new Date("2026-11-14T10:00:00Z");
  const day2 = new Date("2026-11-15T01:00:00Z");
  await transcribeNext(env, db, id, { now: day1 });
  await assert.rejects(() => transcribeNext(env, db, id, { now: day1 }), AiStopped);
  assert.equal((await transcriptView(db, id)).partsDone, 1);
  const v = await transcribeNext(env, db, id, { now: day2 }); // 隔天自動恢復，從第 2 段接著做
  assert.equal(v.partsDone, 2);
});

test("AI 失敗時還回預扣；回報額度用完時當天停止", async () => {
  const { db, env, id } = await setup({ "audio/x/a.m4a": { data: new Uint8Array(1000), type: "audio/mp4" } });
  const now = new Date("2026-11-14T10:00:00Z");
  env.AI = { run: async () => { throw new Error("boom"); } };
  await assert.rejects(() => transcribeNext(env, db, id, { now }), /逐字稿失敗/);
  const used = await db.prepare("SELECT neurons FROM ai_usage").first<{ neurons: number }>();
  assert.equal(used?.neurons ?? 0, 0);
  env.AI = { run: async () => { throw new Error("3036: You have used up your daily free allocation of 10,000 neurons"); } };
  await assert.rejects(() => transcribeNext(env, db, id, { now }), /額度已用完/);
  env.AI = { run: async () => ({ text: "x" }) };
  await assert.rejects(() => transcribeNext(env, db, id, { now }), AiStopped); // 當天不再送出
});
