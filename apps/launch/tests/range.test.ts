import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/index.ts";
import type { Env } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

const bytes = new Uint8Array(100).map((_, i) => i);
const env: Env = {
  DB: createTestDb(),
  ASSETS: { fetch: async () => new Response(bytes, { headers: { "content-type": "video/mp4" } }) },
};
const get = (range?: string) =>
  worker.fetch(new Request("https://learn.test/media/orientation.mp4", { headers: range ? { range } : {} }), env);

test("影片支援 Range（iOS Safari 需要 206）", async () => {
  const full = await get();
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  const first = await get("bytes=0-1");
  assert.equal(first.status, 206);
  assert.equal(first.headers.get("content-range"), "bytes 0-1/100");
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [0, 1]);
  const open = await get("bytes=90-");
  assert.equal(open.headers.get("content-range"), "bytes 90-99/100");
  const suffix = await get("bytes=-5");
  assert.equal(suffix.headers.get("content-range"), "bytes 95-99/100");
  assert.equal((await get("bytes=200-300")).status, 416);
});

test("非 API 的 /api 路徑回 404，網頁加上安全標頭", async () => {
  assert.equal((await worker.fetch(new Request("https://learn.test/api/v1/videos"), env)).status, 404);
  const page = await worker.fetch(new Request("https://learn.test/courses"), env);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
});
