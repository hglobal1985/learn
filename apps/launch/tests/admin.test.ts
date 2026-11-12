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
    async put(key, value, opts) {
      objects.set(key, { data: new Uint8Array(value), type: opts?.httpMetadata?.contentType });
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

test("附件教材：只有管理員能上傳、已開通學員才拿得到下載網址、限制檔案類型、刪除章節時清掉檔案", async () => {
  const r2 = fakeR2();
  const { call, raw, login } = setup({ MEDIA: r2, MEDIA_URL_SECRET: "test-secret" });
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  const put = (token: string, name: string, bytes: number[]) => call<{ id: string; name: string; size: number }>("PUT", `/admin/lessons/start-review/attachments?name=${encodeURIComponent(name)}`, { token, bytes: new Uint8Array(bytes) });
  assert.equal((await put(student, "講義.pdf", [1])).status, 403, "學員不能上傳");
  assert.equal((await put(admin, "壞.exe", [1])).status, 400, "不支援的類型");
  assert.equal((await put(admin, "空.pdf", [])).status, 400, "空檔案");
  const up = await put(admin, "第4堂 講義.pdf", [1, 2, 3, 4]);
  assert.equal(up.status, 200);
  assert.equal(up.data.size, 4);
  assert.equal(r2.objects.size, 1);

  const path = "/courses/start/lessons/start-review/attachments";
  assert.equal((await call("GET", path, { token: student })).status, 403, "未報名");
  await call("POST", "/orders", { token: student, body: { courseIds: ["start"] } });
  const list = (await call<{ id: string; name: string; url: string }[]>("GET", path, { token: student })).data;
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "第4堂 講義.pdf");
  const file = await raw("GET", list[0].url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "application/pdf");
  assert.match(file.headers.get("content-disposition") ?? "", /^attachment; filename\*=UTF-8''/);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3, 4]);
  assert.equal((await raw("GET", list[0].url.replace(/s=./, "s=X"))).status, 403, "竄改簽名");
  assert.equal((await raw("GET", list[0].url.replace(/e=\d+/, "e=1"))).status, 403, "過期");
  assert.equal((await raw("GET", `/api/v2/media/file?k=audio/x&e=9999999999&s=x`)).status, 403, "不是附件鍵");

  // 刪除附件 → 檔案一併刪除；刪章節也會清掉
  assert.equal((await call("DELETE", `/admin/attachments/${list[0].id}`, { token: admin })).status, 200);
  assert.equal(r2.objects.size, 0);
  assert.equal((await put(admin, "第二份.zip", [9])).status, 200);
  assert.equal(r2.objects.size, 1);
  assert.equal((await call("DELETE", "/admin/lessons/start-review", { token: admin })).status, 200);
  assert.equal(r2.objects.size, 0, "刪章節時一併刪檔");
});

test("網址附件：自動判斷類型、自訂標題、只收 https、可改標題與網址、學員需開通才看得到", async () => {
  const { call, login } = setup({ MEDIA: fakeR2(), MEDIA_URL_SECRET: "test-secret" });
  const [admin, student] = await Promise.all(["demo-admin", "demo-student"].map(login));
  type A = { id: string; name: string; kind: string; type: string; url?: string };
  const add = (token: string, body: unknown) => call<A>("POST", "/admin/lessons/start-review/links", { token, body });
  assert.equal((await add(student, { url: "https://youtu.be/abc" })).status, 403, "學員不能新增");
  assert.equal((await add(admin, { url: "http://example.com/a" })).status, 400, "只收 https");
  assert.equal((await add(admin, { url: "javascript:alert(1)" })).status, 400);
  assert.equal((await add(admin, { url: "https://user:pw@example.com/" })).status, 400, "不收帳密網址");
  assert.equal((await add(admin, { url: "not a url" })).status, 400);
  const cases: [string, string, string][] = [
    ["https://www.youtube.com/watch?v=abc", "youtube", "YouTube 影片"],
    ["https://youtu.be/abc", "youtube", "YouTube 影片"],
    ["https://www.canva.com/design/DAF/view", "canva", "Canva 簡報"],
    ["https://docs.google.com/presentation/d/xyz/edit", "google_slides", "Google 簡報"],
    ["https://docs.google.com/document/d/xyz/edit", "google_docs", "Google 文件"],
    ["https://docs.google.com/spreadsheets/d/xyz/edit", "google_sheets", "Google 試算表"],
    ["https://forms.gle/abc", "google_forms", "Google 表單"],
    ["https://drive.google.com/file/d/xyz/view", "google_drive", "Google 雲端硬碟"],
    ["https://example.com/files/a.pdf", "pdf", "PDF 文件"],
    ["https://example.com/page", "web", "網頁連結"],
    ["example.org/no-scheme", "web", "網頁連結"],
  ];
  for (const [url, type, title] of cases) {
    const r = await add(admin, { url });
    assert.equal(r.status, 200, url);
    assert.deepEqual([r.data.kind, r.data.type, r.data.name], ["link", type, title], url);
  }
  const custom = (await add(admin, { url: "https://www.canva.com/design/x", title: "  第4堂 簡報  " })).data;
  assert.equal(custom.name, "第4堂 簡報");

  const path = "/courses/start/lessons/start-review/attachments";
  assert.equal((await call("GET", path, { token: student })).status, 403, "未報名看不到");
  await call("POST", "/orders", { token: student, body: { courseIds: ["start"] } });
  const list = (await call<A[]>("GET", path, { token: student })).data;
  assert.ok(list.some((a) => a.id === custom.id && a.url === "https://www.canva.com/design/x"));

  // 改標題與網址（網址改了，類型重新判斷）
  assert.equal((await call("PATCH", `/admin/attachments/${custom.id}`, { token: admin, body: { title: "" } })).status, 400);
  assert.equal((await call("PATCH", `/admin/attachments/${custom.id}`, { token: admin, body: { title: "影片版", url: "https://youtu.be/zzz" } })).status, 200);
  const after = (await call<A[]>("GET", "/admin/lessons/start-review/attachments", { token: admin })).data.find((a) => a.id === custom.id)!;
  assert.deepEqual([after.name, after.type, after.url], ["影片版", "youtube", "https://youtu.be/zzz"]);

  // 上傳檔案也能自訂標題，並判斷類型
  const up = await call<A>("PUT", `/admin/lessons/start-review/attachments?name=${encodeURIComponent("x.pptx")}&title=${encodeURIComponent("講義簡報")}`, { token: admin, bytes: new Uint8Array([1]) });
  assert.deepEqual([up.data.name, up.data.kind, up.data.type], ["講義簡報", "file", "ppt"]);
  assert.equal((await call("PATCH", `/admin/attachments/${up.data.id}`, { token: admin, body: { title: "改名", url: "https://example.com" } })).status, 400, "檔案不能改網址");
  assert.equal((await call("DELETE", `/admin/attachments/${custom.id}`, { token: admin })).status, 200);
});

