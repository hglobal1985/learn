import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import type { CourseDetail } from "../src/contract.ts";
import type { Env, R2Bucket } from "../src/d1.ts";
import { createTestDb } from "./sqlite-d1.ts";

function fakeR2(): R2Bucket & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async head(k: string) { const o = objects.get(k); return o ? { size: o.byteLength } : null; },
    async get(k: string) { const o = objects.get(k); return o ? { size: o.byteLength, httpMetadata: { contentType: "image/jpeg" }, body: new Response(o as Uint8Array<ArrayBuffer>).body! } : null; },
    async delete(k: string) { objects.delete(k); },
    async put(k: string, v: unknown) { objects.set(k, new Uint8Array(v as ArrayBuffer)); },
    async createMultipartUpload() { throw new Error("unused"); },
    resumeMultipartUpload() { throw new Error("unused"); },
  } as never;
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

test("章節封面：課程要先勾選；上傳橫式／直式、顯示、換掉舊檔、刪除、刪章節一併清除", async () => {
  const bucket = fakeR2();
  const env: Env = { DB: createTestDb(), DEMO_LOGIN: "on", MEDIA: bucket };
  const call = async <T = unknown>(method: string, path: string, token?: string, body?: unknown) => {
    const res = await handleApi(
      new Request(`https://learn.test/api/v2${path}`, {
        method,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body instanceof Uint8Array ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : body instanceof Uint8Array ? (body as Uint8Array<ArrayBuffer>) : JSON.stringify(body),
      }),
      env,
    );
    const ct = res.headers.get("content-type") ?? "";
    return { status: res.status, data: (ct.includes("json") ? await res.json() : null) as T, raw: res };
  };
  const admin = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-admin" })).data.token;
  const student = (await call<{ token: string }>("POST", "/auth/demo", undefined, { sub: "demo-student" })).data.token;
  const course = (await call<CourseDetail>("POST", "/admin/courses", admin, { title: "封面課", priceTwd: 0 })).data;
  await call("PATCH", `/admin/courses/${course.id}`, admin, { status: "published" });
  const lessonId = (await call<CourseDetail>("GET", `/courses/${course.id}`, admin)).data.lessons[0]!.id;

  assert.equal(course.chapterCovers, false);
  assert.equal((await call("PUT", `/admin/lessons/${lessonId}/art?part=cover`, admin, JPEG)).status, 409); // 還沒勾選
  assert.equal((await call<CourseDetail>("PATCH", `/admin/courses/${course.id}`, admin, { chapterCovers: true })).data.chapterCovers, true);
  assert.equal((await call("PUT", `/admin/lessons/${lessonId}/art?part=cover`, student, JPEG)).status, 403);
  assert.equal((await call("PUT", `/admin/lessons/${lessonId}/art?part=bad`, admin, JPEG)).status, 400);
  assert.equal((await call("PUT", `/admin/lessons/${lessonId}/art?part=cover`, admin, new Uint8Array([1, 2, 3]))).status, 400); // 不是圖片

  const up = await call<{ url: string }>("PUT", `/admin/lessons/${lessonId}/art?part=cover`, admin, JPEG);
  assert.equal(up.status, 200);
  assert.equal((await call("PUT", `/admin/lessons/${lessonId}/art?part=poster`, admin, JPEG)).status, 200);
  let l = (await call<CourseDetail>("GET", `/courses/${course.id}`, student)).data.lessons[0]!;
  assert.match(l.coverUrl ?? "", /\/media\/pub\?k=lesson%2F/);
  assert.match(l.posterUrl ?? "", /\/media\/pub\?k=lesson%2F/);
  const served = await call("GET", l.coverUrl!.replace("/api/v2", ""));
  assert.equal(served.status, 200); // 公開圖片
  const idx = (await call<{ lessons: { id: string; coverUrl: string | null }[] }>("GET", "/search-index")).data.lessons.find((x) => x.id === lessonId);
  assert.ok(idx?.coverUrl);

  const before = bucket.objects.size;
  await call("PUT", `/admin/lessons/${lessonId}/art?part=cover`, admin, JPEG); // 換新圖：舊檔刪除
  assert.equal(bucket.objects.size, before);
  await call("DELETE", `/admin/lessons/${lessonId}/art?part=poster`, admin);
  l = (await call<CourseDetail>("GET", `/courses/${course.id}`, student)).data.lessons[0]!;
  assert.equal(l.posterUrl, null);
  assert.ok(l.coverUrl);
  assert.equal((await call("GET", `/admin/lessons/${lessonId}/mux-frame?time=3`, admin)).status, 400); // 不是 Mux

  // 複製課程不帶封面圖，但帶「章節各自設定封面」的勾選
  const copy = (await call<CourseDetail>("POST", `/admin/courses/${course.id}/duplicate`, admin)).data;
  assert.equal(copy.chapterCovers, true);
  assert.ok(copy.lessons.every((x) => !x.coverUrl));

  // 刪章節：圖檔一併清除
  assert.equal((await call("DELETE", `/admin/lessons/${lessonId}`, admin)).status, 200);
  assert.equal([...bucket.objects.keys()].filter((k) => k.startsWith("lesson/")).length, 0);
});
