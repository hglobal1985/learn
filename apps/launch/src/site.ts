/** 由 Worker 直接提供 Expo Web 靜態檔（SPA）；檔案在部署時打包進來（見 scripts/embed-static.mjs）。 */
export type StaticFiles = Record<string, { type: string; data: string }>;

const decoded = new Map<string, Uint8Array<ArrayBuffer>>();
function bytesOf(files: StaticFiles, path: string): Uint8Array<ArrayBuffer> {
  let b: Uint8Array<ArrayBuffer> | undefined = decoded.get(path);
  if (!b) {
    const bin = atob(files[path].data);
    b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    decoded.set(path, b);
  }
  return b;
}

export function serveStatic(req: Request, files: StaticFiles): Response {
  const url = new URL(req.url);
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  if (!files[path]) {
    // 有副檔名的檔案找不到就是 404；其餘是 App 路由，回傳 index.html 由前端處理。
    if (/\.[a-z0-9]+$/i.test(path)) return new Response("Not found", { status: 404 });
    path = "/index.html";
  }
  const body = bytesOf(files, path);
  const headers = new Headers({
    "content-type": files[path].type,
    "cache-control": /^\/(_expo\/static|assets)\//.test(path) ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    "accept-ranges": "bytes",
  });
  // iOS Safari 播放影片需要 Range（206）。
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = body.byteLength;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    return new Response(req.method === "HEAD" ? null : body.slice(start, end + 1), { status: 206, headers });
  }
  headers.set("content-length", String(body.byteLength));
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
}
