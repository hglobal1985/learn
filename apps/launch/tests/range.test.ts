import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorker } from "../src/worker.ts";
import { createTestDb } from "./sqlite-d1.ts";

const video = Buffer.from(new Uint8Array(100).map((_, i) => i)).toString("base64");
const html = Buffer.from("<!doctype html><title>app</title>").toString("base64");
const worker = createWorker({
  "/index.html": { type: "text/html; charset=utf-8", data: html },
  "/media/orientation.mp4": { type: "video/mp4", data: video },
  "/_expo/static/js/web/entry-abc.js": { type: "text/javascript", data: html },
});
const env = { DB: createTestDb() };
const get = (path: string, headers: Record<string, string> = {}) => worker.fetch(new Request(`https://learn.test${path}`, { headers }), env);

test("影片支援 Range（iOS Safari 需要 206）", async () => {
  const full = await get("/media/orientation.mp4");
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  const first = await get("/media/orientation.mp4", { range: "bytes=0-1" });
  assert.equal(first.status, 206);
  assert.equal(first.headers.get("content-range"), "bytes 0-1/100");
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [0, 1]);
  assert.equal((await get("/media/orientation.mp4", { range: "bytes=90-" })).headers.get("content-range"), "bytes 90-99/100");
  assert.equal((await get("/media/orientation.mp4", { range: "bytes=-5" })).headers.get("content-range"), "bytes 95-99/100");
  assert.equal((await get("/media/orientation.mp4", { range: "bytes=200-300" })).status, 416);
});

test("App 路由回傳 index.html；缺檔 404；舊 /api 404；安全與快取標頭", async () => {
  const page = await get("/course/lead");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>app<\/title>/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal((await get("/missing.png")).status, 404);
  assert.equal((await get("/api/v1/videos")).status, 404);
  assert.match((await get("/_expo/static/js/web/entry-abc.js")).headers.get("cache-control") ?? "", /immutable/);
  assert.equal((await get("/api/v2/health")).status, 200);
});
