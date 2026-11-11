import { handleApi } from "./api.ts";
import type { Env } from "./d1.ts";

/**
 * learn.hglobal1985.com：/api/v2/* 為 API，其餘交給 Expo Web 靜態檔（SPA）。
 * /privacy* 由獨立 Worker learn-legal 透過路由處理。
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/v2/") || url.pathname === "/api/v2") return handleApi(req, env);
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    let res = await env.ASSETS.fetch(req);
    // iOS Safari 播放影片必須支援 Range（206）；靜態資源若回 200 全檔，這裡切出指定範圍。
    if (url.pathname.startsWith("/media/") && res.status === 200) res = await withRange(req, res);
    const headers = new Headers(res.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("x-frame-options", "DENY");
    if (url.pathname.startsWith("/_expo/static/")) headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};

export async function withRange(req: Request, res: Response): Promise<Response> {
  const headers = new Headers(res.headers);
  headers.set("accept-ranges", "bytes");
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!range || req.method !== "GET") return new Response(res.body, { status: res.status, headers });
  const body = new Uint8Array(await res.arrayBuffer());
  const size = body.byteLength;
  let start = range[1] ? Number(range[1]) : size - Number(range[2] || 0);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  if (!range[1] && !range[2]) [start, end] = [0, size - 1];
  end = Math.min(end, size - 1);
  if (Number.isNaN(start) || start < 0 || start > end) {
    headers.set("content-range", `bytes */${size}`);
    headers.delete("content-length");
    return new Response(null, { status: 416, headers });
  }
  headers.set("content-range", `bytes ${start}-${end}/${size}`);
  headers.set("content-length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}
