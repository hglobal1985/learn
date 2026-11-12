import { handleApi } from "./api.ts";
import type { Env } from "./d1.ts";
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
      const res = serveStatic(req, staticFiles);
      res.headers.set("x-content-type-options", "nosniff");
      res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
      res.headers.set("x-frame-options", "DENY");
      return res;
    },
  };
}

