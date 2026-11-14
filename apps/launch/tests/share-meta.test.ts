import assert from "node:assert/strict";
import { test } from "node:test";
import type { Env } from "../src/d1.ts";
import { withShareMeta } from "../src/og.ts";
import { createWorker } from "../src/worker.ts";
import { createTestDb } from "./sqlite-d1.ts";

const html = '<!doctype html><html><head><title>寰宇行動大學</title></head><body><noscript> You need to enable JavaScript to run this app. </noscript><div id="root"></div></body></html>';
const files = { "/index.html": { type: "text/html; charset=utf-8", data: btoa(unescape(encodeURIComponent(html))) } };

test("分享預覽：短網址標題＝名稱 | 寰宇行動大學，說明＝隨機學習金句；其他網址不變", async () => {
  const db = createTestDb();
  const env: Env = { DB: db, DEMO_LOGIN: "on" };
  await db.prepare("INSERT INTO short_links (slug, kind, value) VALUES ('us', 'series', '美國洛杉磯中心')").run();
  await db.prepare("DELETE FROM quotes").run();
  await db.prepare("INSERT INTO quotes (id, body, created_by) VALUES ('q1', '心若向陽，無畏悲傷 & \"成長\"', 'x')").run();
  const w = createWorker(files);
  const get = async (path: string) => (await w.fetch(new Request(`https://learn.test${path}`), env)).text();

  const page = await get("/us");
  assert.match(page, /<title>美國洛杉磯中心 \| 寰宇行動大學<\/title>/);
  assert.match(page, /property="og:title" content="美國洛杉磯中心 \| 寰宇行動大學"/);
  assert.match(page, /property="og:description" content="心若向陽，無畏悲傷 &amp; &quot;成長&quot;"/);
  assert.match(page, /property="og:image" content="https:\/\/learn\.test\/icon-512\.png"/);
  assert.match(page, /property="og:url" content="https:\/\/learn\.test\/us"/);
  // 不存在的縮寫、一般頁面：維持原本的網頁
  assert.equal(await get("/nope"), html);
  assert.equal(await get("/courses"), html);
  assert.equal(await get("/"), html);
  // 沒有任何金句時，說明退回網站名稱
  await db.prepare("DELETE FROM quotes").run();
  assert.match(await get("/us"), /property="og:description" content="寰宇行動大學"/);
  assert.equal(withShareMeta("<head></head>", { title: "a", description: "b", url: "u", image: "i" }).includes('content="b"'), true);
});
