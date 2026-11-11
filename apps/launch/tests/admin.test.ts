import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail, Playback } from "../src/contract.ts";
import type { Env, R2Bucket } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

/** 記憶體版 R2（測試用）。 */
function fakeR2(): R2Bucket & { objects: Map<string, { data: Uint8Array; type?: string }> } {
  const objects = new Map<string, { data: Uint8Array; type?: string }>();
  const uploads = new Map<string, { key: string; type?: string; parts: Map<number, Uint8Array> }>();
  return {
    objects,
    async head(key) {
      const o = objects.get(key);
      return o ? { size: o.data.byteLength, httpMetadata: { contentType: o.type } } : null;
    },
    async get(key, opts) {
      const o = objects.get(key);
      if (!o) return null;
      const r = opts?.range ? o.data.slice(opts.range.offset, opts.range.offset + opts.range.length) : o.data;
      return { size: o.data.byteLength, httpMetadata: { contentType: o.type }, body: new Response(r as Uint8Array<ArrayBuffer>).body! };
    },
    async delete(key) {
      objects.delete(key);
    },
    async createMultipartUpload(key, opts) {
      const id = `u${uploads.size + 1}`;
      uploads.set(id, { key, type: opts?.httpMetadata?.contentType, parts: new Map() });
      return { uploadId: id };
    },
    resumeMultipartUpload(key, uploadId) {
      const u = uploads.get(uploadId)!;
      assert.equal(u.key, key);
      return {
        async uploadPart(n, value) {
          u.parts.set(n, new Uint8Array(value));
          return { partNumber: n, etag: `e${n}` };
        },
        async complete(parts) {
          const chunks = parts.sort((a, b) => a.partNumber - b.partNumber).map((p) => u.parts.get(p.partNumber)!);
          const data = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
          let off = 0;
          for (const c of chunks) {
            data.set(c, off);
            off += c.byteLength;
          }
          objects.set(key, { data, type: u.type });
        },
      };
    },
  };
}

function setup(extra: Partial<Env> = {}) {
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", ...extra };
  const raw = (method: string, path: string, opts: { token?: string; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> } = {}) =>
    handleApi(
      new Request(`https://learn.test${path.startsWith("/api") ? path : `/api/v2${path}`}`, {
        method,
        headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
        body: (opts.bytes as Uint8Array<ArrayBuffer> | undefined) ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      }),
      env,
    );
  const call = async <T = Record<string, unknown>,>(method: string, path: string, opts: Parameters<typeof raw>[2] = {}) => {
    const res = await raw(method, path, opts);
    return { status: res.status, data: (await res.json()) as T };
  };
  const login = async (sub: string) => (await call<{ token: string }>("POST", "/auth/demo", { body: { sub } })).data.token;
  return { env, raw, call, login };
}

test("管理員新增、修改、刪除課程；新課程預設未上架；學員不可操作", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  const student = await login("demo-student");
  assert.equal((await call("POST", "/admin/courses", { token: student, body: { title: "x" } })).status, 403);
  assert.equal((await call("POST", "/admin/courses", { token: admin, body: { title: " " } })).status, 400);
  const created = await call<CourseDetail>("POST", "/admin/courses", {
    token: admin,
    body: { title: "銅章會議", subtitle: "每月一次", teacher: "寰宇總部", category: "系列課程", priceTwd: 50, minRankCode: "r15", theme: "gold", description: "介紹" },
  });
  assert.equal(created.status, 200);
  const c = created.data;
  assert.equal(c.status, "draft");
  assert.equal(c.description, "介紹");
  assert.equal(c.minRank.code, "r15");
  assert.equal(c.lessons.length, 1, "自動建立第 1 堂");
  assert.equal((await call("GET", `/courses/${c.id}`, { token: student })).status, 404, "未上架學員看不到");
  const patched = await call<CourseDetail>("PATCH", `/admin/courses/${c.id}`, { token: admin, body: { priceTwd: 0, status: "published", title: "銅章會議（新）" } });
  assert.equal(patched.data.title, "銅章會議（新）");
  assert.equal(patched.data.free, true, "付費可改免費");
  assert.equal((await call("PATCH", `/admin/courses/${c.id}`, { token: admin, body: { priceTwd: -1 } })).status, 400);
  // 有人報名後不能刪，只能下架
  const silver = await login("demo-silver");
  await call("PATCH", `/admin/courses/${c.id}`, { token: admin, body: { minRankCode: "none" } });
  assert.equal((await call("POST", "/orders", { token: silver, body: { courseIds: [c.id] } })).status, 200);
  assert.equal((await call("DELETE", `/admin/courses/${c.id}`, { token: admin })).status, 409);
  const empty = (await call<CourseDetail>("POST", "/admin/courses", { token: admin, body: { title: "暫存" } })).data;
  assert.equal((await call("DELETE", `/admin/courses/${empty.id}`, { token: admin })).status, 200);
  assert.equal((await call("GET", `/courses/${empty.id}`, { token: admin })).status, 404);
});

