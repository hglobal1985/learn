import { handleApi } from "./api.ts";
import type { Env } from "./d1.ts";
import { shortLinkMeta, withShareMeta } from "./og.ts";
import { serveStatic, type StaticFiles } from "./site.ts";

/**
 * learn.hglobal1985.com：/api/v2/* 為 API，其餘為 Expo Web 靜態檔（SPA）。
 * /privacy* 由獨立 Worker learn-legal 透過路由處理。
 */
export function createWorker(staticFiles: StaticFiles) {
  return {
    async fetch(req: Request, env: Env, exec?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
      const url = new URL(req.url);
      if (url.pathname === "/api/v2" || url.pathname.startsWith("/api/v2/")) return handleApi(req, env, exec);
      if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
      let res = serveStatic(req, staticFiles);
      // 短網址（/縮寫）：分享到 LINE 等的預覽卡片，標題與說明由伺服器帶入。
      const slug = /^\/([a-z0-9-]{2,30})$/.exec(url.pathname)?.[1];
      if (slug && req.method === "GET" && res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html")) {
        const meta = await shortLinkMeta(env.DB, slug, url.origin).catch(() => null);
        if (meta) {
          const headers = new Headers(res.headers);
          headers.delete("content-length");
          headers.set("cache-control", "no-cache");
          res = new Response(withShareMeta(await res.text(), meta), { status: 200, headers });
        }
      }
      res.headers.set("x-content-type-options", "nosniff");
      res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
      res.headers.set("x-frame-options", "DENY");
      return res;
    },
  };
}