test("刪除已有人報名的課程：先看影響、必須輸入 YES、報名／審核紀錄／進度一併刪除、不影響別門課", async () => {
  const { env, call, login } = setup({ MEDIA: fakeR2(), MEDIA_URL_SECRET: "s" });
  const [admin, s1, s2] = await Promise.all(["demo-admin", "demo-student", "demo-silver"].map(login));
  const mk = async (title: string) => (await call<{ id: string }>("POST", "/admin/courses", { token: admin, body: { title, priceTwd: 100 } })).data.id;
  const [a, b] = [await mk("要刪的課"), await mk("留下的課")];
  await call("PATCH", `/admin/courses/${a}`, { token: admin, body: { status: "published", minRank: "none" } });
  await call("PATCH", `/admin/courses/${b}`, { token: admin, body: { status: "published", minRank: "none" } });
  const [o1] = (await call<{ id: string }[]>("POST", "/orders", { token: s1, body: { courseIds: [a] } })).data;
  const [o2] = (await call<{ id: string }[]>("POST", "/orders", { token: s2, body: { courseIds: [a] } })).data;
  await call("POST", `/admin/orders/${o1.id}/review`, { token: admin, body: { action: "paid", paidTwd: 100 } });
  const keep = (await call<{ id: string }[]>("POST", "/orders", { token: s1, body: { courseIds: [b] } })).data[0];

  type Impact = { registrations: number; pending: number; opened: number; students: number; paidTwd: number; title: string };
  const impact = (await call<Impact>("GET", `/admin/courses/${a}/delete-impact`, { token: admin })).data;
  assert.deepEqual([impact.title, impact.registrations, impact.pending, impact.opened, impact.students, impact.paidTwd], ["要刪的課", 2, 1, 1, 1, 100]);
  assert.equal((await call("GET", `/admin/courses/${a}/delete-impact`, { token: s1 })).status, 403);

  assert.equal((await call("DELETE", `/admin/courses/${a}`, { token: admin })).status, 409, "沒帶確認不能刪");
  assert.equal((await call("DELETE", `/admin/courses/${a}`, { token: admin, body: { confirm: "yes" } })).status, 409, "小寫 yes 不算");
  assert.equal((await call("DELETE", `/admin/courses/${a}`, { token: s1, body: { confirm: "YES" } })).status, 403, "學員不能刪");
  assert.equal((await call("DELETE", `/admin/courses/${a}`, { token: admin, body: { confirm: "YES" } })).status, 200);

  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n;
  assert.equal(await count(`SELECT COUNT(*) AS n FROM courses WHERE id = '${a}'`), 0);
  assert.equal(await count(`SELECT COUNT(*) AS n FROM orders WHERE id IN ('${o1.id}', '${o2.id}')`), 0, "只含這門課的報名紀錄一併刪除");
  assert.equal(await count(`SELECT COUNT(*) AS n FROM enrollments WHERE course_id = '${a}'`), 0);
  assert.equal(await count(`SELECT COUNT(*) AS n FROM order_events WHERE order_id IN ('${o1.id}', '${o2.id}')`), 0);
  assert.equal(await count(`SELECT COUNT(*) AS n FROM orders WHERE id = '${keep.id}'`), 1, "別門課的報名紀錄不受影響");
  assert.equal((await call<unknown[]>("GET", "/notifications", { token: s2 })).data.some((n) => JSON.stringify(n).includes(o2.id)), false, "指向已刪報名的通知一併清掉");
  const log = await env.DB.prepare("SELECT detail FROM audit_log WHERE action = 'course.delete' AND target_id = ?").bind(a).first<{ detail: string }>();
  assert.equal(JSON.parse(log!.detail).registrations, 2, "稽核紀錄留下刪除統計");

  // 沒人報名的課程照舊可直接刪除
  const c = await mk("沒人報名");
  assert.equal((await call("DELETE", `/admin/courses/${c}`, { token: admin })).status, 200);
});