test("章節：新增、改名、排序、刪除後自動重新編號", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  let d = (await call<CourseDetail>("POST", "/admin/courses/start/lessons", { token: admin, body: { title: "第五堂" } })).data;
  assert.deepEqual(d.lessons.map((l) => l.position), [1, 2, 3, 4, 5]);
  const fifth = d.lessons[4].id;
  await call("PATCH", `/admin/lessons/${fifth}`, { token: admin, body: { title: "加映場" } });
  const order = [fifth, ...d.lessons.slice(0, 4).map((l) => l.id)];
  d = (await call<CourseDetail>("POST", "/admin/courses/start/lessons/order", { token: admin, body: { ids: order } })).data;
  assert.equal(d.lessons[0].title, "加映場");
  assert.equal((await call("POST", "/admin/courses/start/lessons/order", { token: admin, body: { ids: order.slice(1) } })).status, 400);
  await call("DELETE", `/admin/lessons/${d.lessons[1].id}`, { token: admin });
  d = (await call<CourseDetail>("GET", "/courses/start", { token: admin })).data;
  assert.deepEqual(d.lessons.map((l) => l.position), [1, 2, 3, 4]);
});

test("時間軸分段：設定時分秒區間，長度自動計算，播放資訊帶區間", async () => {
  const { call, login } = setup();
  const admin = await login("demo-admin");
  const student = await login("demo-student");
  const id = "start-foundation";
  assert.equal((await call("PATCH", `/admin/lessons/${id}`, { token: admin, body: { startSeconds: 600, endSeconds: 300 } })).status, 400, "結束需晚於開始");
  await call("PATCH", `/admin/lessons/${id}`, { token: admin, body: { mediaType: "youtube", mediaRef: "dQw4w9WgXcQ", startSeconds: 3725, endSeconds: 5025 } });
  const d = (await call<CourseDetail>("GET", "/courses/start", { token: student })).data;
  const l = d.lessons.find((x) => x.id === id)!;
  assert.equal(l.minutes, 22, "1300 秒 → 22 分鐘");
  assert.deepEqual([l.start, l.end], [3725, 5025]);
  await call("POST", "/orders", { token: student, body: { courseIds: ["start"] } });
  const p = (await call<Playback>("GET", `/courses/start/lessons/${id}/playback`, { token: student })).data;
  assert.deepEqual(p, { kind: "youtube", videoId: "dQw4w9WgXcQ", start: 3725, end: 5025 });
  await call("PATCH", `/admin/lessons/${id}`, { token: admin, body: { startSeconds: null, endSeconds: null } });
  assert.deepEqual((await call<Playback>("GET", `/courses/start/lessons/${id}/playback`, { token: student })).data, { kind: "youtube", videoId: "dQw4w9WgXcQ", start: null, end: null });
});

test("音檔：分段上傳到 R2、只有開通學員拿得到簽名網址、支援 Range、竄改簽名被拒", async () => {
  const r2 = fakeR2();
  const noStorage = setup();
  const a0 = await noStorage.login("demo-admin");
  assert.equal((await noStorage.call("POST", "/admin/lessons/start-review/audio/start", { token: a0, body: { fileName: "a.mp3", contentType: "audio/mpeg", size: 10 } })).status, 503);

  const { call, raw, login } = setup({ MEDIA: r2, MEDIA_URL_SECRET: "test-secret" });
  const admin = await login("demo-admin");
  const student = await login("demo-student");
  assert.equal((await call("POST", "/admin/lessons/start-review/audio/start", { token: admin, body: { fileName: "a.exe", contentType: "application/x-msdownload", size: 10 } })).status, 400);
  const { key, uploadId } = (await call<{ key: string; uploadId: string }>("POST", "/admin/lessons/start-review/audio/start", { token: admin, body: { fileName: "第4堂.MP3", contentType: "audio/mpeg", size: 10 } })).data;
  assert.match(key, /^audio\/start-review\/[\w-]+\.mp3$/);
  const parts = [];
  for (const [n, bytes] of [[1, [0, 1, 2, 3, 4]], [2, [5, 6, 7, 8, 9]]] as const) {
    const r = await call<{ partNumber: number; etag: string }>("PUT", `/admin/lessons/start-review/audio/part?key=${encodeURIComponent(key)}&uploadId=${uploadId}&part=${n}`, { token: admin, bytes: new Uint8Array(bytes) });
    parts.push(r.data);
  }
  assert.equal((await call("PUT", `/admin/lessons/start-review/audio/part?key=audio/other/x.mp3&uploadId=${uploadId}&part=1`, { token: admin, bytes: new Uint8Array([1]) })).status, 400, "不能寫到別堂");
  assert.equal((await call("POST", "/admin/lessons/start-review/audio/complete", { token: admin, body: { key, uploadId, parts, durationSeconds: 125 } })).status, 200);
  const lesson = (await call<CourseDetail>("GET", "/courses/start", { token: admin })).data.lessons.find((l) => l.id === "start-review")!;
  assert.equal(lesson.kind, "audio");
  assert.equal(lesson.minutes, 3);

  assert.equal((await call("GET", "/courses/start/lessons/start-review/playback", { token: student })).status, 403, "未報名");
  await call("POST", "/orders", { token: student, body: { courseIds: ["start"] } });
  const p = (await call<{ kind: string; url: string }>("GET", "/courses/start/lessons/start-review/playback", { token: student })).data;
  assert.equal(p.kind, "audio");
  const full = await raw("GET", p.url);
  assert.equal(full.status, 200);
  assert.deepEqual([...new Uint8Array(await full.arrayBuffer())], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const part = await raw("GET", p.url, { headers: { range: "bytes=2-4" } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), "bytes 2-4/10");
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [2, 3, 4]);
  assert.equal((await raw("GET", p.url.replace(/s=./, "s=X"))).status, 403);
  assert.equal((await raw("GET", p.url.replace(/e=\d+/, "e=1"))).status, 403, "過期");

  // 換回影片來源時刪除舊音檔
  await call("PATCH", "/admin/lessons/start-review", { token: admin, body: { mediaType: "demo" } });
  assert.equal(r2.objects.size, 0);
});
